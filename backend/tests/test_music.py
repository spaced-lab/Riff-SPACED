import pytest

from riffspaced.music import (
    ALL_PRESETS,
    DEFAULT_TUNING,
    DROP_PRESETS,
    FLAT_NAMES,
    GRID,
    PPQ,
    STANDARD_PRESETS,
    TICKS_PER_BAR,
    Position,
    bar_beat_tick,
    best_fingering,
    describe_dyad,
    drop_of,
    find_fingerings,
    format_position,
    freq_of,
    hand_span,
    is_valid_tuning,
    name_of,
    octave_of,
    pitch_class,
    pitch_of,
    preset_by_name,
    retune_string,
    seconds_to_ticks,
    snap_to_grid,
    ticks_to_seconds,
)
from riffspaced.music.tuning import SEVEN_STRING_PRESETS
from tests.fixture_cases import cases


@pytest.mark.parametrize("c", cases("frequencies"))
def test_freq_of(c):
    assert freq_of(c["midi"]) == pytest.approx(c["hz"], abs=1e-4)


@pytest.mark.parametrize("c", cases("pitchNames"))
def test_names_and_classes(c):
    m = c["midi"]
    assert pitch_class(m) == c["pitchClass"]
    assert octave_of(m) == c["octave"]
    assert name_of(m, "flats", True) == c["flat"]
    assert name_of(m, "sharps", True) == c["sharp"]
    assert name_of(m, "flats", False) == c["flat"].rstrip("-0123456789")


@pytest.mark.parametrize("c", cases("standard"))
def test_standard_presets(c):
    assert list(preset_by_name(c["name"]).pitches) == c["pitches"]
    assert any(t.name == c["name"] for t in STANDARD_PRESETS)


@pytest.mark.parametrize("c", cases("drop"))
def test_drop_presets_are_generated(c):
    standard = preset_by_name(c["from"])
    assert drop_of(standard).name == c["name"]
    assert list(drop_of(standard).pitches) == c["pitches"]
    assert any(t.name == c["name"] and list(t.pitches) == c["pitches"] for t in DROP_PRESETS)


@pytest.mark.parametrize("c", cases("sevenString"))
def test_seven_string_presets(c):
    assert list(preset_by_name(c["name"]).pitches) == c["pitches"]
    assert any(t.name == c["name"] for t in SEVEN_STRING_PRESETS)


@pytest.mark.parametrize("c", cases("validity"))
def test_is_valid_tuning(c):
    assert is_valid_tuning(c["pitches"]) is c["valid"]


def test_presets_default_and_uniqueness(conventions):
    assert DEFAULT_TUNING.name == conventions["tunings"]["default"]
    assert all(is_valid_tuning(t.pitches) for t in ALL_PRESETS)
    assert len({t.name for t in ALL_PRESETS}) == len(ALL_PRESETS)


@pytest.mark.parametrize("c", cases("pitchOf"))
def test_pitch_of(c):
    assert pitch_of(preset_by_name(c["tuning"]), c["string"], c["fret"]) == c["midi"]


def test_pitch_of_rejects_bad_input():
    with pytest.raises(ValueError):
        pitch_of(DEFAULT_TUNING, 0, 0)
    with pytest.raises(ValueError):
        pitch_of(DEFAULT_TUNING, 7, 0)
    with pytest.raises(ValueError):
        pitch_of(DEFAULT_TUNING, 6, -1)


def test_retune_string():
    assert retune_string(DEFAULT_TUNING, 6, -2).pitches == (32, 39, 44, 49, 53, 58)
    assert retune_string(DEFAULT_TUNING, 6, -2).name == "Custom"


def test_constants(conventions):
    assert PPQ == conventions["ticks"]["ppq"]
    assert TICKS_PER_BAR == conventions["ticks"]["bar"]


@pytest.mark.parametrize(("name", "ticks"), cases("grid"))
def test_grid(name, ticks):
    assert GRID[name] == ticks


@pytest.mark.parametrize("c", cases("ticksToSeconds"))
def test_ticks_to_seconds(c):
    assert ticks_to_seconds(c["ticks"], c["bpm"]) == pytest.approx(c["seconds"], abs=1e-6)
    assert seconds_to_ticks(c["seconds"], c["bpm"]) == pytest.approx(c["ticks"], abs=1e-3)


@pytest.mark.parametrize("c", cases("barBeatTick"))
def test_bar_beat_tick(c):
    p = bar_beat_tick(c["ticks"])
    assert (p.bar, p.beat, p.tick) == (c["bar"], c["beat"], c["tick"])


@pytest.mark.parametrize("c", cases("snapToGrid"))
def test_snap_to_grid(c):
    assert snap_to_grid(c["ticks"], c["grid"]) == c["snapped"]


def test_format_position():
    assert format_position(2520) == "02.2.120"
    assert format_position(0) == "01.1.000"


@pytest.mark.parametrize("c", cases("dyads"))
def test_describe_dyad(c):
    d = describe_dyad(c["a"], c["b"])
    assert d.interval == c["interval"]
    assert d.semitones == c["semitones"]
    assert d.lower_is_root is c["lowerIsRoot"]
    assert d.root_pitch_class == c["rootPitchClass"]
    assert FLAT_NAMES[d.root_pitch_class] == c["rootName"]
    assert describe_dyad(c["b"], c["a"]) == d


def _pairs(positions):
    return None if positions is None else [p.to_pair() for p in positions]


def _positions(pairs):
    return [Position(s, f) for s, f in pairs]


@pytest.mark.parametrize("c", cases("find"))
def test_find_fingerings(c):
    result = find_fingerings(
        c["pitch"], preset_by_name(c["tuning"]), tuple(c["frets"]), c["strings"]
    )
    assert _pairs(result) == c["expected"]


@pytest.mark.parametrize("c", cases("handSpan"))
def test_hand_span(c):
    assert hand_span(_positions(c["positions"])) == c["span"]


@pytest.mark.parametrize("c", cases("best"))
def test_best_fingering(c):
    previous = _positions(c["previous"]) if c.get("previous") else None
    result = best_fingering(
        c["pitches"], preset_by_name(c["tuning"]), previous, allowed_strings=c.get("strings")
    )
    assert _pairs(result) == c["expected"], c["why"]


def test_best_fingering_edge_cases():
    assert best_fingering([], DEFAULT_TUNING) == []
    assert best_fingering([20], DEFAULT_TUNING) is None
    assert _pairs(best_fingering([37, 47], DEFAULT_TUNING)) == [[6, 3], [4, 3]]
    assert find_fingerings(49, DEFAULT_TUNING) == [Position(5, 10), Position(4, 5), Position(3, 0)]
