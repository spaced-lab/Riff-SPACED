"""Stage 3: frames (SPEC 8.2 step 3).

A short-time Fourier transform with a 4096-point Hann window and a 512-sample hop. The
long window is forced by the music: Bb1 is 58.3 Hz and the bin spacing at 4096 points is
10.8 Hz, so a shorter window could not tell adjacent low frets apart. The hop keeps the time
resolution at 11.6 ms, which is finer than the 30 ms the onset scorer tolerates.

Magnitudes are kept in dB with a floor 80 dB under the loudest bin, and each frame also gets
a short list of interpolated spectral peaks: a parabola through the three bins around a local
maximum gives a frequency estimate far finer than the bin spacing (quadratic interpolation
on a log-magnitude spectrum, the standard trick).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from riffspaced.analysis.io import Audio

N_FFT = 4096
HOP = 512
DB_FLOOR = -80.0
MAX_PEAKS = 24
PEAK_FLOOR_DB = -45.0


@dataclass(frozen=True)
class Spectrogram:
    """Magnitude spectrogram plus interpolated peaks per frame."""

    mag: np.ndarray
    """Linear magnitude, shape (frames, bins)."""
    mag_db: np.ndarray
    """dB relative to the loudest bin, floored at DB_FLOOR, shape (frames, bins)."""
    freqs: np.ndarray
    """Bin center frequencies in Hz, shape (bins,)."""
    times: np.ndarray
    """Frame center times in seconds, shape (frames,)."""
    peaks: list[np.ndarray]
    """Per frame, an array of (frequency_hz, magnitude_db) rows, loudest first."""
    sr: int
    hop: int
    n_fft: int

    @property
    def frame_seconds(self) -> float:
        """Seconds between frames."""
        return self.hop / self.sr


def frame_signal(samples: np.ndarray, n_fft: int, hop: int) -> np.ndarray:
    """Centered frames: the signal is padded by n_fft / 2 so frame t is centered at t * hop."""
    padded = np.pad(samples, (n_fft // 2, n_fft // 2), mode="constant")
    count = 1 + (len(padded) - n_fft) // hop
    if count <= 0:
        return np.zeros((1, n_fft), dtype=np.float32)
    strides = (padded.strides[0] * hop, padded.strides[0])
    return np.lib.stride_tricks.as_strided(padded, shape=(count, n_fft), strides=strides).copy()


def interpolated_peaks(
    spectrum_db: np.ndarray,
    freqs: np.ndarray,
    max_peaks: int = MAX_PEAKS,
    floor_db: float = PEAK_FLOOR_DB,
) -> np.ndarray:
    """Local maxima above `floor_db`, parabolically refined.

    `floor_db` is relative to the frame's loudest bin.
    """
    if len(spectrum_db) < 3:
        return np.zeros((0, 2))
    top = float(np.max(spectrum_db))
    inner = spectrum_db[1:-1]
    is_peak = (inner > spectrum_db[:-2]) & (inner >= spectrum_db[2:]) & (inner > top + floor_db)
    idx = np.nonzero(is_peak)[0] + 1
    if len(idx) == 0:
        return np.zeros((0, 2))
    a = spectrum_db[idx - 1]
    b = spectrum_db[idx]
    c = spectrum_db[idx + 1]
    denom = a - 2 * b + c
    delta = np.where(
        np.abs(denom) > 1e-9, 0.5 * (a - c) / np.where(np.abs(denom) > 1e-9, denom, 1.0), 0.0
    )
    bin_hz = freqs[1] - freqs[0]
    freq = freqs[idx] + delta * bin_hz
    height = b - 0.25 * (a - c) * delta
    order = np.argsort(height)[::-1][:max_peaks]
    return np.column_stack([freq[order], height[order]])


def frames(audio: Audio, n_fft: int = N_FFT, hop: int = HOP) -> Spectrogram:
    """Compute the spectrogram and per-frame peaks."""
    window = np.hanning(n_fft).astype(np.float32)
    framed = frame_signal(audio.samples.astype(np.float32), n_fft, hop)
    mag = np.abs(np.fft.rfft(framed * window, axis=1)).astype(np.float32)
    top = float(np.max(mag)) if mag.size else 1.0
    top = top if top > 0 else 1.0
    mag_db = (20.0 * np.log10(np.maximum(mag / top, 10 ** (DB_FLOOR / 20)))).astype(np.float32)
    freqs = np.fft.rfftfreq(n_fft, 1.0 / audio.sr)
    times = np.arange(mag.shape[0]) * hop / audio.sr
    peaks = [interpolated_peaks(row, freqs) for row in mag_db]
    return Spectrogram(
        mag=mag,
        mag_db=mag_db,
        freqs=freqs,
        times=times,
        peaks=peaks,
        sr=audio.sr,
        hop=hop,
        n_fft=n_fft,
    )
