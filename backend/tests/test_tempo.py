import numpy as np
import pytest

from riffspaced.analysis.io import Audio
from riffspaced.analysis.onsets import Onsets, detect_onsets
from riffspaced.analysis.preprocess import highpass_lowpass
from riffspaced.analysis.stft import frames
from riffspaced.analysis.tempo import alignment_score, autocorrelation, estimate_tempo, prior
from riffspaced.synth import render_click_track, render_riff


def tempo_of_riff(riff, bpm):
    riff = {**riff, "tempo": {"bpm": bpm}}
    audio, _ = render_riff(riff, drive=6.0, noise_db=-50)
    clean = highpass_lowpass(Audio(audio, 44100))
    onsets = detect_onsets(clean, frames(clean))
    return estimate_tempo(onsets)


@pytest.mark.parametrize("bpm", [80, 92, 120, 160])
def test_walkdown_tempo_recovered_within_two_bpm(demo_library, bpm):
    estimate = tempo_of_riff(demo_library["riffs"][0], bpm)
    assert len(estimate.candidates) >= 1
    best = estimate.bpm
    acceptable = {bpm, bpm / 2, bpm * 2}
    hit = any(abs(best - a) <= 2.0 for a in acceptable)
    assert hit, (bpm, estimate.candidates)
    if bpm in (92, 120):
        assert abs(best - bpm) <= 2.0, estimate.candidates
    print(f"{bpm} bpm -> {estimate.candidates}")


def test_click_track_and_helpers():
    clicks = render_click_track(100, 8)
    clean = Audio(clicks, 44100)
    onsets = detect_onsets(clean, frames(clean))
    estimate = estimate_tempo(onsets)
    assert abs(estimate.bpm - 100) <= 2.0, estimate.candidates
    assert prior(100) == pytest.approx(1.0)
    assert prior(50) < prior(100)
    assert prior(200) == pytest.approx(prior(50))
    r = autocorrelation(np.tile([1.0, 0, 0, 0], 50), 8)
    assert r[0] == pytest.approx(1.0)
    assert r[4] > r[2]
    assert alignment_score(np.array([0.0, 0.5, 1.0, 1.5]), 120) == 1.0
    assert alignment_score(np.array([0.0, 0.5, 1.0, 1.5]), 90) < 1.0
    assert alignment_score(np.zeros(0), 120) == 0.0
    empty = Onsets(np.zeros(0), np.zeros(0), np.zeros(5), np.zeros(5), np.arange(5) * 0.01)
    assert estimate_tempo(empty).bpm == 92.0
