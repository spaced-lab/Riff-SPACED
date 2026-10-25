import numpy as np

from riffspaced.analysis.io import Audio
from riffspaced.analysis.onsets import (
    detect_onsets,
    dominant_pitch_track,
    pick_peaks,
    spectral_flux,
)
from riffspaced.analysis.preprocess import highpass_lowpass
from riffspaced.analysis.scoring import onset_f1
from riffspaced.analysis.stft import frame_signal, frames, interpolated_peaks
from riffspaced.music.time import ticks_to_seconds
from riffspaced.synth import render_riff
from tests.test_synth import single_note_riff


def chug_riff(bpm=100, bars=4):
    riff = single_note_riff(bpm=bpm)
    riff["lengthBars"] = bars
    riff["sections"][0]["lengthBars"] = bars
    riff["notes"] = [
        {
            "id": f"n{i}",
            "string": 6,
            "fret": 0,
            "start": i * 120,
            "duration": 120,
            "velocity": 100,
            "techniques": ["palmMute"],
        }
        for i in range(bars * 16)
    ]
    return riff


def test_stft_shapes_times_and_interpolated_peaks():
    sr = 44100
    t = np.arange(2 * sr) / sr
    tone = (0.5 * np.sin(2 * np.pi * 69.3 * t)).astype(np.float32)
    spec = frames(Audio(tone, sr))
    assert spec.mag.shape[1] == 2049
    assert abs(spec.times[1] - 512 / sr) < 1e-9
    assert spec.times[0] == 0.0
    assert frame_signal(np.zeros(10, dtype=np.float32), 4096, 512).shape[0] >= 1
    mid = spec.peaks[len(spec.peaks) // 2]
    assert abs(mid[0, 0] - 69.3) < 0.5
    assert mid[0, 1] > -1.0
    assert len(interpolated_peaks(np.array([0.0, -10.0]), np.array([0.0, 10.0]))) == 0
    track = dominant_pitch_track(spec)
    assert abs(np.nanmedian(track) - 37.0) < 0.1


def test_sixteenth_chugs_at_100_bpm_give_64_onsets_within_30_ms():
    riff = chug_riff()
    audio, truth = render_riff(riff, drive=6.0, noise_db=-60)
    clean = highpass_lowpass(Audio(audio, 44100))
    onsets = detect_onsets(clean, frames(clean))
    true_times = np.array([ticks_to_seconds(n["start"], 100) for n in riff["notes"]])
    assert abs(len(onsets.times) - 64) <= 2
    score = onset_f1(true_times, onsets.times, window=0.03)
    assert score.f1 >= 0.95, (score.precision, score.recall)
    offsets = [onsets.times[j] - true_times[i] for i, j in score.matches]
    assert abs(float(np.mean(offsets))) < 0.015
    assert np.all(onsets.strengths > 0)


def test_sustained_vibrato_notes_do_not_spray_onsets():
    sr = 44100
    bars, bpm = 4, 90
    bar_seconds = ticks_to_seconds(1920, bpm)
    t = np.arange(int(bars * bar_seconds * sr)) / sr
    audio = np.zeros_like(t, dtype=np.float32)
    for bar in range(bars):
        start = int(bar * bar_seconds * sr)
        seg = t[: int(bar_seconds * sr)]
        vibrato = 2 ** (0.02 * np.sin(2 * np.pi * 5.5 * seg) / 12)
        f = 69.3 * (2 ** (bar * 2 / 12)) * vibrato
        phase = np.cumsum(2 * np.pi * f / sr)
        env = np.exp(-seg / 1.5)
        note = 0.5 * env * (np.sin(phase) + 0.4 * np.sin(2 * phase) + 0.2 * np.sin(3 * phase))
        audio[start : start + len(note)] += note.astype(np.float32)
    audio = np.tanh(4 * audio).astype(np.float32)
    clean = highpass_lowpass(Audio(audio, sr))
    onsets = detect_onsets(clean, frames(clean))
    true_times = np.array([bar * bar_seconds for bar in range(bars)])
    score = onset_f1(true_times, onsets.times, window=0.03)
    assert score.recall == 1.0
    assert len(onsets.times) - len(true_times) <= bars


def test_peak_picking_respects_the_gap_and_threshold():
    flux = np.array([0, 0.2, 1.0, 0.3, 0.9, 0.1, 0, 0.6, 0], dtype=np.float32)
    thr = np.full_like(flux, 0.5)
    assert pick_peaks(flux, thr, frame_seconds=0.0116, min_gap_seconds=0.05) == [2, 7]
    # Frame 4 is not a local maximum within two frames of frame 2, so the gap alone does not add it.
    assert pick_peaks(flux, thr, frame_seconds=0.0116, min_gap_seconds=0.0) == [2, 7]
    spaced = np.array([0, 0.9, 0, 0, 0.8, 0, 0, 0.7, 0], dtype=np.float32)
    assert pick_peaks(
        spaced, np.full_like(spaced, 0.5), frame_seconds=0.0116, min_gap_seconds=0.0
    ) == [1, 4, 7]
    assert pick_peaks(
        spaced, np.full_like(spaced, 0.5), frame_seconds=0.0116, min_gap_seconds=0.05
    ) == [1, 7]
    spec_like = frames(Audio(np.zeros(44100, dtype=np.float32), 44100))
    assert float(np.max(spectral_flux(spec_like))) == 0.0
