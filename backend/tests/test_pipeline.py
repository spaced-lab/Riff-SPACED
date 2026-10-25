import numpy as np

from riffspaced.analysis.decode import transition_matrix, viterbi
from riffspaced.analysis.fingering_match import SILENCE, Candidate
from riffspaced.analysis.io import Audio
from riffspaced.analysis.pipeline import AnalyzeOptions, analyze_audio
from riffspaced.analysis.quantize import downbeat_offset, loop_length_bars, velocity_from_db
from riffspaced.analysis.scoring import score_notes
from riffspaced.music.fingering import Position
from riffspaced.music.tuning import pitch_of
from riffspaced.synth import render_riff


def run(riff, drive=6.0, noise_db=-60, bpm=None):
    audio, truth = render_riff(riff, drive=drive, noise_db=noise_db)
    out, report = analyze_audio(Audio(audio, 44100, path="synthetic.wav"), AnalyzeOptions(bpm=bpm))
    return out, report, truth


def test_viterbi_prefers_the_repeated_shape_over_a_jumpy_tie():
    a = Candidate((Position(6, 3), Position(5, 5)), (37, 44))
    b = Candidate((Position(6, 3), Position(4, 0)), (37, 44))
    far = Candidate((Position(6, 10),), (44,))
    cands = [SILENCE, a, b, far]
    # A 0.003 edge is well inside the emission temperature; a 0.02 edge would be decisive.
    scores = np.array([[0.1, 0.9, 0.9, 0.2], [0.1, 0.9, 0.9, 0.2], [0.1, 0.5, 0.5, 0.503]])
    d = viterbi(scores, cands)
    assert d.path[0] == d.path[1]
    # Staying on the same shape earns the repeat bonus and beats a tiny score edge far up the neck.
    assert d.path[2] in (1, 2)
    t = transition_matrix(cands)
    assert t[1, 1] < 0 and t[1, 3] > t[1, 2]
    assert t[0, 1] == 0.0
    assert all(0.0 <= c <= 1.0 for c in d.confidences)
    assert viterbi(np.zeros((0, 4)), cands).path == []


def test_quantize_helpers():
    assert downbeat_offset(np.array([0.0, 0.5, 1.0, 1.5]), np.ones(4), 120) == 0.0
    assert loop_length_bars([]) == 4
    assert (
        velocity_from_db(0) == 127 and velocity_from_db(-30) == 40 and velocity_from_db(-60) == 40
    )


def test_walkdown_turnaround_is_recovered(demo_library):
    riff = demo_library["riffs"][0]
    out, report, truth = run(riff, drive=6.0)
    assert abs(report.bpm - 92) <= 2, report.bpm_candidates
    scores = score_notes(truth, out, out["tempo"]["bpm"])
    print("walkdown:", scores, "mean conf", report.mean_confidence)
    assert scores.note_f1 >= 0.85, scores
    assert scores.fingering_accuracy >= 0.75, scores
    # Bar 4: the chromatic walkdown on the low string, four distinct descending pitches.
    bar4 = [n for n in out["notes"] if 3 * 1920 <= n["start"] < 4 * 1920 and n["string"] == 6]
    pitches = []
    for n in sorted(bar4, key=lambda n: n["start"]):
        p = pitch_of(
            __import__("riffspaced.music.tuning", fromlist=["Tuning"]).Tuning.from_dict(
                out["tuning"]
            ),
            n["string"],
            n["fret"],
        )
        if not pitches or pitches[-1] != p:
            pitches.append(p)
    assert pitches[:4] == [39, 38, 37, 36], pitches
    assert out["lengthBars"] == 4
    assert out["source"]["type"] == "audio"
    assert "imported" in out["tags"]
    assert report.note_count == len(out["notes"])
    assert "tempo" in report.to_markdown("walkdown")


def test_tritone_chug_finds_the_tritones(demo_library):
    riff = demo_library["riffs"][1]
    out, report, truth = run(riff, drive=6.0)
    assert any(abs(report.bpm - b) <= 2 for b in (80, 160)), report.bpm_candidates
    chords = {}
    for n in out["notes"]:
        if n.get("chordId"):
            chords.setdefault(n["chordId"], []).append((n["string"], n["fret"]))
    tritones = [c for c in chords.values() if sorted(c) == [(5, 2), (6, 1)]]
    print("tritone chords found:", len(tritones), "of 2 per pass;", report.mean_confidence)
    assert len(tritones) >= 2
    scores = score_notes(truth, out, out["tempo"]["bpm"])
    print("tritone:", scores)
    assert scores.onset_f1 >= 0.9, scores
