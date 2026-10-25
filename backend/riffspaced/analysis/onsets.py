"""Stage 4: onsets (SPEC 8.2 step 4).

Spectral flux: how much louder each frame got, summed over the bins between 60 Hz and
5 kHz, counting only increases (half-wave rectified). A pick attack is a burst of new energy
across many bins, so it stands out even under heavy distortion; palm-muted chugs are the
cleanest case of all. The flux is smoothed, compared with an adaptive threshold (the local
mean over about plus or minus 0.35 s plus a margin), and its peaks are kept with a 50 ms
minimum gap.

Timing uses its own short STFT (1024-point window, 256 hop): the 4096-point window the
pitch stages need smears an attack over 93 ms and puts the flux peak 30 ms early, while a
23 ms window lands within a frame of the true onset. Frequency resolution does not matter
for "did energy arrive", only for "which note was it".

Sustained notes with a pitch change but no new attack (a slide, a hammer-on, a soft second
note of a dyad) produce weak flux, so a second detector watches the dominant interpolated
peak and adds an onset when its pitch jumps by a semitone or more and stays there for three
frames.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from riffspaced.analysis.io import Audio
from riffspaced.analysis.stft import DB_FLOOR, Spectrogram, frames

FLUX_LOW_HZ = 60.0
FLUX_HIGH_HZ = 5000.0
SMOOTH_FRAMES = 3
LOCAL_WINDOW_SECONDS = 0.35
THRESHOLD_MARGIN = 0.12
MIN_GAP_SECONDS = 0.05
PITCH_JUMP_SEMITONES = 1.0
PITCH_HOLD_FRAMES = 3
# A pitch jump within this long after a flux onset is the same event settling, not a new one.
PITCH_JUMP_GAP_SECONDS = 0.12
PITCH_MAX_HZ = 1000.0
PITCH_LOUDNESS_DB = -35.0
ONSET_N_FFT = 1024
ONSET_HOP = 256


@dataclass(frozen=True)
class Onsets:
    """Onset times in seconds and their flux strengths (0..1)."""

    times: np.ndarray
    strengths: np.ndarray
    flux: np.ndarray
    threshold: np.ndarray
    frame_times: np.ndarray
    origins: np.ndarray = field(default_factory=lambda: np.zeros(0, dtype=object))
    """Per onset, 'flux' or 'pitch': which detector found it."""


def spectral_flux(
    spec: Spectrogram, low_hz: float = FLUX_LOW_HZ, high_hz: float = FLUX_HIGH_HZ
) -> np.ndarray:
    """Half-wave rectified log-magnitude differences summed over the band, normalized to 0..1."""
    band = (spec.freqs >= low_hz) & (spec.freqs <= high_hz)
    log_mag = spec.mag_db[:, band]
    # Prepend a silent frame so a note that starts at time zero still counts as an increase.
    silent = np.full((1, log_mag.shape[1]), DB_FLOOR, dtype=log_mag.dtype)
    diff = np.diff(log_mag, axis=0, prepend=silent)
    flux = np.sum(np.maximum(diff, 0.0), axis=1)
    if SMOOTH_FRAMES > 1:
        kernel = np.ones(SMOOTH_FRAMES) / SMOOTH_FRAMES
        flux = np.convolve(flux, kernel, mode="same")
    top = float(np.max(flux)) if len(flux) else 0.0
    return (flux / top).astype(np.float32) if top > 0 else flux.astype(np.float32)


def adaptive_threshold(
    flux: np.ndarray,
    frame_seconds: float,
    window_seconds: float = LOCAL_WINDOW_SECONDS,
    margin: float = THRESHOLD_MARGIN,
) -> np.ndarray:
    """Local mean of the flux over plus or minus `window_seconds`, plus a fixed margin."""
    half = max(1, int(round(window_seconds / frame_seconds)))
    kernel = np.ones(2 * half + 1) / (2 * half + 1)
    padded = np.pad(flux, (half, half), mode="edge")
    local_mean = np.convolve(padded, kernel, mode="valid")
    return (local_mean + margin).astype(np.float32)


def pick_peaks(
    flux: np.ndarray,
    threshold: np.ndarray,
    frame_seconds: float,
    min_gap_seconds: float = MIN_GAP_SECONDS,
) -> list[int]:
    """Frames where the flux is a local maximum above the threshold, at least `min_gap` apart."""
    gap = max(1, int(round(min_gap_seconds / frame_seconds)))
    candidates = []
    for t in range(len(flux)):
        if flux[t] <= threshold[t]:
            continue
        lo, hi = max(0, t - 2), min(len(flux), t + 3)
        if flux[t] >= np.max(flux[lo:hi]):
            candidates.append(t)
    picked: list[int] = []
    for t in candidates:
        if picked and t - picked[-1] < gap:
            if flux[t] > flux[picked[-1]]:
                picked[-1] = t
            continue
        picked.append(t)
    return picked


def dominant_pitch_track(spec: Spectrogram, max_hz: float = PITCH_MAX_HZ) -> np.ndarray:
    """Per frame, the loudest interpolated peak below `max_hz` in semitones (NaN when silent)."""
    track = np.full(len(spec.peaks), np.nan)
    for i, peaks in enumerate(spec.peaks):
        if len(peaks) == 0:
            continue
        low = peaks[peaks[:, 0] < max_hz]
        if len(low) == 0:
            continue
        f = float(low[0, 0])
        if f > 0:
            track[i] = 12.0 * np.log2(f / 440.0) + 69.0
    return track


def pitch_jump_onsets(spec: Spectrogram, existing_times: list[float]) -> list[float]:
    """Times where the dominant pitch moves by a semitone or more between two stable, loud runs.

    Stability on both sides (three frames each within half a semitone) and a loudness floor
    keep decays and silence, where the loudest peak wanders, from counting as onsets.
    """
    track = dominant_pitch_track(spec)
    loud = spec.mag_db.max(axis=1) > PITCH_LOUDNESS_DB
    frame_seconds = spec.frame_seconds
    found: list[float] = []
    hold = PITCH_HOLD_FRAMES
    for t in range(hold, len(track) - hold):
        before = track[t - hold : t]
        after = track[t : t + hold]
        if np.any(np.isnan(before)) or np.any(np.isnan(after)):
            continue
        if not (np.all(loud[t - hold : t + hold])):
            continue
        if np.ptp(before) >= 0.5 or np.ptp(after) >= 0.5:
            continue
        if abs(float(np.median(after)) - float(np.median(before))) < PITCH_JUMP_SEMITONES:
            continue
        time = t * frame_seconds
        if all(abs(time - e) >= PITCH_JUMP_GAP_SECONDS for e in existing_times + found):
            found.append(time)
    return found


def detect_onsets(
    audio: Audio, spec: Spectrogram | None = None, debug_name: str | None = None
) -> Onsets:
    """Run both detectors and merge them into sorted onset times.

    `spec` is the pitch-resolution spectrogram from the stft stage (computed here when not
    given); the flux timing always comes from a short window of its own.
    """
    short = frames(audio, n_fft=ONSET_N_FFT, hop=ONSET_HOP)
    frame_seconds = short.frame_seconds
    flux = spectral_flux(short)
    threshold = adaptive_threshold(flux, frame_seconds)
    peak_frames = pick_peaks(flux, threshold, frame_seconds)
    times = [f * frame_seconds for f in peak_frames]
    strengths = [float(flux[f]) for f in peak_frames]
    origins = ["flux"] * len(times)
    pitch_spec = spec if spec is not None else frames(audio)
    for t in pitch_jump_onsets(pitch_spec, times):
        times.append(t)
        strengths.append(float(flux[min(len(flux) - 1, int(round(t / frame_seconds)))]))
        origins.append("pitch")
    order = np.argsort(times)
    onsets = Onsets(
        times=np.array(times)[order] if times else np.zeros(0),
        strengths=np.array(strengths)[order] if strengths else np.zeros(0),
        flux=flux,
        threshold=threshold,
        frame_times=short.times,
        origins=np.array(origins, dtype=object)[order] if origins else np.zeros(0, dtype=object),
    )
    if debug_name and os.getenv("RIFFSPACED_DEBUG") == "1":
        save_debug_plot(pitch_spec, onsets, debug_name)
    return onsets


def save_debug_plot(spec: Spectrogram, onsets: Onsets, name: str) -> Path | None:
    """Spectrogram with onset lines, written to backend/debug/<name>_onsets.png."""
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        return None
    out_dir = Path(__file__).resolve().parents[2] / "debug"
    out_dir.mkdir(parents=True, exist_ok=True)
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 7), sharex=True)
    band = spec.freqs <= 2000
    ax1.imshow(
        spec.mag_db[:, band].T,
        origin="lower",
        aspect="auto",
        extent=(0, spec.times[-1] if len(spec.times) else 1, 0, 2000),
        cmap="magma",
    )
    for t in onsets.times:
        ax1.axvline(t, color="cyan", alpha=0.6, linewidth=0.8)
    ax1.set_ylabel("Hz")
    ax2.plot(onsets.frame_times, onsets.flux, label="flux")
    ax2.plot(onsets.frame_times, onsets.threshold, label="threshold")
    for t in onsets.times:
        ax2.axvline(t, color="cyan", alpha=0.6, linewidth=0.8)
    ax2.legend(loc="upper right")
    ax2.set_xlabel("seconds")
    path = out_dir / f"{name}_onsets.png"
    fig.tight_layout()
    fig.savefig(path, dpi=100)
    plt.close(fig)
    return path
