"""Stage 1: load audio (SPEC 8.2 step 1).

Any sample rate and channel count in; float32 mono at 44100 Hz out, peak-normalized to
-1 dBFS so the later thresholds (onset deltas, silence templates) see consistent levels.
soundfile reads WAV, FLAC and OGG directly; MP3 and M4A go through the ffmpeg CLI when it
is installed, otherwise the error says what to install.
"""

from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

TARGET_SR = 44100
PEAK_DBFS = -1.0
SOUNDFILE_EXTENSIONS = {".wav", ".flac", ".ogg", ".aiff", ".aif"}
FFMPEG_EXTENSIONS = {".mp3", ".m4a", ".aac", ".mp4"}


class UnsupportedFormat(ValueError):  # noqa: N818 (name fixed by SPEC 8.2)
    """The file extension is not one we can decode."""


@dataclass(frozen=True)
class Audio:
    """Mono float32 samples at `sr` Hz, plus where they came from."""

    samples: np.ndarray
    sr: int
    path: str = ""

    @property
    def seconds(self) -> float:
        """Duration in seconds."""
        return len(self.samples) / self.sr


def to_mono(samples: np.ndarray) -> np.ndarray:
    """Average channels; a (frames, channels) array becomes (frames,)."""
    if samples.ndim == 1:
        return samples.astype(np.float32)
    return samples.mean(axis=1).astype(np.float32)


def resample(samples: np.ndarray, sr: int, target: int = TARGET_SR) -> np.ndarray:
    """Polyphase resampling: exact for rational ratios, no drift over long files."""
    if sr == target:
        return samples.astype(np.float32)
    g = np.gcd(sr, target)
    return resample_poly(samples, target // g, sr // g).astype(np.float32)


def normalize_peak(samples: np.ndarray, peak_dbfs: float = PEAK_DBFS) -> np.ndarray:
    """Scale so the loudest sample sits at `peak_dbfs`; silence stays silence."""
    peak = float(np.max(np.abs(samples))) if len(samples) else 0.0
    if peak <= 0.0:
        return samples.astype(np.float32)
    target = 10 ** (peak_dbfs / 20)
    return (samples * (target / peak)).astype(np.float32)


def _decode_with_ffmpeg(path: Path) -> np.ndarray:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise UnsupportedFormat(
            f"{path.name}: decoding {path.suffix} needs ffmpeg on the PATH "
            "(brew install ffmpeg), or convert the file to WAV or FLAC first"
        )
    cmd = [
        ffmpeg,
        "-v",
        "error",
        "-i",
        str(path),
        "-f",
        "f32le",
        "-ac",
        "1",
        "-ar",
        str(TARGET_SR),
        "-",
    ]
    result = subprocess.run(cmd, capture_output=True, check=False)
    if result.returncode != 0:
        detail = result.stderr.decode(errors="replace").strip()
        raise UnsupportedFormat(f"{path.name}: ffmpeg could not decode it: {detail}")
    return np.frombuffer(result.stdout, dtype=np.float32).copy()


def load_audio(path: str | Path) -> Audio:
    """Read a file into mono float32 at 44100 Hz, peak-normalized to -1 dBFS."""
    p = Path(path)
    ext = p.suffix.lower()
    if ext in SOUNDFILE_EXTENSIONS:
        try:
            data, sr = sf.read(str(p), dtype="float32", always_2d=False)
        except (sf.LibsndfileError, RuntimeError) as error:
            # A .wav that is not really a WAV: say so instead of leaking a libsndfile trace.
            raise UnsupportedFormat(f"{p.name}: could not decode it ({error})") from error
        mono = resample(to_mono(np.asarray(data)), int(sr))
    elif ext in FFMPEG_EXTENSIONS:
        mono = _decode_with_ffmpeg(p)
    else:
        supported = ", ".join(sorted(SOUNDFILE_EXTENSIONS | FFMPEG_EXTENSIONS))
        raise UnsupportedFormat(
            f"{p.name}: unsupported extension {ext or '(none)'}; supported: {supported}"
        )
    return Audio(samples=normalize_peak(mono), sr=TARGET_SR, path=str(p))


def save_wav(path: str | Path, samples: np.ndarray, sr: int = TARGET_SR) -> None:
    """Write float samples as 16-bit PCM WAV (used by the synth CLI and tests)."""
    sf.write(str(path), np.clip(samples, -1.0, 1.0), sr, subtype="PCM_16")
