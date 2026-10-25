"""Synthetic benchmark (SPEC 8.3, P6.T7).

Renders every riff in shared/fixtures/demo-library.json and shared/fixtures/bench/*.riff.json
at three drive levels and two noise levels, runs the full pipeline, and scores the result
against the rendered ground truth. Writes docs/benchmarks/latest.md (the table and a summary)
and appends one row per run to docs/benchmarks/history.csv with the git short hash, so the
numbers travel with the commit that produced them.

    python -m tools.benchmark.run            # full matrix, writes the docs
    python -m tools.benchmark.run --smoke    # two riffs, one setting, no files (used by pytest)

Thresholds (phase file): averaged onset F1 >= 0.90, note F1 >= 0.80, fingering accuracy
>= 0.70, tempo within 2 BPM on at least 80 percent of cases.
"""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import time
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from riffspaced.analysis.io import Audio
from riffspaced.analysis.pipeline import AnalyzeOptions, analyze_audio
from riffspaced.analysis.scoring import score_notes
from riffspaced.paths import FIXTURES_DIR, REPO_DIR
from riffspaced.synth import render_riff

DRIVES = (3.0, 6.0, 10.0)
NOISES = (-60.0, -35.0)
THRESHOLDS = {"onset_f1": 0.90, "note_f1": 0.80, "fingering_accuracy": 0.70, "bpm_within_2": 0.80}


@dataclass
class Row:
    """One cell of the matrix."""

    riff: str
    drive: float
    noise_db: float
    bpm_true: float
    bpm_found: float
    bpm_error: float
    onset_f1: float
    note_f1: float
    fingering_accuracy: float
    dyad_accuracy: float
    mean_confidence: float
    seconds: float


def load_riffs() -> list[dict[str, Any]]:
    """Demo riffs first, then the bench folder in name order."""
    demo = json.loads((FIXTURES_DIR / "demo-library.json").read_text())["riffs"]
    bench = [
        json.loads(p.read_text()) for p in sorted((FIXTURES_DIR / "bench").glob("*.riff.json"))
    ]
    return [*demo, *bench]


def run_case(riff: dict[str, Any], drive: float, noise_db: float) -> Row:
    """Render, analyze, score."""
    audio, truth = render_riff(riff, drive=drive, noise_db=noise_db)
    started = time.perf_counter()
    out, report = analyze_audio(Audio(audio, 44100, path=f"{riff['name']}.wav"), AnalyzeOptions())
    seconds = time.perf_counter() - started
    scores = score_notes(truth, out, out["tempo"]["bpm"])
    bpm_true = float(riff["tempo"]["bpm"])
    # Octave readings are accepted the way the phase file accepts them for tempo.
    error = min(
        abs(report.bpm - bpm_true), abs(report.bpm - bpm_true / 2), abs(report.bpm - bpm_true * 2)
    )
    return Row(
        riff=riff["name"],
        drive=drive,
        noise_db=noise_db,
        bpm_true=bpm_true,
        bpm_found=report.bpm,
        bpm_error=round(error, 2),
        onset_f1=scores.onset_f1,
        note_f1=scores.note_f1,
        fingering_accuracy=scores.fingering_accuracy,
        dyad_accuracy=scores.dyad_accuracy,
        mean_confidence=report.mean_confidence,
        seconds=round(seconds, 2),
    )


def summarize(rows: list[Row]) -> dict[str, float]:
    """Averages over the matrix plus the share of cases with tempo within 2 BPM."""
    n = max(1, len(rows))
    return {
        "onset_f1": round(sum(r.onset_f1 for r in rows) / n, 3),
        "note_f1": round(sum(r.note_f1 for r in rows) / n, 3),
        "fingering_accuracy": round(sum(r.fingering_accuracy for r in rows) / n, 3),
        "dyad_accuracy": round(sum(r.dyad_accuracy for r in rows) / n, 3),
        "bpm_within_2": round(sum(1 for r in rows if r.bpm_error <= 2.0) / n, 3),
        "mean_confidence": round(sum(r.mean_confidence for r in rows) / n, 3),
        "seconds": round(sum(r.seconds for r in rows), 1),
    }


def passes(summary: dict[str, float]) -> dict[str, bool]:
    """Threshold check per metric."""
    return {k: summary[k] >= v for k, v in THRESHOLDS.items()}


def git_short_hash() -> str:
    """The commit the numbers belong to."""
    try:
        return subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
            cwd=REPO_DIR,
        ).stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"


def to_markdown(rows: list[Row], summary: dict[str, float], commit: str) -> str:
    """The latest.md document."""
    ok = passes(summary)
    lines = [
        "# Analysis benchmark: latest",
        "",
        f"Commit `{commit}`, {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}. "
        f"{len(rows)} cases: {len({r.riff for r in rows})} riffs x drives "
        f"{', '.join(str(d) for d in DRIVES)} x noise {', '.join(str(int(n)) for n in NOISES)} dB. "
        "Rendered by the Karplus-Strong test synth, scored against its own ground truth "
        "(30 ms window).",
        "",
        "## Summary",
        "",
        "| metric | value | threshold | pass |",
        "|---|---|---|---|",
    ]
    for key, label in (
        ("onset_f1", "onset F1"),
        ("note_f1", "note F1"),
        ("fingering_accuracy", "fingering accuracy"),
        ("bpm_within_2", "tempo within 2 BPM"),
    ):
        lines.append(
            f"| {label} | {summary[key]:.3f} | {THRESHOLDS[key]:.2f} "
            f"| {'yes' if ok[key] else 'no'} |"
        )
    lines.append(f"| dyad accuracy | {summary['dyad_accuracy']:.3f} | (tracked) | |")
    lines.append(f"| mean confidence | {summary['mean_confidence']:.3f} | (tracked) | |")
    lines.append(f"| total analysis time | {summary['seconds']:.1f} s | | |")
    lines += [
        "",
        "## Cases",
        "",
        "| riff | drive | noise dB | bpm true | bpm found | bpm err | onset F1 | note F1 "
        "| fingering | dyad | confidence | s |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        lines.append(
            f"| {r.riff} | {r.drive:g} | {int(r.noise_db)} | {r.bpm_true:g} | {r.bpm_found:.1f} "
            f"| {r.bpm_error:.1f} | {r.onset_f1:.3f} | {r.note_f1:.3f} "
            f"| {r.fingering_accuracy:.3f} "
            f"| {r.dyad_accuracy:.3f} | {r.mean_confidence:.2f} | {r.seconds:.1f} |"
        )
    lines += ["", "Regenerate with `make bench` in `backend/`. History in `history.csv`.", ""]
    return "\n".join(lines)


def run_matrix(
    riffs: list[dict[str, Any]], drives=DRIVES, noises=NOISES, verbose: bool = True
) -> list[Row]:
    """Every riff at every setting."""
    rows: list[Row] = []
    for riff in riffs:
        for drive in drives:
            for noise in noises:
                row = run_case(riff, drive, noise)
                rows.append(row)
                if verbose:
                    print(
                        f"{row.riff:20s} drive {drive:4.1f} noise {int(noise):4d}  "
                        f"onset {row.onset_f1:.3f} note {row.note_f1:.3f} "
                        f"fing {row.fingering_accuracy:.3f} dyad {row.dyad_accuracy:.3f} "
                        f"bpm err {row.bpm_error:.1f} ({row.seconds:.1f}s)",
                        flush=True,
                    )
    return rows


def write_docs(rows: list[Row], summary: dict[str, float]) -> Path:
    """latest.md and a history.csv row."""
    docs = REPO_DIR / "docs" / "benchmarks"
    docs.mkdir(parents=True, exist_ok=True)
    commit = git_short_hash()
    (docs / "latest.md").write_text(to_markdown(rows, summary, commit))
    history = docs / "history.csv"
    new = not history.exists()
    with history.open("a", newline="") as fh:
        writer = csv.writer(fh)
        if new:
            writer.writerow(["commit", "date", "cases", *summary.keys()])
        writer.writerow(
            [commit, datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"), len(rows), *summary.values()]
        )
    return docs / "latest.md"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Synthetic analysis benchmark.")
    parser.add_argument("--smoke", action="store_true", help="two riffs, one setting, no files")
    args = parser.parse_args(argv)
    riffs = load_riffs()
    if args.smoke:
        rows = run_matrix(riffs[:2], drives=(6.0,), noises=(-60.0,))
        summary = summarize(rows)
        print(json.dumps(summary))
        return 0 if all(passes(summary).values()) else 1
    rows = run_matrix(riffs)
    summary = summarize(rows)
    path = write_docs(rows, summary)
    print(
        json.dumps(
            {"summary": summary, "pass": passes(summary), "rows": [asdict(r) for r in rows][:1]},
            indent=1,
        )[:400]
    )
    print(f"wrote {path}")
    return 0 if all(passes(summary).values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
