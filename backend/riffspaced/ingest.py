"""Ingest CLI (SPEC 8.4): a folder of recordings in, riff JSON and reports out.

    python -m riffspaced.ingest ./audio_in --out ./riffs_out --tuning "Bb Standard"
    (optional: --bpm 92, --max-fret 12, --strings 6,5,4, --ai)

Every supported file in the folder becomes `<name>.riff.json` and `<name>.report.md`.
With `--ai`, the Claude cleanup pass (SPEC 9.2) also writes `<name>.clean.riff.json` and
`<name>.cleanup.md`; the raw riff is kept so the two can be compared. Without a key (and
without RIFFSPACED_AI_FAKE=1) the flag prints a notice and the analysis runs alone.
The exit code is non-zero when any file failed to analyze.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from riffspaced.ai.cleanup import cleanup_riff
from riffspaced.ai.client import AiClient, AiError, AiNotConfiguredError, make_client
from riffspaced.analysis.emit import Report
from riffspaced.analysis.io import FFMPEG_EXTENSIONS, SOUNDFILE_EXTENSIONS, UnsupportedFormat
from riffspaced.analysis.pipeline import AnalyzeOptions, analyze
from riffspaced.model.validate import ValidationError

SUPPORTED = sorted(SOUNDFILE_EXTENSIONS | FFMPEG_EXTENSIONS)


def audio_files(folder: Path) -> list[Path]:
    """Supported files in the folder, sorted by name."""
    return sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in SUPPORTED)


@dataclass
class IngestResult:
    """One analyzed file: the documents and where they were written."""

    riff: dict[str, Any]
    report: Report
    riff_path: Path
    report_path: Path


def ingest_file(path: Path, out_dir: Path, options: AnalyzeOptions) -> IngestResult:
    """Analyze one file and write its riff and report next to each other in `out_dir`."""
    riff, report = analyze(path, options)
    riff_path = out_dir / f"{path.stem}.riff.json"
    report_path = out_dir / f"{path.stem}.report.md"
    riff_path.write_text(json.dumps(riff, indent=2) + "\n")
    report_path.write_text(report.to_markdown(path.stem))
    return IngestResult(riff, report, riff_path, report_path)


def cleanup_markdown(name: str, result: dict[str, Any]) -> str:
    """`<name>.cleanup.md`: what the model changed, what the backend refused."""
    lines = [f"# {name}: AI cleanup", ""]
    lines.append(f"- model: {result['model']}, prompt version {result['promptVersion']}")
    usage = result.get("usage") or {}
    if usage:
        lines.append(
            f"- tokens: {usage.get('inputTokens', 0)} in, {usage.get('outputTokens', 0)} out, "
            f"{usage.get('attempts', 1)} attempt(s)"
        )
    lines.append(f"- notes: {len(result['riff']['notes'])} after cleanup")
    lines += ["", "## changes"]
    lines += [f"- {c['kind']} {', '.join(c['noteIds'])}: {c['reason']}" for c in result["changes"]]
    if not result["changes"]:
        lines.append("- none")
    if result["rejected"]:
        lines += ["", "## rejected by the backend"]
        lines += [
            f"- {r['kind']} {', '.join(r['noteIds'])}: {r['rejectedBecause']}"
            for r in result["rejected"]
        ]
    return "\n".join(lines) + "\n"


def run_cleanup(result: IngestResult, out_dir: Path, client: AiClient) -> tuple[Path, int]:
    """Cleanup pass for one analyzed file; returns the cleaned riff path and the change count."""
    cleaned = cleanup_riff(result.riff, result.report.to_dict(), client)
    stem = result.riff_path.name.removesuffix(".riff.json")
    clean_path = out_dir / f"{stem}.clean.riff.json"
    clean_path.write_text(json.dumps(cleaned["riff"], indent=2) + "\n")
    (out_dir / f"{stem}.cleanup.md").write_text(cleanup_markdown(stem, cleaned))
    return clean_path, len(cleaned["changes"])


def main(argv: list[str] | None = None) -> int:
    """Parse arguments, ingest every file, return the exit code."""
    parser = argparse.ArgumentParser(
        description="Turn a folder of guitar recordings into RIFF-SPACED riff JSON."
    )
    parser.add_argument(
        "folder", help="folder of WAV / FLAC / OGG (or MP3 / M4A with ffmpeg) recordings"
    )
    parser.add_argument("--out", default="./riffs_out", help="output folder (created if missing)")
    parser.add_argument(
        "--tuning", default="Bb Standard", help='preset name, e.g. "Bb Standard" or "Drop Ab"'
    )
    parser.add_argument("--bpm", type=float, default=None, help="override the detected tempo")
    parser.add_argument(
        "--max-fret", type=int, default=12, help="highest fret in the search (default 12)"
    )
    parser.add_argument(
        "--strings",
        default="6,5,4,3",
        help="strings to search, guitarist numbering (default 6,5,4,3)",
    )
    parser.add_argument("--ai", action="store_true", help="run the Claude cleanup pass (Phase 7)")
    args = parser.parse_args(argv)

    folder = Path(args.folder)
    if not folder.is_dir():
        print(f"error: {folder} is not a folder", file=sys.stderr)
        return 2
    try:
        options = AnalyzeOptions.from_names(args.tuning, args.bpm, args.max_fret, args.strings)
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    files = audio_files(folder)
    if not files:
        print(f"nothing to do: no {', '.join(SUPPORTED)} files in {folder}", file=sys.stderr)
        return 1
    client: AiClient | None = None
    if args.ai:
        try:
            client = make_client()
        except AiNotConfiguredError as error:
            print(f"note: --ai skipped, {error}; running the analysis only")

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    failures = 0
    for i, path in enumerate(files, 1):
        print(f"[{i}/{len(files)}] {path.name} ...", end=" ", flush=True)
        try:
            result = ingest_file(path, out_dir, options)
        except (UnsupportedFormat, ValidationError, ValueError, OSError) as error:
            failures += 1
            print(f"failed: {error}")
            continue
        notes = len(result.riff["notes"])
        bpm = result.riff["tempo"]["bpm"]
        line = f"{notes} notes, {bpm} bpm -> {result.riff_path.name}, {result.report_path.name}"
        if client is not None:
            try:
                clean_path, changed = run_cleanup(result, out_dir, client)
                line += f", {clean_path.name} ({changed} change(s))"
            except AiError as error:
                line += f", cleanup failed: {error}"
        print(line)
    ok = len(files) - failures
    print(f"done: {ok} ok, {failures} failed, output in {out_dir}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
