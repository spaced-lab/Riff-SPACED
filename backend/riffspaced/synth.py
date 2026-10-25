"""Test-signal synth (SPEC 8.3, DECISIONS 19).

A riff JSON becomes a WAV the way the owner's rig would roughly make it, so the analysis
pipeline can be scored against known ground truth without his recordings.

Each note is a Karplus-Strong plucked string: a delay line one period long, seeded with a
burst of noise (the pick), fed back through a two-point average (the string losing its
highs) times a damping factor tuned so a Bb1 rings about 2.5 s open and 0.12 s palm-muted.
The voices are summed, pushed through `tanh(drive * x)` (the crude amp: odd harmonics plus
intermodulation between the two notes of a dyad, which is exactly what defeats naive pitch
trackers), low-passed at 4 kHz like a cabinet, and sprinkled with noise.

Run `python -m riffspaced.synth shared/fixtures/demo-library.json --riff "Walkdown Turnaround"
--out backend/debug/walkdown.wav --drive 8` to hear it.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from scipy.signal import butter, sosfilt

from riffspaced.analysis.io import save_wav
from riffspaced.music.pitch import freq_of
from riffspaced.music.time import TICKS_PER_BAR, TICKS_PER_BEAT, ticks_to_seconds
from riffspaced.music.tuning import Tuning, pitch_of

SR = 44100
RING_SECONDS = 2.5
PALM_MUTE_SECONDS = 0.12
LET_RING_TAIL = 2.5
NORMAL_TAIL = 0.25
PALM_TAIL = 0.15
CAB_LOWPASS_HZ = 4000.0
MIX_HEADROOM = 0.45
SILENCE_FLOOR_DB = -60.0


@dataclass(frozen=True)
class RenderedNote:
    """Ground truth for one rendered note: where it sounded and what it was."""

    note_id: str
    string: int
    fret: int
    pitch: int
    start_seconds: float
    duration_seconds: float
    palm_mute: bool


def damping_for(f0: float, ring_seconds: float) -> float:
    """Per-period feedback gain so the string falls 60 dB in `ring_seconds`."""
    periods = max(1.0, ring_seconds * f0)
    return float(0.001 ** (1.0 / periods))


def karplus_strong(
    f0: float,
    seconds: float,
    sr: int = SR,
    ring_seconds: float = RING_SECONDS,
    seed: int = 0,
    brightness: float = 0.3,
) -> np.ndarray:
    """One plucked string.

    Vectorized per period: block k of the output depends only on blocks k-1 and k-2, so each
    period is a numpy slice operation instead of a per-sample Python loop. A fractional delay
    (linear blend between two integer delays) keeps the pitch within a few cents.
    """
    length = sr / f0
    n = int(np.floor(length))
    frac = length - n
    if n < 2:
        raise ValueError(f"frequency {f0} Hz too high for sample rate {sr}")
    rho = damping_for(f0, ring_seconds)
    wanted = int(np.ceil(seconds * sr))
    # Two leading zeros so the taps at t-n-1 and t-n-2 never index before the buffer.
    pad = 2
    total = pad + wanted + 2 * n + 2
    y = np.zeros(total, dtype=np.float64)
    rng = np.random.default_rng(seed)
    noise = rng.uniform(-1.0, 1.0, n)
    # A real pluck has a roughly 1/h harmonic series, not white noise. Integrating the noise
    # (cumulative sum, trend removed) gives that 1/f tilt; `brightness` blends some of the
    # raw noise back in for a harder pick.
    integrated = np.cumsum(noise)
    integrated -= np.linspace(integrated[0], integrated[-1], n)
    integrated /= max(1e-9, np.max(np.abs(integrated)))
    pick = (1.0 - brightness * 0.5) * integrated + brightness * 0.5 * noise
    pick -= pick.mean()
    y[pad : pad + n] = pick
    # Period-by-period feedback:
    # y[t] = rho * ((1 - frac) * avg(y[t-n], y[t-n-1]) + frac * avg(y[t-n-1], y[t-n-2]))
    start = pad + n
    while start < total:
        end = min(total, start + n)
        a = y[start - n : end - n]
        b = y[start - n - 1 : end - n - 1]
        c = y[start - n - 2 : end - n - 2]
        y[start:end] = rho * ((1.0 - frac) * 0.5 * (a + b) + frac * 0.5 * (b + c))
        start = end
    return y[pad : pad + wanted].astype(np.float32)


def fade_out(samples: np.ndarray, sr: int, start_seconds: float, fade_seconds: float) -> np.ndarray:
    """Multiply by a linear fade beginning at `start_seconds`, so a note stops when it should."""
    out = samples.copy()
    i0 = int(start_seconds * sr)
    i1 = min(len(out), i0 + max(1, int(fade_seconds * sr)))
    if i0 >= len(out):
        return out
    out[i0:i1] *= np.linspace(1.0, 0.0, i1 - i0, dtype=np.float32)
    out[i1:] = 0.0
    return out


def amp(x: np.ndarray, drive: float, sr: int = SR) -> np.ndarray:
    """The crude amp: tanh waveshaping then a cabinet-ish lowpass."""
    shaped = np.tanh(drive * x) / np.tanh(drive) if drive > 0 else x
    sos = butter(2, CAB_LOWPASS_HZ / (sr / 2), btype="lowpass", output="sos")
    return sosfilt(sos, shaped).astype(np.float32)


def add_noise(x: np.ndarray, noise_db: float, seed: int = 1) -> np.ndarray:
    """White noise at `noise_db` relative to full scale."""
    if noise_db <= -200:
        return x
    rng = np.random.default_rng(seed)
    amplitude = 10 ** (noise_db / 20)
    return (x + rng.normal(0.0, amplitude, len(x))).astype(np.float32)


def render_riff(
    riff: dict[str, Any],
    sr: int = SR,
    drive: float = 6.0,
    noise_db: float = -60.0,
    voice: str = "ks",
    seed: int = 0,
) -> tuple[np.ndarray, list[RenderedNote]]:
    """Render a riff dict to float32 samples. Returns the audio and the ground-truth events."""
    if voice != "ks":
        raise ValueError(f"unknown voice {voice!r}; only 'ks' exists")
    tuning = Tuning.from_dict(riff["tuning"])
    bpm = float(riff["tempo"]["bpm"])
    length_seconds = ticks_to_seconds(riff["lengthBars"] * TICKS_PER_BAR, bpm)
    total = int(np.ceil((length_seconds + LET_RING_TAIL) * sr))
    mix = np.zeros(total, dtype=np.float32)
    truth: list[RenderedNote] = []
    for i, note in enumerate(riff["notes"]):
        if note.get("unplayable"):
            continue
        techniques = set(note.get("techniques", []))
        pitch = pitch_of(tuning, note["string"], note["fret"])
        f0 = freq_of(pitch)
        start = ticks_to_seconds(note["start"], bpm)
        duration = ticks_to_seconds(note["duration"], bpm)
        palm = "palmMute" in techniques
        velocity = note.get("velocity", 100) / 127.0
        if "dead" in techniques:
            rng = np.random.default_rng(seed + i)
            burst = rng.uniform(-1, 1, int(0.04 * sr)).astype(np.float32) * np.linspace(
                1, 0, int(0.04 * sr), dtype=np.float32
            )
            tone = burst * 0.5
        else:
            tail = (
                PALM_TAIL if palm else (LET_RING_TAIL if "letRing" in techniques else NORMAL_TAIL)
            )
            ring = PALM_MUTE_SECONDS if palm else RING_SECONDS
            tone = karplus_strong(f0, duration + tail, sr, ring, seed=seed + i)
            if "letRing" not in techniques and not palm:
                tone = fade_out(tone, sr, duration, 0.03)
        i0 = int(round(start * sr))
        i1 = min(total, i0 + len(tone))
        mix[i0:i1] += tone[: i1 - i0] * velocity
        truth.append(
            RenderedNote(note["id"], note["string"], note["fret"], pitch, start, duration, palm)
        )
    peak = float(np.max(np.abs(mix))) if len(mix) else 0.0
    if peak > 0:
        mix *= MIX_HEADROOM / peak
    out = amp(mix, drive, sr)
    out = add_noise(out, noise_db, seed + 1000)
    peak = float(np.max(np.abs(out)))
    if peak > 0:
        out *= 0.9 / peak
    return out.astype(np.float32), truth


def render_click_track(bpm: float, bars: int, sr: int = SR) -> np.ndarray:
    """Clicks on every beat, louder on the downbeat; the tempo stage's simplest test input."""
    seconds = ticks_to_seconds(bars * TICKS_PER_BAR, bpm)
    out = np.zeros(int(np.ceil(seconds * sr)) + sr // 10, dtype=np.float32)
    rng = np.random.default_rng(7)
    click = rng.uniform(-1, 1, int(0.005 * sr)).astype(np.float32) * np.linspace(
        1, 0, int(0.005 * sr), dtype=np.float32
    )
    for beat in range(bars * 4):
        t = ticks_to_seconds(beat * TICKS_PER_BEAT, bpm)
        i0 = int(round(t * sr))
        gain = 1.0 if beat % 4 == 0 else 0.5
        out[i0 : i0 + len(click)] += click * gain
    return out


def _main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Render a riff from a library or riff JSON to WAV with the test synth."
    )
    parser.add_argument("source", help="a .riff.json or a library bundle")
    parser.add_argument("--riff", help="riff name when the source is a library bundle")
    parser.add_argument("--out", required=True, help="output WAV path")
    parser.add_argument("--drive", type=float, default=6.0)
    parser.add_argument("--noise-db", type=float, default=-60.0)
    parser.add_argument("--sr", type=int, default=SR)
    args = parser.parse_args(argv)
    doc = json.loads(Path(args.source).read_text())
    if doc.get("format") == "riff-spaced/library":
        riffs = doc["riffs"]
        riff = next((r for r in riffs if r["name"] == args.riff), None) if args.riff else riffs[0]
        if riff is None:
            names = ", ".join(r["name"] for r in riffs)
            parser.error(f"no riff named {args.riff!r}; available: {names}")
    else:
        riff = doc
    audio, truth = render_riff(riff, sr=args.sr, drive=args.drive, noise_db=args.noise_db)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    save_wav(out, audio, args.sr)
    seconds = len(audio) / args.sr
    summary = f"{seconds:.2f} s, {len(truth)} notes, drive {args.drive}, noise {args.noise_db} dB"
    print(f"wrote {out} ({summary})")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
