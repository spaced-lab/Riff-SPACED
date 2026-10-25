import copy

import pytest

from riffspaced.model import (
    LibraryBundle,
    MigrationError,
    Riff,
    ValidationError,
    migrate_any,
    migrate_library,
    migrate_riff,
    validate_library,
    validate_riff,
)
from riffspaced.model.types import SECTION_KINDS, TECHNIQUES
from riffspaced.music import FLAT_NAMES, describe_dyad, name_of, pitch_of


def _walkdown(demo_library):
    return copy.deepcopy(
        next(r for r in demo_library["riffs"] if r["name"] == "Walkdown Turnaround")
    )


def test_demo_library_validates_and_round_trips(demo_library):
    validate_library(demo_library)
    bundle = LibraryBundle.from_dict(demo_library)
    assert [r.name for r in bundle.riffs] == ["Walkdown Turnaround", "Tritone Chug"]
    assert bundle.to_dict() == demo_library


def test_demo_walkdown_is_the_worked_example(demo_library):
    riff = Riff.from_dict(_walkdown(demo_library))
    by_chord = {}
    for n in riff.notes:
        if n.chord_id:
            by_chord.setdefault(n.chord_id, []).append(pitch_of(riff.tuning, n.string, n.fret))
    p5 = describe_dyad(*by_chord["wd-c01"])
    assert (p5.interval, FLAT_NAMES[p5.root_pitch_class]) == ("P5", "Db")
    p4 = describe_dyad(*by_chord["wd-c07"])
    assert (p4.interval, p4.lower_is_root, FLAT_NAMES[p4.root_pitch_class]) == ("P4", False, "Db")
    bar4 = sorted(
        (n for n in riff.notes if n.start >= 3 * 1920 and n.string == 6), key=lambda n: n.start
    )
    assert [n.fret for n in bar4] == [5, 5, 4, 4, 3, 3, 2, 2]
    assert name_of(pitch_of(riff.tuning, 5, 5)) == "Ab2"
    assert all(n.string >= 3 and n.fret <= 12 for n in riff.notes)


def test_schema_rejects_bad_fields_with_paths(demo_library):
    riff = _walkdown(demo_library)
    riff["notes"][0]["fret"] = 25
    riff["notes"][1]["techniques"] = ["tap"]
    riff["ppq"] = 96
    with pytest.raises(ValidationError) as e:
        validate_riff(riff)
    messages = e.value.errors
    assert any(m.startswith("notes[0].fret:") for m in messages)
    assert any(m.startswith("notes[1].techniques[0]:") for m in messages)
    assert any(m.startswith("ppq:") for m in messages)


def test_semantic_rules(demo_library):
    riff = _walkdown(demo_library)
    riff["notes"][2]["start"] += 120  # wd-n03 shares wd-c01 with wd-n02
    with pytest.raises(ValidationError) as e:
        validate_riff(riff)
    assert e.value.errors == ["notes[2]: shares chordId 'wd-c01' but starts at 360, not 240"]

    riff = _walkdown(demo_library)
    riff["lengthBars"] = 8
    with pytest.raises(ValidationError) as e:
        validate_riff(riff)
    assert e.value.errors == ["sections: must cover 0..8 bars exactly, they cover 0..4"]

    riff = _walkdown(demo_library)
    riff["notes"][0]["string"] = 7
    with pytest.raises(ValidationError) as e:
        validate_riff(riff)
    assert e.value.errors[0].startswith("notes[0].string:")


def test_schema_and_python_constants_agree():
    import json

    from riffspaced.paths import SCHEMA_DIR

    schema = json.loads((SCHEMA_DIR / "riff.schema.json").read_text())
    assert tuple(schema["$defs"]["technique"]["enum"]) == TECHNIQUES
    assert tuple(schema["$defs"]["section"]["properties"]["kind"]["enum"]) == SECTION_KINDS


def test_library_errors_are_prefixed(demo_library):
    lib = copy.deepcopy(demo_library)
    lib["riffs"][1]["tempo"]["bpm"] = 10
    with pytest.raises(ValidationError) as e:
        validate_library(lib)
    assert e.value.errors[0].startswith("riffs[1].tempo.bpm:")


def test_migrate_v0_riff(legacy_riff_v0):
    migrated = migrate_riff(legacy_riff_v0)
    validate_riff(migrated)
    assert migrated["version"] == 1
    assert migrated["lengthBars"] == 8
    assert "bars" not in migrated
    assert migrated["sections"] == [
        {"id": "legacy-v0-riff-main", "label": "A", "startBar": 0, "lengthBars": 8, "kind": "main"}
    ]
    assert migrate_any(legacy_riff_v0)["version"] == 1


def test_migrate_refuses_future_and_maps_library(demo_library, legacy_riff_v0):
    with pytest.raises(MigrationError):
        migrate_riff({**demo_library["riffs"][0], "version": 2})
    lib = migrate_library({**demo_library, "riffs": [legacy_riff_v0]})
    assert lib["riffs"][0]["version"] == 1
    assert migrate_riff(demo_library["riffs"][0]) == demo_library["riffs"][0]
