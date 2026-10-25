"""Check riff JSON that came from outside (outboard tools, other LLMs; see outboard-guidance/).

    python -m riffspaced.check_riffs ../injest-riff-JSON

Every `*.json` in the folder is migrated if it is an older version, validated against the
schema and the semantic rules, and summarized: tuning, tempo, bars, notes, dyad histogram,
palm mutes, confidence, and the playability facts the schema cannot judge (chord spans over
four frets, notes above fret 12, strings outside the low four, off-grid starts). The summary
is printed and written next to the file as `<name>.check.md`. Exit code 1 if any file failed.

A library bundle (`riff-spaced/library`) is accepted too; each riff inside is summarized.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from riffspaced.model.migrate import MigrationError, migrate_any
from riffspaced.model.types import LIBRARY_FORMAT, RIFF_FORMAT
from riffspaced.model.validate import ValidationError, validate_library, validate_riff
from riffspaced.music.dyad import describe_dyad
from riffspaced.music.fingering import MAX_SPAN, Position, hand_span
from riffspaced.music.time import TICKS_PER_BAR
from riffspaced.music.tuning import Tuning, pitch_of

FINE_GRID = 40  # 1/16 (120) and 1/16T (80) are both multiples of 40 ticks


@dataclass
class CheckResult:
    """One file's verdict and its markdown summary."""

    path: Path
    ok: bool
    kind: str = ""
    problems: list[str] = field(default_factory=list)
    summary: str = ""


def summarize_riff(riff: dict[str, Any]) -> dict[str, Any]:
    """Facts a human wants to see before opening the file."""
    tuning = Tuning.from_dict(riff["tuning"])
    notes = riff["notes"]
    lowest_four = set(range(tuning.string_count, max(0, tuning.string_count - 4), -1))
    groups: dict[str, list[dict[str, Any]]] = {}
    for n in notes:
        if n.get("chordId"):
            groups.setdefault(n["chordId"], []).append(n)
    dyads: Counter[str] = Counter()
    wide_chords = []
    for chord_id, members in groups.items():
        if len(members) == 2:
            a, b = (pitch_of(tuning, m["string"], m["fret"]) for m in members)
            dyads[describe_dyad(a, b).interval] += 1
        span = hand_span([Position(m["string"], m["fret"]) for m in members])
        if span > MAX_SPAN:
            wide_chords.append(f"{chord_id} (span {span})")
    confidences = [n.get("confidence", 1.0) for n in notes]
    loop_end = riff["lengthBars"] * TICKS_PER_BAR
    return {
        "name": riff["name"],
        "tuning": tuning.name,
        "pitches": list(tuning.pitches),
        "bpm": riff["tempo"]["bpm"],
        "lengthBars": riff["lengthBars"],
        "noteCount": len(notes),
        "chordCount": len(groups),
        "singleNotes": sum(1 for n in notes if not n.get("chordId")),
        "dyads": dict(dyads.most_common()),
        "palmMuted": sum(1 for n in notes if "palmMute" in n.get("techniques", [])),
        "meanConfidence": round(sum(confidences) / len(confidences), 3) if confidences else None,
        "lowConfidence": sum(1 for c in confidences if c < 0.6),
        "unplayable": sum(1 for n in notes if n.get("unplayable")),
        "wideChords": wide_chords,
        "aboveFret12": sum(1 for n in notes if n["fret"] > 12),
        "offLowStrings": sum(1 for n in notes if n["string"] not in lowest_four),
        "offGridStarts": sum(1 for n in notes if n["start"] % FINE_GRID),
        "pastTheEnd": sum(1 for n in notes if n["start"] + n["duration"] > loop_end),
        "source": riff.get("source", {}),
    }


def summary_markdown(info: dict[str, Any]) -> str:
    """The summary as a markdown bullet list."""
    dyads = ", ".join(f"{k} {v}" for k, v in info["dyads"].items()) or "none"
    source = info["source"]
    lines = [
        f"## {info['name']}",
        "",
        f"- tuning: {info['tuning']} {info['pitches']}",
        f"- tempo: {info['bpm']} bpm, {info['lengthBars']} bars",
        f"- notes: {info['noteCount']} ({info['chordCount']} chords, "
        f"{info['singleNotes']} single notes)",
        f"- dyads: {dyads}",
        f"- palm muted: {info['palmMuted']}",
        f"- confidence: mean {info['meanConfidence']}, below 0.6: {info['lowConfidence']}",
        f"- unplayable: {info['unplayable']}, chords wider than {MAX_SPAN} frets: "
        f"{', '.join(info['wideChords']) or 'none'}",
        f"- above fret 12: {info['aboveFret12']}, off the low four strings: "
        f"{info['offLowStrings']}, off the {FINE_GRID}-tick grid: {info['offGridStarts']}, "
        f"past the loop end: {info['pastTheEnd']}",
        f"- source: {source.get('type', 'unknown')}"
        + (f", {source['analysisVersion']}" if source.get("analysisVersion") else "")
        + (f", {source['audioFile']}" if source.get("audioFile") else ""),
    ]
    return "\n".join(lines) + "\n"


def check_document(doc: Any) -> tuple[str, list[dict[str, Any]]]:
    """Migrate and validate one parsed JSON document; return its kind and the riffs in it."""
    if not isinstance(doc, dict):
        raise ValidationError(["document: must be a JSON object"])
    doc = migrate_any(doc)
    kind = doc.get("format")
    if kind == RIFF_FORMAT:
        return "riff", [validate_riff(doc)]
    if kind == LIBRARY_FORMAT:
        return "library", list(validate_library(doc)["riffs"])
    raise ValidationError([f"format: expected {RIFF_FORMAT} or {LIBRARY_FORMAT}, got {kind!r}"])


def check_file(path: Path) -> CheckResult:
    """Parse, migrate, validate and summarize one file."""
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return CheckResult(path, False, problems=[f"not readable as JSON: {error}"])
    try:
        kind, riffs = check_document(doc)
    except MigrationError as error:
        return CheckResult(path, False, problems=[str(error)])
    except ValidationError as error:
        return CheckResult(path, False, problems=list(error.errors))
    except (KeyError, TypeError, ValueError) as error:
        return CheckResult(path, False, problems=[f"malformed document: {error!r}"])
    summary = f"# {path.name}\n\nvalid {kind}\n\n" + "\n".join(
        summary_markdown(summarize_riff(r)) for r in riffs
    )
    return CheckResult(path, True, kind=kind, summary=summary)


def main(argv: list[str] | None = None) -> int:
    """Check every JSON file in the folder; print and write the summaries."""
    parser = argparse.ArgumentParser(description="Validate and summarize riff JSON files.")
    parser.add_argument("folder", help="folder of *.json riffs or library bundles")
    parser.add_argument(
        "--no-write", action="store_true", help="print only, do not write <name>.check.md"
    )
    args = parser.parse_args(argv)
    folder = Path(args.folder)
    if not folder.is_dir():
        print(f"error: {folder} is not a folder", file=sys.stderr)
        return 2
    files = sorted(p for p in folder.glob("*.json") if p.is_file())
    if not files:
        print(f"nothing to do: no .json files in {folder}", file=sys.stderr)
        return 1
    failures = 0
    for path in files:
        result = check_file(path)
        if result.ok:
            print(result.summary)
            if not args.no_write:
                (path.with_suffix("").with_suffix(".check.md")).write_text(result.summary)
        else:
            failures += 1
            print(f"# {path.name}\n\nINVALID\n")
            print("\n".join(f"- {p}" for p in result.problems) + "\n")
    print(f"done: {len(files) - failures} valid, {failures} invalid")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
