"""Stage 5: tempo (SPEC 8.2 step 5).

The onset strength envelope (the flux from the onset stage) is periodic at the beat and
its subdivisions. Its autocorrelation has peaks at those periods; the lag of the strongest
peak between 40 and 220 BPM is the tempo candidate. Two refinements matter for riffs:

- The tatum first. The shortest strong autocorrelation period is the smallest note value
  being played (eighths in most of the owner's riffs). In 4/4 the beat is that period times
  1, 2, 4 or 8, never 3, so only those multiples are candidates; this is what stops an
  eighth-note stream from reading as a tempo three eighths long.
- A mild prior around 70 to 140 BPM picks among the multiples. Eighth-note chugs at 92 BPM
  also correlate at 184; the prior is what keeps the musically sensible reading on top.
- Alignment as a tie-breaker: how many detected onsets land within 25 ms of the best-phased
  beat grid.

The user can always override the BPM in the import dialog; the chosen value is stored in
`source.bpmDetected` and `tempo.bpm` by the emit stage.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from riffspaced.analysis.onsets import Onsets

MIN_BPM = 40.0
MAX_BPM = 220.0
PRIOR_CENTER_BPM = 100.0
PRIOR_WIDTH_OCTAVES = 0.7
ALIGN_WINDOW_SECONDS = 0.025
TATUM_STRENGTH = 0.6
BEAT_MULTIPLES = (1, 2, 4, 8)
# A period that is not a binary multiple of the tatum (three eighths, say) is implausible in
# 4/4 (DECISIONS 1); it stays listed as a candidate but scored down.
OFF_GRID_PENALTY = 0.4


@dataclass(frozen=True)
class TempoCandidate:
    """A BPM with its combined score and the pieces it was built from."""

    bpm: float
    score: float
    autocorrelation: float
    alignment: float


@dataclass(frozen=True)
class TempoEstimate:
    """Top candidates, best first."""

    candidates: list[TempoCandidate]

    @property
    def bpm(self) -> float:
        """The best BPM, or 92 when nothing could be measured."""
        return self.candidates[0].bpm if self.candidates else 92.0


def prior(bpm: float) -> float:
    """Gaussian in log-tempo around 100 BPM: gentle, about 0.6 at 60 and 160."""
    octaves = np.log2(bpm / PRIOR_CENTER_BPM)
    return float(np.exp(-0.5 * (octaves / PRIOR_WIDTH_OCTAVES) ** 2))


def autocorrelation(signal: np.ndarray, max_lag: int) -> np.ndarray:
    """Normalized autocorrelation r[lag] for lag in 0..max_lag, mean removed."""
    x = signal.astype(np.float64) - float(np.mean(signal))
    n = len(x)
    if n == 0 or float(np.dot(x, x)) == 0.0:
        return np.zeros(max_lag + 1)
    size = 1 << int(np.ceil(np.log2(2 * n)))
    spectrum = np.fft.rfft(x, size)
    full = np.fft.irfft(spectrum * np.conj(spectrum), size)[: max_lag + 1]
    return full / full[0]


def alignment_score(
    onset_times: np.ndarray, bpm: float, window: float = ALIGN_WINDOW_SECONDS
) -> float:
    """Fraction of onsets within `window` of a beat, at the best grid phase."""
    if len(onset_times) == 0:
        return 0.0
    period = 60.0 / bpm
    phases = np.mod(onset_times, period)
    # Try each onset's phase as the grid phase and keep the best; cheap for a few hundred onsets.
    best = 0.0
    for candidate in np.unique(np.round(phases, 4)):
        d = np.abs(phases - candidate)
        d = np.minimum(d, period - d)
        best = max(best, float(np.mean(d <= window)))
    return best


def _local_maxima(values: np.ndarray, lags: np.ndarray) -> list[tuple[float, float]]:
    """(strength, refined lag) for every local maximum above zero, strongest first."""
    peaks = []
    for i in range(1, len(values) - 1):
        if values[i] > values[i - 1] and values[i] >= values[i + 1] and values[i] > 0:
            a, b, c = values[i - 1], values[i], values[i + 1]
            denom = a - 2 * b + c
            delta = 0.5 * (a - c) / denom if abs(denom) > 1e-12 else 0.0
            peaks.append((float(b), float(lags[i] + delta)))
    peaks.sort(reverse=True)
    return peaks


def estimate_tempo(
    onsets: Onsets, frame_seconds: float | None = None, top: int = 3
) -> TempoEstimate:
    """Tatum-based tempo candidates with prior and alignment, best first."""
    flux = onsets.flux
    if frame_seconds is None:
        frame_seconds = (
            float(onsets.frame_times[1] - onsets.frame_times[0])
            if len(onsets.frame_times) > 1
            else 256 / 44100
        )
    # Search lags down to the fastest plausible subdivision (an eighth at 220 BPM).
    min_lag = max(1, int(np.floor(60.0 / MAX_BPM / 2 / frame_seconds)))
    max_lag = int(np.ceil(60.0 / MIN_BPM / frame_seconds))
    if len(flux) <= max_lag + 2:
        max_lag = max(min_lag + 2, len(flux) - 2)
    r = autocorrelation(flux, max_lag)
    lags = np.arange(min_lag, max_lag + 1)
    if len(lags) < 3:
        return TempoEstimate([])
    values = r[min_lag : max_lag + 1]
    peaks = _local_maxima(values, lags)
    if not peaks:
        return TempoEstimate([])
    strongest = peaks[0][0]
    tatum_lag = min(lag for strength, lag in peaks if strength >= TATUM_STRENGTH * strongest)

    def r_at(lag: float) -> float:
        return float(np.interp(lag, lags, values))

    def candidate(bpm: float, strength: float, penalty: float = 1.0) -> TempoCandidate:
        align = alignment_score(onsets.times, bpm)
        score = max(0.0, strength) * prior(bpm) * (0.5 + 0.5 * align) * penalty
        return TempoCandidate(round(bpm, 2), round(score, 4), round(strength, 4), round(align, 3))

    found: list[TempoCandidate] = []
    for multiple in BEAT_MULTIPLES:
        lag = tatum_lag * multiple
        bpm = 60.0 / (lag * frame_seconds)
        if MIN_BPM <= bpm <= MAX_BPM and lag <= max_lag:
            found.append(candidate(bpm, r_at(lag)))
    # Other autocorrelation peaks fill the remaining slots, so an odd meter still shows up.
    for strength, lag in peaks:
        bpm = 60.0 / (lag * frame_seconds)
        if MIN_BPM <= bpm <= MAX_BPM and all(abs(bpm - c.bpm) >= 1.0 for c in found):
            found.append(candidate(bpm, strength, OFF_GRID_PENALTY))
    found.sort(key=lambda c: c.score, reverse=True)
    return TempoEstimate(found[:top])
