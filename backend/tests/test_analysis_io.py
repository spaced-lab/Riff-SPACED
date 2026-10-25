import numpy as np
import pytest

from riffspaced.analysis.io import (
    Audio,
    UnsupportedFormat,
    load_audio,
    normalize_peak,
    resample,
    save_wav,
    to_mono,
)
from riffspaced.analysis.preprocess import bandlimit, highpass_lowpass


def sine(freq, seconds=1.0, sr=44100, amp=0.5):
    t = np.arange(int(seconds * sr)) / sr
    return (amp * np.sin(2 * np.pi * freq * t)).astype(np.float32)


def rms(x):
    return float(np.sqrt(np.mean(x**2)))


def test_wav_round_trip_mono_resample_and_normalize(tmp_path):
    stereo = np.stack([sine(220, sr=22050, amp=0.25), sine(220, sr=22050, amp=0.25)], axis=1)
    path = tmp_path / "tone.wav"
    save_wav(path, stereo, 22050)
    audio = load_audio(path)
    assert audio.sr == 44100
    assert audio.samples.dtype == np.float32
    assert audio.samples.ndim == 1
    assert abs(audio.seconds - 1.0) < 0.01
    assert np.max(np.abs(audio.samples)) == pytest.approx(10 ** (-1 / 20), abs=1e-3)
    assert audio.path.endswith("tone.wav")


def test_helpers():
    assert to_mono(np.ones((4, 2), dtype=np.float32)).shape == (4,)
    assert len(resample(np.zeros(1000), 22050)) == 2000
    assert np.array_equal(normalize_peak(np.zeros(10, dtype=np.float32)), np.zeros(10))
    assert np.max(normalize_peak(sine(100))) == pytest.approx(0.891, abs=1e-3)


def test_unsupported_extension_message(tmp_path):
    bad = tmp_path / "riff.xyz"
    bad.write_bytes(b"nope")
    with pytest.raises(UnsupportedFormat) as e:
        load_audio(bad)
    assert "unsupported extension .xyz" in str(e.value)
    assert ".wav" in str(e.value)


def test_bandlimit_keeps_bb1_and_cuts_rumble():
    bb1 = sine(58.27, seconds=2.0)
    kept = bandlimit(bb1, 44100)
    middle = slice(22050, 66150)
    assert 20 * np.log10(rms(kept[middle]) / rms(bb1[middle])) > -1.0
    rumble = sine(20.0, seconds=2.0)
    cut = bandlimit(rumble, 44100)
    assert 20 * np.log10(rms(cut[middle]) / rms(rumble[middle])) < -20.0
    fizz = sine(12000.0, seconds=2.0)
    assert 20 * np.log10(rms(bandlimit(fizz, 44100)[middle]) / rms(fizz[middle])) < -20.0


def test_highpass_lowpass_returns_new_audio_and_keeps_short_input():
    audio = Audio(samples=sine(100), sr=44100, path="x")
    out = highpass_lowpass(audio)
    assert out is not audio
    assert out.sr == 44100
    tiny = Audio(samples=np.zeros(8, dtype=np.float32), sr=44100)
    assert len(highpass_lowpass(tiny).samples) == 8
