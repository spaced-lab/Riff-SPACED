import pytest

from riffspaced.model.validate import validate_riff
from riffspaced.music.transpose import refinger_riff, retune_riff, transpose_riff
from riffspaced.music.tuning import Tuning, pitch_of, preset_by_name
from tests.fixture_cases import cases


def pitches(riff):
    t = Tuning.from_dict(riff["tuning"])
    return [pitch_of(t, n["string"], n["fret"]) for n in riff["notes"]]


def test_transpose_walkdown_up_two_stays_in_the_home_range(demo_library):
    riff = demo_library["riffs"][0]
    result = transpose_riff(riff, 2)
    assert result.unplayable == 0
    assert result.moved == len(riff["notes"])
    assert pitches(result.riff) == [p + 2 for p in pitches(riff)]
    assert all(n["fret"] <= 12 and n["string"] >= 3 for n in result.riff["notes"])
    by_id = {n["id"]: n for n in result.riff["notes"]}
    # From the open C2 at 6:2 the Eb2 + Bb2 chug costs least as open 5:0 plus 4:2.
    assert (by_id["wd-n02"]["string"], by_id["wd-n02"]["fret"]) == (5, 0)
    assert (by_id["wd-n03"]["string"], by_id["wd-n03"]["fret"]) == (4, 2)
    validate_riff(result.riff)
    assert transpose_riff(riff, 0).riff is riff


def test_unreachable_notes_are_flagged_not_dropped(demo_library):
    riff = demo_library["riffs"][0]
    down = transpose_riff(riff, -12)
    assert down.unplayable == len(riff["notes"])
    assert all(n["unplayable"] for n in down.riff["notes"])
    up = transpose_riff(riff, 26)
    assert up.unplayable == 0
    assert any(n["fret"] > 12 or n["string"] < 3 for n in up.riff["notes"])


def test_retune_keep_pitches_moves_only_the_low_string(demo_library):
    riff = demo_library["riffs"][0]
    result = retune_riff(riff, preset_by_name("Drop Ab"), "keepPitches")
    assert result.unplayable == 0
    assert pitches(result.riff) == pitches(riff)
    low = [n for n in riff["notes"] if n["string"] == 6]
    assert result.moved == len(low)
    after = {n["id"]: n for n in result.riff["notes"]}
    for before in low:
        moved = after[before["id"]]
        assert (moved["string"], moved["fret"]) == (6, before["fret"] + 2)


def test_retune_keep_shapes_changes_pitches_on_string_six_only(demo_library):
    riff = demo_library["riffs"][0]
    result = retune_riff(riff, preset_by_name("Drop Ab"), "keepShapes")
    assert result.unplayable == 0 and result.moved == 0
    for note, before, after in zip(riff["notes"], pitches(riff), pitches(result.riff), strict=True):
        assert after - before == (-2 if note["string"] == 6 else 0)


def test_refinger_identity_moves_nothing(demo_library):
    riff = demo_library["riffs"][0]
    tuning = Tuning.from_dict(riff["tuning"])
    same = refinger_riff(riff, tuning, lambda n: pitch_of(tuning, n["string"], n["fret"]))
    assert same.moved == 0 and same.unplayable == 0


@pytest.mark.parametrize("case", cases("transpose"), ids=lambda c: c["why"][:40])
def test_fixture_cases(case, demo_library):
    riff = next(r for r in demo_library["riffs"] if r["id"] == case["riff"])
    if case["op"] == "transpose":
        result = transpose_riff(riff, case["semitones"])
    else:
        result = retune_riff(riff, preset_by_name(case["tuning"]), case["mode"])
    assert result.unplayable == case["expectedUnplayable"]
    by_id = {n["id"]: n for n in result.riff["notes"]}
    for note_id, (string, fret) in case["expectedPositions"].items():
        assert (by_id[note_id]["string"], by_id[note_id]["fret"]) == (string, fret), note_id
