import numpy as np
import pytest

from riffspaced.analysis.fingering_match import (
    SILENCE,
    Candidate,
    enumerate_candidates,
    harmonic_frequencies,
    observed_vector,
    predicted_spectrum,
    score_matrix,
    segment_spectra,
)
from riffspaced.analysis.io import Audio
from riffspaced.analysis.onsets import Onsets
from riffspaced.analysis.preprocess import highpass_lowpass
from riffspaced.analysis.stft import frames
from riffspaced.music.fingering import Position
from riffspaced.music.tuning import DEFAULT_TUNING
from riffspaced.synth import render_riff
from tests.test_synth import single_note_riff

CANDIDATES = enumerate_candidates(DEFAULT_TUNING)


def event_riff(positions, techniques=None):
    riff = single_note_riff()
    riff["notes"] = [
        {
            "id": f"n{i}",
            "string": s,
            "fret": f,
            "start": 0,
            "duration": 1920,
            "velocity": 100,
            "techniques": techniques or [],
            **({"chordId": "c"} if len(positions) > 1 else {}),
        }
        for i, (s, f) in enumerate(positions)
    ]
    return riff


def best_for(positions, techniques=None, drive=8.0):
    audio, _ = render_riff(event_riff(positions, techniques), drive=drive, noise_db=-50)
    clean = highpass_lowpass(Audio(audio, 44100))
    spec = frames(clean)
    # One hand-made segment covering the sustained part of the note, as the pipeline would cut it.
    onsets = Onsets(np.array([0.0]), np.array([1.0]), np.zeros(1), np.zeros(1), np.zeros(1))
    segments = segment_spectra(spec, onsets, end_time=1.0)
    matrix = score_matrix(segments, CANDIDATES, spec.freqs)
    row = matrix[0]
    order = np.argsort(row)[::-1]
    best = CANDIDATES[order[0]]
    truth = (
        Candidate(tuple(Position(s, f) for s, f in positions), tuple(c for c in best.pitches))
        if positions
        else SILENCE
    )
    # Margin to the best candidate with different pitches (same-pitch shapes tie by design;
    # pitch order follows string order, so compare as sets).
    runner = next(CANDIDATES[j] for j in order if set(CANDIDATES[j].pitches) != set(best.pitches))
    margin = float(row[order[0]] - row[CANDIDATES.index(runner)])
    return best, truth, margin, row


def test_enumeration_covers_singles_dyads_and_silence():
    assert CANDIDATES[0] is SILENCE
    singles = [c for c in CANDIDATES if len(c.positions) == 1]
    dyads = [c for c in CANDIDATES if len(c.positions) == 2]
    assert len(singles) == 4 * 13
    assert all(abs(c.positions[0].string - c.positions[1].string) <= 2 for c in dyads)
    assert Candidate((Position(6, 3), Position(5, 5)), (37, 44)) in dyads
    assert Candidate((Position(6, 3), Position(5, 8)), (37, 47)) not in dyads
    assert Candidate((Position(6, 0), Position(5, 10)), (34, 49)) in dyads
    assert len(CANDIDATES) < 800
    h = harmonic_frequencies(100.0, 3, 1e-3)
    assert h[0] == pytest.approx(100.0 * np.sqrt(1.001))
    assert h[2] > 300.0


def test_templates_are_unit_vectors_and_cached():
    freqs = np.fft.rfftfreq(4096, 1 / 44100)
    t1 = predicted_spectrum(Candidate((Position(6, 3),), (37,)), freqs)
    t2 = predicted_spectrum(Candidate((Position(6, 3),), (37,)), freqs)
    assert t1 is t2
    assert np.linalg.norm(t1) == pytest.approx(1.0)
    silence = predicted_spectrum(SILENCE, freqs)
    assert np.linalg.norm(silence) == pytest.approx(1.0)
    # Compression and weighting make every template overlap the flat one somewhat;
    # a pitched template must still be clearly less silence-like than silence itself.
    assert np.dot(t1, silence) < 0.9
    other = predicted_spectrum(Candidate((Position(6, 1),), (35,)), freqs)
    assert np.dot(t1, other) < 0.9
    obs = observed_vector(np.ones_like(freqs), freqs)
    assert np.dot(obs, silence) == pytest.approx(1.0, abs=1e-6)


@pytest.mark.parametrize(
    ("positions", "name"),
    [
        ([(6, 3), (5, 5)], "P5 power chord Db2 + Ab2"),
        ([(5, 5), (4, 5)], "inverted P4 Ab2 + Db3"),
        ([(6, 1), (5, 2)], "tritone B1 + F2"),
        ([(6, 5), (5, 1)], "chromatic m2 Eb2 + E2"),
        ([(6, 0)], "single open Bb1"),
        ([(6, 7)], "single F2 at the seventh fret"),
    ],
)
def test_true_shape_scores_highest_at_drive_8(positions, name):
    best, truth, margin, row = best_for(positions)
    print(f"{name}: best {best.label} truth {truth.label} margin {margin:.4f}")
    assert set(best.pitches) == set(truth.pitches), (name, best.label)
    assert margin > 0.005, (name, margin)


def test_dead_note_scores_silence_highest():
    best, truth, margin, row = best_for([(6, 3)], techniques=["dead"])
    print(f"dead note: best {best.label} margin {margin:.4f}")
    assert best.is_silence
