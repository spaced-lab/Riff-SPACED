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

# 24 harmonics so a low note's template covers the band it actually fills under distortion;
# with 12 the uncovered highs rewarded any template that had extra lines.
HARMONICS = 24
HARMONIC_ROLLOFF = 0.8
# Stiffness coefficient. 2e-5 is small; the test synth is perfectly harmonic and real heavy
# strings may want more (SPEC says 2e-4). Tune against recordings, not the synth.
INHARMONICITY_B = 2e-5
INTERMOD_WEIGHT = 0.15
# 0.8 bins: at 1.5 the fundamentals of B1 and Db2 (7.6 Hz apart) blur together; the margin
# tests in test_fingering_match.py are how this was chosen.
PEAK_WIDTH_BINS = 0.8
BAND_LOW_HZ = 40.0
BAND_HIGH_HZ = 2500.0
ATTACK_SKIP_SECONDS = 0.02
PEAK_BONUS = 0.08
# Peak tolerance in cents (plus a 2 Hz floor for the lowest notes, where a few cents is less
# than the interpolation error).
PEAK_TOLERANCE_CENTS = 35.0
PEAK_TOLERANCE_FLOOR_HZ = 2.0
# Spectral floor removal: the percentile of a segment's own spectrum treated as noise.
FLOOR_PERCENTILE = 20.0
# How many frames at the end of the previous segment stand for "what was already ringing".
TAIL_FRAMES = 4
# Peaks are gathered from this many of the loudest post-attack frames of a segment.
PEAK_FRAMES = 3
# What is new in a slice is identified from its first NOVEL_WINDOW_SECONDS after the attack
# skip, as the mean over the loud frames: a short muted note next to a long ringing one
# vanishes from a median over the whole slice, but survives a mean over the opening. The
# sweep that chose these values (window 0, 0.1, 0.25, 0.3, 0.5; mean vs median; loud only)
# is in the P6.T6 commit message.
NOVEL_WINDOW_SECONDS = 0.3
# Statistic over the identification frames: 'median' resists transients, 'mean' keeps a short
# note that shares the slice with a long one.
NOVEL_STATISTIC = "mean"
# Restrict identification to frames carrying at least a quarter of the slice's peak energy.
NOVEL_LOUD_ONLY = True
# The peak bonus checks these harmonics of each candidate pitch against the gathered peaks.
# Interpolated peaks resolve a few cents, far finer than the bins, so this is what tells
# neighboring frets apart on the low strings.
BONUS_HARMONICS = 6
# Occam: a second note has to earn its place. Subtracted from every dyad score.
DYAD_PENALTY = 0.01
# Tried and rejected: penalizing a pitch whose fundamental is not among the top peaks. Under
# distortion the top-24 peak list is often all upper partials and intermodulation, so real
# second notes were punished (dyad accuracy fell from 0.54 to 0.13). Kept as a note so the next
# person does not repeat it; the cosine score already encodes support through the comb.
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
    """One inter-onset slice.

    `spectrum` is what is new in the slice (its spectrum minus the tail of the previous
    slice, floor removed): that is what the matcher identifies. `full_spectrum` is the slice
    as heard, used afterwards to decide whether the previous notes are still ringing.
    """

    start: float
    end: float
    spectrum: np.ndarray
    full_spectrum: np.ndarray
    peaks: np.ndarray
    energy_db: float


def remove_floor(spectrum: np.ndarray, percentile: float = FLOOR_PERCENTILE) -> np.ndarray:
    """Subtract the segment's own noise floor.

    Broadband pick noise would otherwise reward templates with more lines.
    """
    floor = float(np.percentile(spectrum, percentile)) if spectrum.size else 0.0
    return np.maximum(spectrum - floor, 0.0)


def segment_spectra(
    spec: Spectrogram, onsets: Onsets, end_time: float | None = None
) -> list[Segment]:
    """Per inter-onset segment: the new spectrum, the full spectrum, peaks, and level."""
    times = list(onsets.times)
    if not times:
        return []
    last = end_time if end_time is not None else float(spec.times[-1]) + spec.frame_seconds
    bounds = [(t, times[i + 1] if i + 1 < len(times) else last) for i, t in enumerate(times)]
    # Level reference: the loudest frame's RMS, so a full-level note reads near 0 dB.
    frame_rms = np.sqrt(np.mean(spec.mag**2, axis=1)) if spec.mag.size else np.zeros(1)
    top = float(np.max(frame_rms)) if frame_rms.size else 1.0
    segments: list[Segment] = []
    previous_tail = np.zeros(spec.mag.shape[1])
    for start, end in bounds:
        lo = int(np.searchsorted(spec.times, start + ATTACK_SKIP_SECONDS))
        hi = int(np.searchsorted(spec.times, end))
        if hi <= lo:
            lo = int(np.clip(np.searchsorted(spec.times, start), 0, len(spec.times) - 1))
            hi = lo + 1
        block = spec.mag[lo:hi]
        # A palm-muted sixteenth is silent for most of its slot; take the median over the
        # frames that still carry at least a quarter of the segment's peak energy.
        frame_energy = np.sqrt(np.mean(block**2, axis=1))
        loud = (
            frame_energy >= 0.25 * float(np.max(frame_energy))
            if len(frame_energy)
            else np.ones(0, bool)
        )
        full = np.median(block[loud] if np.any(loud) else block, axis=0)
        # Identification uses the opening of the slice, where every new note is still present.
        window = (
            int(round(NOVEL_WINDOW_SECONDS / spec.frame_seconds))
            if NOVEL_WINDOW_SECONDS
            else len(block)
        )
        opening = block[: max(1, window)]
        if NOVEL_LOUD_ONLY and len(opening):
            open_energy = np.sqrt(np.mean(opening**2, axis=1))
            keep = open_energy >= 0.25 * float(np.max(open_energy))
            opening = opening[keep] if np.any(keep) else opening
        reduce = np.mean if NOVEL_STATISTIC == "mean" else np.median
        novel = remove_floor(np.maximum(reduce(opening, axis=0) - previous_tail, 0.0))
        loudest = lo + int(np.argmax(frame_energy)) if len(frame_energy) else lo
        level = float(np.max(frame_energy)) / top if top > 0 and len(frame_energy) else 0.0
        energy_db = 20 * np.log10(max(level, 1e-6))
        segments.append(
            Segment(
                start,
                end,
                novel,
                remove_floor(full),
                spec.peaks[min(loudest, len(spec.peaks) - 1)],
                energy_db,
            )
        )
        tail_lo = max(lo, hi - TAIL_FRAMES)
        previous_tail = (
            np.median(spec.mag[tail_lo:hi], axis=0) if hi > tail_lo else np.zeros(spec.mag.shape[1])
        )
    return segments


def peak_bonus(candidate: Candidate, peaks: np.ndarray) -> float:
    """Reward candidates whose first harmonics appear as actual interpolated peaks.

    The fraction of the candidate's harmonics 1..BONUS_HARMONICS (per pitch) found within
    PEAK_TOLERANCE_CENTS of a gathered peak, times PEAK_BONUS.
    """
    if candidate.is_silence or len(peaks) == 0:
        return 0.0
    ratio = 2 ** (PEAK_TOLERANCE_CENTS / 1200) - 1
    peak_freqs = peaks[:, 0]
    hits = 0
    total = 0
    for pitch in candidate.pitches:
        f0 = freq_of(pitch)
        for h in range(1, BONUS_HARMONICS + 1):
            target = h * f0
            if target > BAND_HIGH_HZ:
                break
            total += 1
            tol = max(PEAK_TOLERANCE_FLOOR_HZ, target * ratio)
            if np.any(np.abs(peak_freqs - target) <= tol):
                hits += 1
    return PEAK_BONUS * hits / total if total else 0.0


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
    dyad = np.array([DYAD_PENALTY if len(c.positions) > 1 else 0.0 for c in candidates])
    matrix -= dyad[None, :]
    for i, seg in enumerate(segments):
        for j, cand in enumerate(candidates):
            if not cand.is_silence:
                matrix[i, j] += peak_bonus(cand, seg.peaks)
    return matrix


def sustain_evidence(
    full_spectrum: np.ndarray, new: Candidate, previous: Candidate, freqs: np.ndarray
) -> float:
    """How much better the slice is explained with the previous pitches still ringing.

    Positive means the union template fits the full spectrum better than the new event alone,
    so the earlier notes should be extended through this slice.
    """
    union_pitches = tuple(sorted(set(new.pitches) | set(previous.pitches)))
    if union_pitches == tuple(sorted(new.pitches)):
        return 0.0
    observed = observed_vector(full_spectrum, freqs)
    alone = score(observed, predicted_spectrum(new, freqs))
    together = score(
        observed,
        predicted_spectrum(Candidate(new.positions + previous.positions, union_pitches), freqs),
    )
    return together - alone
