"""The whole pipeline (SPEC 8.2): a file or an Audio in, a riff dict and a Report out."""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

from riffspaced.analysis.decode import viterbi
from riffspaced.analysis.emit import Report, build_report, build_riff
from riffspaced.analysis.fingering_match import enumerate_candidates, score_matrix, segment_spectra
from riffspaced.analysis.io import Audio, load_audio
from riffspaced.analysis.onsets import detect_onsets
from riffspaced.analysis.preprocess import highpass_lowpass
from riffspaced.analysis.quantize import quantize
from riffspaced.analysis.stft import frames
from riffspaced.analysis.tempo import estimate_tempo
from riffspaced.music.tuning import DEFAULT_TUNING, Tuning, preset_by_name

log = logging.getLogger("riffspaced.analysis")


@dataclass
class AnalyzeOptions:
    """Knobs the CLI and the API expose."""

    tuning: Tuning = DEFAULT_TUNING
    bpm: float | None = None
    max_fret: int = 12
    strings: tuple[int, ...] = (6, 5, 4, 3)
    name: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_names(
        cls,
        tuning_name: str | None = None,
        bpm: float | None = None,
        max_fret: int = 12,
        strings: str | None = None,
        name: str | None = None,
    ) -> AnalyzeOptions:
        """Build from the strings a CLI or a JSON body carries."""
        tuning = preset_by_name(tuning_name) if tuning_name else None
        if tuning_name and tuning is None:
            raise ValueError(f"unknown tuning {tuning_name!r}")
        string_tuple = tuple(int(s) for s in strings.split(",")) if strings else (6, 5, 4, 3)
        return cls(
            tuning=tuning or DEFAULT_TUNING,
            bpm=bpm,
            max_fret=max_fret,
            strings=string_tuple,
            name=name,
        )


def analyze_audio(
    audio: Audio, options: AnalyzeOptions | None = None, debug_name: str | None = None
) -> tuple[dict[str, Any], Report]:
    """Run every stage on loaded audio."""
    options = options or AnalyzeOptions()
    timings: dict[str, float] = {}
    warnings: list[str] = []

    def stage(name: str, start: float) -> None:
        timings[name] = round(time.perf_counter() - start, 3)
        log.info("%s: %.3fs", name, timings[name])

    t = time.perf_counter()
    clean = highpass_lowpass(audio)
    stage("preprocess", t)
    t = time.perf_counter()
    spec = frames(clean)
    stage("stft", t)
    t = time.perf_counter()
    onsets = detect_onsets(clean, spec, debug_name=debug_name)
    stage("onsets", t)
    if len(onsets.times) == 0:
        warnings.append("no onsets found; is the file silent?")
    t = time.perf_counter()
    estimate = estimate_tempo(onsets)
    detected_bpm = estimate.bpm
    bpm = float(options.bpm) if options.bpm else detected_bpm
    stage("tempo", t)
    t = time.perf_counter()
    candidates = enumerate_candidates(options.tuning, options.max_fret, options.strings)
    segments = segment_spectra(spec, onsets, end_time=audio.seconds)
    scores = score_matrix(segments, candidates, spec.freqs)
    stage("match", t)
    if debug_name and os.getenv("RIFFSPACED_DEBUG") == "1":
        save_score_plot(scores, candidates, debug_name)
    t = time.perf_counter()
    decoded = viterbi(scores, candidates)
    stage("decode", t)
    t = time.perf_counter()
    events, offset = quantize(
        segments, candidates, decoded.path, decoded.confidences, bpm, spec, onsets.strengths
    )
    stage("quantize", t)
    if events and np.mean([e.confidence for e in events]) < 0.5:
        warnings.append("low overall confidence; check the tuning setting and the tempo")
    name = options.name or (Path(audio.path).stem if audio.path else "imported riff")
    riff = build_riff(
        events, options.tuning, bpm, name, Path(audio.path).name if audio.path else "", detected_bpm
    )
    report = build_report(
        events, bpm, estimate.candidates, options.bpm is not None, offset, warnings, timings
    )
    return riff, report


def analyze(
    path: str | Path, options: AnalyzeOptions | None = None
) -> tuple[dict[str, Any], Report]:
    """Load a file and analyze it."""
    audio = load_audio(path)
    return analyze_audio(audio, options, debug_name=Path(path).stem)


def save_score_plot(scores: np.ndarray, candidates, name: str) -> Path | None:
    """Heat map of the segment by candidate score matrix, backend/debug/<name>_scores.png."""
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        return None
    out_dir = Path(__file__).resolve().parents[2] / "debug"
    out_dir.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(14, 6))
    ax.imshow(scores.T, aspect="auto", origin="lower", cmap="viridis")
    ax.set_xlabel("segment")
    ax.set_ylabel(f"candidate (0 = silence, {len(candidates)} total)")
    path = out_dir / f"{name}_scores.png"
    fig.tight_layout()
    fig.savefig(path, dpi=100)
    plt.close(fig)
    return path
