"""Ingest CLI (SPEC 8.4): a folder of recordings in, riff JSON and reports out.

    python -m riffspaced.ingest ./audio_in --out ./riffs_out --tuning "Bb Standard"
    (optional: --bpm 92, --max-fret 12, --strings 6,5,4, --ai)

Every supported file in the folder becomes `<name>.riff.json` and `<name>.report.md`.
The exit code is non-zero when any file failed. `--ai` runs the Claude cleanup pass once
Phase 7 lands; until then it prints a notice and does nothing else.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from riffspaced.analysis.io import FFMPEG_EXTENSIONS, SOUNDFILE_EXTENSIONS, UnsupportedFormat
from riffspaced.analysis.pipeline import AnalyzeOptions, analyze
from riffspaced.model.validate import ValidationError

SUPPORTED = sorted(SOUNDFILE_EXTENSIONS | FFMPEG_EXTENSIONS)


def audio_files(folder: Path) -> list[Path]:
    """Supported files in the folder, sorted by name."""
    return sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in SUPPORTED)


def ingest_file(path: Path, out_dir: Path, options: AnalyzeOptions) -> tuple[Path, Path]:
    """Analyze one file and write its riff and report next to each other in `out_dir`."""
    riff, report = analyze(path, options)
    riff_path = out_dir / f"{path.stem}.riff.json"
    report_path = out_dir / f"{path.stem}.report.md"
    riff_path.write_text(json.dumps(riff, indent=2) + "\n")
    report_path.write_text(report.to_markdown(path.stem))
    return riff_path, report_path


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
    if args.ai:
        print("note: --ai is wired in Phase 7; running the analysis only")

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    failures = 0
    for i, path in enumerate(files, 1):
        print(f"[{i}/{len(files)}] {path.name} ...", end=" ", flush=True)
        try:
            riff_path, report_path = ingest_file(path, out_dir, options)
        except (UnsupportedFormat, ValidationError, ValueError, OSError) as error:
            failures += 1
            print(f"failed: {error}")
            continue
        riff = json.loads(riff_path.read_text())
        notes = len(riff["notes"])
        bpm = riff["tempo"]["bpm"]
        print(f"{notes} notes, {bpm} bpm -> {riff_path.name}, {report_path.name}")
    ok = len(files) - failures
    print(f"done: {ok} ok, {failures} failed, output in {out_dir}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
