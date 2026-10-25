"""Riff JSON to a readable YAML file (owner request, 2026-10-25).

    python -m riffspaced.yamlout riffs_out/RS-Spider.riff.json      # writes RS-Spider.riff.yaml

The YAML is for reading and correcting a transcription by hand: one line per note with the
bar position, the pitch name, the string and fret, the length in ticks and the confidence.
It is written by hand here (a small, fixed subset of YAML: scalars, lists, flow maps)
rather than through a library, so there is nothing to install and the output is stable.
The JSON stays the format the app reads; this file is the human view of it.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from riffspaced.model.validate import validate_riff
from riffspaced.music.naming import name_of
from riffspaced.music.time import format_position
from riffspaced.music.tuning import Tuning, pitch_of


def _scalar(value: Any) -> str:
    """A YAML scalar: numbers and booleans bare, strings quoted when they need it."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int | float):
        return repr(value) if isinstance(value, float) else str(value)
    if value is None:
        return "null"
    text = str(value)
    safe = text and all(c.isalnum() or c in "-_./" for c in text) and text[0].isalpha()
    return text if safe else json.dumps(text)


def _flow(items: list[tuple[str, Any]]) -> str:
    return "{" + ", ".join(f"{k}: {_scalar(v)}" for k, v in items) + "}"


def riff_to_yaml(riff: dict[str, Any]) -> str:
    """Render a validated riff dict as YAML text."""
    validate_riff(riff)
    tuning = Tuning.from_dict(riff["tuning"])
    accidentals = (riff.get("namingPrefs") or {}).get("accidentals", "flats")
    lines = [
        "# RIFF-SPACED riff, human view. The .riff.json beside it is what the app reads.",
        f"name: {_scalar(riff['name'])}",
        f"id: {_scalar(riff['id'])}",
        f"tuning: {_scalar(tuning.name)}",
        "open_strings: "
        + _flow(
            [
                (f"string_{s}", name_of(pitch_of(tuning, s, 0), accidentals))
                for s in range(tuning.string_count, 0, -1)
            ]
        ),
        f"bpm: {_scalar(riff['tempo']['bpm'])}",
        f"length_bars: {riff['lengthBars']}",
        "ticks_per_quarter: 480",
        "sections:",
    ]
    for s in riff["sections"]:
        end = s["startBar"] + s["lengthBars"]
        lines.append(
            "  - "
            + _flow(
                [("label", s["label"]), ("bars", f"{s['startBar'] + 1}-{end}"), ("kind", s["kind"])]
            )
        )
    source = riff.get("source") or {}
    if source:
        lines.append("source: " + _flow(list(source.items())))
    if riff.get("tags"):
        lines.append("tags: [" + ", ".join(_scalar(t) for t in riff["tags"]) + "]")
    lines.append("")
    lines.append(
        "# position is bar.beat.tick (1-based bar and beat). chord groups notes struck together."
    )
    lines.append("notes:")
    notes = sorted(riff["notes"], key=lambda n: (n["start"], -n["string"]))
    for n in notes:
        pitch = pitch_of(tuning, n["string"], n["fret"])
        row: list[tuple[str, Any]] = [
            ("at", format_position(n["start"])),
            ("string", n["string"]),
            ("fret", n["fret"]),
            ("name", name_of(pitch, accidentals)),
            ("len", n["duration"]),
            ("vel", n.get("velocity", 100)),
        ]
        if n.get("chordId"):
            row.append(("chord", n["chordId"]))
        if n.get("techniques"):
            row.append(("tech", "+".join(n["techniques"])))
        if "confidence" in n:
            row.append(("conf", round(float(n["confidence"]), 2)))
        if n.get("unplayable"):
            row.append(("unplayable", True))
        row.append(("id", n["id"]))
        lines.append("  - " + _flow(row))
    return "\n".join(lines) + "\n"


def yaml_path_for(json_path: Path) -> Path:
    """`x.riff.json` becomes `x.riff.yaml`; any other `.json` becomes `.yaml`."""
    name = json_path.name
    if name.endswith(".riff.json"):
        return json_path.with_name(name[: -len(".json")] + ".yaml")
    return json_path.with_suffix(".yaml")


def main(argv: list[str] | None = None) -> int:
    """Convert one or more riff JSON files to YAML next to them."""
    parser = argparse.ArgumentParser(description="Write a readable YAML view of riff JSON files.")
    parser.add_argument("files", nargs="+", help="*.riff.json files")
    args = parser.parse_args(argv)
    failures = 0
    for raw in args.files:
        path = Path(raw)
        try:
            text = riff_to_yaml(json.loads(path.read_text(encoding="utf-8")))
        except Exception as error:  # noqa: BLE001 (report every file, keep going)
            failures += 1
            print(f"{path.name}: {error}", file=sys.stderr)
            continue
        out = yaml_path_for(path)
        out.write_text(text, encoding="utf-8")
        print(f"{path.name} -> {out.name}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
