"""Stage 9: quantize (SPEC 8.2 step 9).

Onset times in seconds become ticks on a sixteenth grid at the chosen tempo. The downbeat
is the grid phase that puts the most onset energy on beats 1 and 3. Durations run to the
next onset (or the segment end for the last one), clipped to the grid. A note is palm-muted
when its level falls more than 20 dB within 120 ms of its peak. Everything that does not sit
within 45 percent of a sixteenth of a grid line still snaps, but loses confidence.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from riffspaced.analysis.fingering_match import Candidate, Segment, sustain_evidence
from riffspaced.analysis.stft import Spectrogram
from riffspaced.music.time import PPQ, TICKS_PER_BAR, TICKS_PER_BEAT, seconds_to_ticks

SIXTEENTH = PPQ // 4
SNAP_TOLERANCE = 0.45
PALM_MUTE_DROP_DB = 20.0
PALM_MUTE_WINDOW_SECONDS = 0.12
LOOP_LENGTHS = (4, 8, 12, 16)


@dataclass(frozen=True)
class QuantizedEvent:
    """A decoded, grid-aligned event: a candidate at a tick for a duration."""

    candidate: Candidate
    start_tick: int
    duration_ticks: int
    velocity: int
    palm_mute: bool
    confidence: float
    start_seconds: float
    segment_index: int = -1


SUSTAIN_MARGIN = 0.01


def downbeat_offset(onset_times: np.ndarray, strengths: np.ndarray, bpm: float) -> float:
    """Grid phase in seconds that puts the most onset energy on beats 1 and 3."""
    if len(onset_times) == 0:
        return 0.0
    beat = 60.0 / bpm
    bar = 4 * beat
    sixteenth = beat / 4
    best_offset, best_energy = 0.0, -1.0
    for k in range(16):
        offset = k * sixteenth
        phase = np.mod(onset_times - offset, bar)
        on_strong = (
            (np.abs(phase) < sixteenth * SNAP_TOLERANCE)
            | (np.abs(phase - 2 * beat) < sixteenth * SNAP_TOLERANCE)
            | (np.abs(phase - bar) < sixteenth * SNAP_TOLERANCE)
        )
        energy = float(np.sum(strengths[on_strong]))
        if energy > best_energy + 1e-9:
            best_offset, best_energy = offset, energy
    # Prefer the earliest offset that explains the first onset; never start before it.
    return (
        best_offset
        if best_offset <= onset_times[0] + 1e-9
        else float(np.mod(best_offset, sixteenth))
    )


def level_envelope(spec: Spectrogram) -> np.ndarray:
    """Per-frame level in dB relative to the loudest frame."""
    energy = np.sqrt(np.mean(spec.mag**2, axis=1))
    top = float(np.max(energy)) if len(energy) else 1.0
    return 20 * np.log10(np.maximum(energy / top, 1e-6)) if top > 0 else np.zeros(len(energy))


def is_palm_muted(envelope_db: np.ndarray, frame_seconds: float, start: float, end: float) -> bool:
    """True when the level drops more than 20 dB within 120 ms of its peak inside the segment."""
    lo = int(np.searchsorted(np.arange(len(envelope_db)) * frame_seconds, start))
    hi = min(len(envelope_db), int(np.ceil(end / frame_seconds)))
    if hi - lo < 2:
        return False
    seg = envelope_db[lo:hi]
    peak_i = int(np.argmax(seg))
    look = min(len(seg) - 1, peak_i + int(round(PALM_MUTE_WINDOW_SECONDS / frame_seconds)))
    if look <= peak_i:
        return False
    return bool(seg[peak_i] - np.min(seg[peak_i : look + 1]) >= PALM_MUTE_DROP_DB)


def velocity_from_db(energy_db: float) -> int:
    """Map -30..0 dB to 40..127."""
    v = 40 + (max(-30.0, min(0.0, energy_db)) + 30.0) / 30.0 * 87
    return int(round(v))


def merge_settling_segments(
    segments: list[Segment],
    path: list[int],
    confidences: list[float],
    candidates: list[Candidate],
    origins: np.ndarray | None,
) -> tuple[list[Segment], list[int], list[float]]:
    """Drop a pitch-jump segment that decoded to the same pitches as the one before it.

    The pitch-jump detector fires when a chord settles (one string speaks a little late); if
    the decoder then hears the same thing, it was one event, so the first segment absorbs it.
    """
    if origins is None or len(origins) != len(segments):
        return segments, path, confidences
    out_s: list[Segment] = []
    out_p: list[int] = []
    out_c: list[float] = []
    for seg, j, c, origin in zip(segments, path, confidences, origins, strict=True):
        if (
            out_s
            and origin == "pitch"
            and set(candidates[j].pitches) == set(candidates[out_p[-1]].pitches)
        ):
            prev = out_s[-1]
            out_s[-1] = Segment(
                prev.start, seg.end, prev.spectrum, prev.peaks, max(prev.energy_db, seg.energy_db)
            )
            continue
        out_s.append(seg)
        out_p.append(j)
        out_c.append(c)
    return out_s, out_p, out_c


def merge_sustained(
    events: list[QuantizedEvent], segments: list[Segment], freqs: np.ndarray
) -> list[QuantizedEvent]:
    """Extend notes that are still ringing through the next event instead of re-emitting them.

    The walkdown is the model case: Ab2 rings for a bar while the low string walks down. The
    matcher identifies only what is new in each slice; whether the earlier notes are still
    sounding is decided by evidence (`sustain_evidence` on the slice's full spectrum). A
    palm-muted note is gone within 120 ms and is never extended.
    """
    out: list[QuantizedEvent] = []
    for e in events:
        if not out:
            out.append(e)
            continue
        # Walk back over notes that may still be ringing (not palm-muted, not yet ended).
        for k in range(len(out) - 1, max(-1, len(out) - 4), -1):
            prev = out[k]
            if prev.palm_mute or prev.start_tick + prev.duration_ticks < e.start_tick:
                continue
            if set(prev.candidate.positions) & set(e.candidate.positions):
                continue
            seg = segments[e.segment_index] if 0 <= e.segment_index < len(segments) else None
            if seg is None:
                continue
            if (
                sustain_evidence(seg.full_spectrum, e.candidate, prev.candidate, freqs)
                > SUSTAIN_MARGIN
            ):
                out[k] = QuantizedEvent(
                    candidate=prev.candidate,
                    start_tick=prev.start_tick,
                    duration_ticks=max(
                        prev.duration_ticks, e.start_tick + e.duration_ticks - prev.start_tick
                    ),
                    velocity=prev.velocity,
                    palm_mute=prev.palm_mute,
                    confidence=prev.confidence,
                    start_seconds=prev.start_seconds,
                    segment_index=prev.segment_index,
                )
        out.append(e)
    return out


def quantize(
    segments: list[Segment],
    candidates: list[Candidate],
    path: list[int],
    confidences: list[float],
    bpm: float,
    spec: Spectrogram,
    onset_strengths: np.ndarray,
    origins: np.ndarray | None = None,
) -> tuple[list[QuantizedEvent], float]:
    """Snap decoded segments to the grid. Returns events and the downbeat offset in seconds."""
    if not segments:
        return [], 0.0
    segments, path, confidences = merge_settling_segments(
        segments, path, confidences, candidates, origins
    )
    times = np.array([s.start for s in segments])
    offset = downbeat_offset(times, np.asarray(onset_strengths, dtype=float), bpm)
    envelope = level_envelope(spec)
    sixteenth_seconds = 60.0 / bpm / 4
    events: list[QuantizedEvent] = []
    starts = []
    for seg in segments:
        raw = seconds_to_ticks(seg.start - offset, bpm)
        snapped = int(round(raw / SIXTEENTH)) * SIXTEENTH
        starts.append(max(0, snapped))
    for i, (seg, j) in enumerate(zip(segments, path, strict=True)):
        cand = candidates[j]
        if cand.is_silence:
            continue
        start = starts[i]
        next_start = next((starts[k] for k in range(i + 1, len(starts)) if starts[k] > start), None)
        seg_end_ticks = int(round(seconds_to_ticks(seg.end - offset, bpm)))
        end = min(next_start, seg_end_ticks) if next_start is not None else seg_end_ticks
        duration = max(SIXTEENTH, int(round((end - start) / SIXTEENTH)) * SIXTEENTH)
        off_grid = (
            abs((seg.start - offset) - start / PPQ * 60 / bpm) > SNAP_TOLERANCE * sixteenth_seconds
        )
        confidence = max(0.0, confidences[i] - (0.2 if off_grid else 0.0))
        events.append(
            QuantizedEvent(
                candidate=cand,
                start_tick=start,
                duration_ticks=duration,
                velocity=velocity_from_db(seg.energy_db),
                palm_mute=is_palm_muted(envelope, spec.frame_seconds, seg.start, seg.end),
                confidence=round(confidence, 3),
                start_seconds=seg.start,
                segment_index=i,
            )
        )
    return merge_sustained(events, segments, spec.freqs), offset


def loop_length_bars(events: list[QuantizedEvent]) -> int:
    """Round the content up to 4, 8, 12 or 16 bars (then multiples of 4).

    Length follows where notes *start*: the ring of the final note (a held chord decaying
    into the next pass) must not add a bar. Durations are clipped to the loop end by emit.
    """
    if not events:
        return 4
    last_start = max(e.start_tick for e in events)
    bars = int(np.ceil((last_start + 1) / TICKS_PER_BAR))
    for n in LOOP_LENGTHS:
        if bars <= n:
            return n
    return int(np.ceil(bars / 4) * 4)


def ticks_per_beat() -> int:
    """Exported for callers that want the grid constants in one place."""
    return TICKS_PER_BEAT
