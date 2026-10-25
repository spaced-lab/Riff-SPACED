"""Stage 2: band-limit (SPEC 8.2 step 2).

A low-tuned guitar's fundamentals start around 58 Hz (Bb1) and the useful harmonics for
pitch matching are below about 6 kHz; everything outside that band is rumble, hum, hiss,
and cabinet fizz that only adds noise to the onset detector and the spectral matcher.
A Butterworth filter applied forward and backward (`sosfiltfilt`) has zero phase shift,
so onsets stay exactly where they were.
"""

from __future__ import annotations

from dataclasses import replace

import numpy as np
from scipy.signal import butter, sosfiltfilt

from riffspaced.analysis.io import Audio

HIGHPASS_HZ = 35.0
LOWPASS_HZ = 6000.0
ORDER = 4


def bandlimit(
    samples: np.ndarray,
    sr: int,
    low_hz: float = HIGHPASS_HZ,
    high_hz: float = LOWPASS_HZ,
    order: int = ORDER,
) -> np.ndarray:
    """Zero-phase bandpass between `low_hz` and `high_hz`."""
    nyquist = sr / 2
    sos = butter(
        order,
        [low_hz / nyquist, min(high_hz, nyquist * 0.99) / nyquist],
        btype="bandpass",
        output="sos",
    )
    if len(samples) < 3 * order * 4:
        return samples.astype(np.float32)
    return sosfiltfilt(sos, samples).astype(np.float32)


def highpass_lowpass(
    audio: Audio, low_hz: float = HIGHPASS_HZ, high_hz: float = LOWPASS_HZ
) -> Audio:
    """The preprocess stage: returns a new Audio; the caller keeps the raw one for experiments."""
    return replace(audio, samples=bandlimit(audio.samples, audio.sr, low_hz, high_hz))
