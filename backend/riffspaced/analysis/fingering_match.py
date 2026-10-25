"""Stage 7: fingering-constrained spectral template matching (SPEC 8.2 step 7, DECISIONS 21).

This is the owner's own method and the insight that makes fuzzed dyads tractable. Generic
pitch trackers ask "which frequencies are present" and get lost in the harmonics and
intermodulation that distortion piles onto two low strings. We ask a smaller question:
"of the few hundred things his hands can play on this tuning, which one sounds most like
this slice of audio". Every candidate shape has a predicted spectrum (harmonic combs with a
little inharmonicity, plus the intermodulation tones a tanh stage creates between two notes),
and the best candidate is the one whose predicted spectrum is most parallel to the observed
one. A flat "silence" template competes too, so gaps and dead notes are explicit.

Everything a later engineer might want to tune is a named constant at the top:
the harmonic count and roll-off, the inharmonicity coefficient `B`, the intermodulation
weight, the peak width, and the frequency weighting. See docs/ANALYSIS_METHOD.md.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import numpy as np

from riffspaced.analysis.onsets import Onsets
from riffspaced.analysis.stft import Spectrogram
from riffspaced.music.fingering import Position, hand_span
from riffspaced.music.pitch import freq_of
from riffspaced.music.tuning import Tuning, pitch_of

HARMONICS = 12
HARMONIC_ROLLOFF = 0.8
INHARMONICITY_B = 2e-4
INTERMOD_WEIGHT = 0.15
# 0.8 bins: at 1.5 the fundamentals of B1 and Db2 (7.6 Hz apart) blur together; the margin
# tests in test_fingering_match.py are how this was chosen.
PEAK_WIDTH_BINS = 0.8
BAND_LOW_HZ = 40.0
BAND_HIGH_HZ = 6000.0
ATTACK_SKIP_SECONDS = 0.02
PEAK_BONUS = 0.05
PEAK_TOLERANCE = 0.015
DEFAULT_STRINGS = (6, 5, 4, 3)
DEFAULT_MAX_FRET = 12
DEFAULT_MAX_SPAN = 4


@dataclass(frozen=True)
class Candidate:
    """A playable event: one or two positions (empty for silence) and their pitches."""

    positions: tuple[Position, ...]
    pitches: tuple[int, ...]

    @property
    def is_silence(self) -> bool:
        """The flat-noise candidate."""
        return len(self.positions) == 0

    @property
    def label(self) -> str:
        """`6:3+5:5` style name for reports and plots."""
        return (
            "silence"
            if self.is_silence
            else "+".join(f"{p.string}:{p.fret}" for p in self.positions)
        )


SILENCE = Candidate(positions=(), pitches=())


def enumerate_candidates(
    tuning: Tuning,
    max_fret: int = DEFAULT_MAX_FRET,
    strings: tuple[int, ...] = DEFAULT_STRINGS,
    max_span: int = DEFAULT_MAX_SPAN,
) -> list[Candidate]:
    """Singles per string, dyads on adjacent or one-apart strings within the span, plus silence."""
    strings = tuple(s for s in strings if 1 <= s <= tuning.string_count)
    out: list[Candidate] = [SILENCE]
    for s in strings:
        for f in range(max_fret + 1):
            out.append(Candidate((Position(s, f),), (pitch_of(tuning, s, f),)))
    for i, low in enumerate(strings):
        for high in strings[i + 1 :]:
            if low - high > 2:
                continue
            for f1 in range(max_fret + 1):
                for f2 in range(max_fret + 1):
                    positions = (Position(low, f1), Position(high, f2))
                    if hand_span(positions) > max_span:
                        continue
                    pitches = (pitch_of(tuning, low, f1), pitch_of(tuning, high, f2))
                    out.append(Candidate(positions, pitches))
    return out


def harmonic_frequencies(
    f0: float, count: int = HARMONICS, b: float = INHARMONICITY_B
) -> np.ndarray:
    """f_h = h f0 sqrt(1 + B h^2): stiff strings run slightly sharp in the upper partials."""
    h = np.arange(1, count + 1, dtype=np.float64)
    return h * f0 * np.sqrt(1.0 + b * h * h)


def frequency_weights(freqs: np.ndarray) -> np.ndarray:
    """Log-frequency weighting: linear bins over-represent the highs, so weight by 1 / sqrt(f)."""
    safe = np.maximum(freqs, 1.0)
    return 1.0 / np.sqrt(safe)


def _band(freqs: np.ndarray) -> np.ndarray:
    return (freqs >= BAND_LOW_HZ) & (freqs <= BAND_HIGH_HZ)


def _place_peaks(
    template: np.ndarray, freqs: np.ndarray, centers: np.ndarray, weights: np.ndarray, bin_hz: float
) -> None:
    sigma = PEAK_WIDTH_BINS * bin_hz
    for center, weight in zip(centers, weights, strict=True):
        if center <= 0 or center > freqs[-1]:
            continue
        lo = np.searchsorted(freqs, center - 4 * sigma)
        hi = np.searchsorted(freqs, center + 4 * sigma)
        window = freqs[lo:hi]
        template[lo:hi] += weight * np.exp(-0.5 * ((window - center) / sigma) ** 2)


@lru_cache(maxsize=4096)
def _predicted_spectrum_cached(pitches: tuple[int, ...], n_bins: int, bin_hz: float) -> np.ndarray:
    freqs = np.arange(n_bins) * bin_hz
    template = np.zeros(n_bins, dtype=np.float64)
    if not pitches:
        template[_band(freqs)] = 1.0
    else:
        weights = 1.0 / np.arange(1, HARMONICS + 1, dtype=np.float64) ** HARMONIC_ROLLOFF
        f0s = [freq_of(p) for p in pitches]
        for f0 in f0s:
            _place_peaks(template, freqs, harmonic_frequencies(f0), weights, bin_hz)
        if len(f0s) == 2:
            f1, f2 = f0s
            # Distortion mixes the two strings: difference and sum tones and the first cubic terms.
            intermod = np.array([abs(f1 - f2), f1 + f2, abs(2 * f1 - f2), abs(2 * f2 - f1)])
            _place_peaks(template, freqs, intermod, np.full(4, INTERMOD_WEIGHT), bin_hz)
        template[~_band(freqs)] = 0.0
    compressed = np.sqrt(template) * frequency_weights(freqs)
    norm = np.linalg.norm(compressed)
    return compressed / norm if norm > 0 else compressed


def predicted_spectrum(candidate: Candidate, freqs: np.ndarray) -> np.ndarray:
    """The candidate's template in the comparison domain.

    Square-root compressed, frequency weighted, unit norm.
    """
    bin_hz = float(freqs[1] - freqs[0]) if len(freqs) > 1 else 1.0
    return _predicted_spectrum_cached(candidate.pitches, len(freqs), bin_hz)


def observed_vector(magnitude: np.ndarray, freqs: np.ndarray) -> np.ndarray:
    """An observed linear-magnitude spectrum in the same comparison domain as the templates."""
    mag = np.where(_band(freqs), np.maximum(magnitude, 0.0), 0.0)
    compressed = np.sqrt(mag) * frequency_weights(freqs)
    norm = np.linalg.norm(compressed)
    return compressed / norm if norm > 0 else compressed


@dataclass(frozen=True)
class Segment:
    """One inter-onset slice: its median spectrum, its peaks, and its level."""

    start: float
    end: float
    spectrum: np.ndarray
    peaks: np.ndarray
    energy_db: float


def segment_spectra(
    spec: Spectrogram, onsets: Onsets, end_time: float | None = None
) -> list[Segment]:
    """Median magnitude per inter-onset segment, skipping the first 20 ms (the attack transient)."""
    times = list(onsets.times)
    if not times:
        return []
    last = end_time if end_time is not None else float(spec.times[-1]) + spec.frame_seconds
    bounds = [(t, times[i + 1] if i + 1 < len(times) else last) for i, t in enumerate(times)]
    top = float(np.max(spec.mag)) if spec.mag.size else 1.0
    segments: list[Segment] = []
    for start, end in bounds:
        lo = int(np.searchsorted(spec.times, start + ATTACK_SKIP_SECONDS))
        hi = int(np.searchsorted(spec.times, end))
        if hi <= lo:
            lo = int(np.clip(np.searchsorted(spec.times, start), 0, len(spec.times) - 1))
            hi = lo + 1
        block = spec.mag[lo:hi]
        spectrum = np.median(block, axis=0)
        middle = min(len(spec.peaks) - 1, (lo + hi) // 2)
        level = float(np.sqrt(np.mean(block**2))) / top if top > 0 else 0.0
        energy_db = 20 * np.log10(max(level, 1e-6))
        segments.append(Segment(start, end, spectrum, spec.peaks[middle], energy_db))
    return segments


def peak_bonus(candidate: Candidate, peaks: np.ndarray) -> float:
    """A small reward when a candidate's fundamentals appear as actual interpolated peaks."""
    if candidate.is_silence or len(peaks) == 0:
        return 0.0
    hits = 0
    for pitch in candidate.pitches:
        f0 = freq_of(pitch)
        if np.any(np.abs(peaks[:, 0] - f0) <= PEAK_TOLERANCE * f0):
            hits += 1
    return PEAK_BONUS * hits / len(candidate.pitches)


def score(observed: np.ndarray, predicted: np.ndarray) -> float:
    """Cosine similarity of two already-normalized comparison vectors."""
    return float(np.dot(observed, predicted))


def score_matrix(
    segments: list[Segment], candidates: list[Candidate], freqs: np.ndarray
) -> np.ndarray:
    """Similarity of every segment to every candidate, shape (segments, candidates)."""
    if not segments:
        return np.zeros((0, len(candidates)))
    templates = np.stack([predicted_spectrum(c, freqs) for c in candidates])
    observed = np.stack([observed_vector(s.spectrum, freqs) for s in segments])
    matrix = observed @ templates.T
    for i, seg in enumerate(segments):
        for j, cand in enumerate(candidates):
            if not cand.is_silence:
                matrix[i, j] += peak_bonus(cand, seg.peaks)
    return matrix
