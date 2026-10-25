import copy
import json

import pytest
from fastapi.testclient import TestClient

from riffspaced.ai.cleanup import cleanup_riff, enforce_limits
from riffspaced.ai.fake_client import FakeAiClient
from riffspaced.api import create_app
from riffspaced.model.validate import validate_riff


@pytest.fixture
def imported(demo_library):
    """The tritone chug as an import: confidences on every note, one weak note."""
    riff = copy.deepcopy(demo_library["riffs"][1])
    for n in riff["notes"]:
        n["confidence"] = 0.9
    riff["notes"][3]["confidence"] = 0.3
    riff["source"] = {"type": "audio", "audioFile": "chug.wav", "analysisVersion": "0.6.0"}
    return riff


def answer(riff, changes, mutate=None):
    out = copy.deepcopy(riff)
    if mutate:
        mutate(out)
    return json.dumps({"riff": out, "changes": changes})


def test_endpoint_applies_the_fakes_delete(imported, monkeypatch):
    monkeypatch.setenv("RIFFSPACED_AI_FAKE", "1")
    body = {"riff": imported, "report": {"bpm": 80}}
    response = TestClient(create_app()).post("/ai/cleanup", json=body)
    assert response.status_code == 200, response.text
    data = response.json()
    weak = imported["notes"][3]["id"]
    assert data["changes"] == [
        {"kind": "delete", "noteIds": [weak], "reason": "confidence 0.30 is below 0.5"}
    ]
    assert data["rejected"] == []
    assert weak not in {n["id"] for n in data["riff"]["notes"]}
    assert len(data["riff"]["notes"]) == len(imported["notes"]) - 1
    validate_riff(data["riff"])
    assert data["model"] == "fake" and data["promptVersion"] == 1


def test_out_of_bounds_edits_are_rejected_and_reverted(imported):
    n0, n1, n2 = (imported["notes"][i]["id"] for i in (0, 1, 2))

    def mutate(r):
        r["notes"][0]["fret"] += 2  # too far
        r["notes"][1]["string"] -= 1  # not a fret move at all
        del r["notes"][2]  # confident note deleted
        r["tempo"]["bpm"] = 120  # riff-level field

    changes = [
        {"kind": "moveFret", "noteIds": [n0], "reason": "two frets"},
        {"kind": "moveFret", "noteIds": [n1], "reason": "string"},
        {"kind": "delete", "noteIds": [n2], "reason": "gone"},
    ]
    fake = FakeAiClient(scripted=[answer(imported, changes, mutate)])
    result = cleanup_riff(imported, {}, fake)
    assert result["changes"] == []
    because = {
        r["noteIds"][0] if r["noteIds"] else r["kind"]: r["rejectedBecause"]
        for r in result["rejected"]
    }
    assert "allowed 1" in because[n0]
    assert "only the fret" in because[n1]
    assert "not below 0.5" in because[n2]
    assert because["riff"] == "tempo may not change"
    assert result["riff"]["notes"] == imported["notes"]
    assert result["riff"]["tempo"] == imported["tempo"]


def test_undeclared_edits_never_land(imported):
    def mutate(r):
        r["notes"][5]["fret"] += 1
        r["notes"].append({**r["notes"][0], "id": "sneaky", "start": 1800, "duration": 100})
        r["notes"].pop(6)

    fake = FakeAiClient(scripted=[answer(imported, [], mutate)])
    result = cleanup_riff(imported, {}, fake)
    assert result["riff"]["notes"] == imported["notes"]
    kinds = sorted((r["rejectedBecause"], r["noteIds"][0]) for r in result["rejected"])
    assert kinds == sorted(
        [
            ("edited", imported["notes"][5]["id"]),
            ("new note", "sneaky"),
            ("removed", imported["notes"][6]["id"]),
        ]
    )


def test_move_palm_mute_merge_and_split_are_accepted(demo_library):
    riff = copy.deepcopy(demo_library["riffs"][0])
    for n in riff["notes"]:
        n.pop("chordId", None)
    # Two low-string eighths a sixteenth apart to merge, a long note to split.
    riff["notes"] = [
        {"id": "a", "string": 6, "fret": 3, "start": 0, "duration": 120, "velocity": 100},
        {"id": "b", "string": 6, "fret": 3, "start": 120, "duration": 120, "velocity": 100},
        {"id": "c", "string": 5, "fret": 5, "start": 480, "duration": 960, "velocity": 100},
        {
            "id": "d",
            "string": 6,
            "fret": 4,
            "start": 1440,
            "duration": 240,
            "velocity": 100,
            "techniques": ["letRing"],
        },
        {"id": "e", "string": 6, "fret": 5, "start": 1680, "duration": 240, "velocity": 100},
    ]
    validate_riff(riff)

    def mutate(r):
        notes = {n["id"]: n for n in r["notes"]}
        notes["a"]["duration"] = 240
        r["notes"].remove(notes["b"])
        notes["c"]["duration"] = 480
        r["notes"].append({**notes["c"], "id": "c2", "start": 960, "duration": 480})
        notes["d"]["techniques"] = ["letRing", "palmMute"]
        notes["e"]["fret"] = 4

    changes = [
        {"kind": "merge", "noteIds": ["a", "b"], "reason": "one attack split by the detector"},
        {"kind": "split", "noteIds": ["c"], "reason": "two attacks read as one"},
        {"kind": "palmMute", "noteIds": ["d"], "reason": "short and damped like its neighbors"},
        {"kind": "moveFret", "noteIds": ["e"], "reason": "continues the walkdown"},
    ]
    fake = FakeAiClient(scripted=[answer(riff, changes, mutate)])
    result = cleanup_riff(riff, {}, fake)
    assert [c["kind"] for c in result["changes"]] == ["merge", "split", "palmMute", "moveFret"]
    assert result["rejected"] == []
    by_id = {n["id"]: n for n in result["riff"]["notes"]}
    assert set(by_id) == {"a", "c", "c2", "d", "e"}
    assert by_id["a"]["duration"] == 240
    assert (by_id["c"]["duration"], by_id["c2"]["start"], by_id["c2"]["duration"]) == (
        480,
        960,
        480,
    )
    assert by_id["d"]["techniques"] == ["letRing", "palmMute"]
    assert by_id["e"]["fret"] == 4
    validate_riff(result["riff"])


def test_bad_merge_and_split_are_rejected():
    orig = {
        "a": {"id": "a", "string": 6, "fret": 3, "start": 0, "duration": 120},
        "b": {"id": "b", "string": 5, "fret": 3, "start": 120, "duration": 120},
        "c": {"id": "c", "string": 6, "fret": 5, "start": 480, "duration": 960},
    }
    new = {
        "a": {"id": "a", "string": 6, "fret": 3, "start": 0, "duration": 240},
        "c": {"id": "c", "string": 6, "fret": 5, "start": 480, "duration": 480},
        "c2": {"id": "c2", "string": 6, "fret": 7, "start": 960, "duration": 480},
    }
    original = {"notes": list(orig.values()), "updatedAt": "x"}
    cleaned = {"notes": list(new.values())}
    changes = [
        {"kind": "merge", "noteIds": ["a", "b"], "reason": ""},
        {"kind": "split", "noteIds": ["c"], "reason": ""},
    ]
    _, accepted, rejected = enforce_limits(original, cleaned, changes)
    assert accepted == []
    assert "same string" in rejected[0]["rejectedBecause"]
    assert "second part" in rejected[1]["rejectedBecause"]


def test_invalid_cleaned_riff_earns_one_retry(imported):
    broken = answer(imported, [], lambda r: r["notes"][0].update(start=-1))
    fake = FakeAiClient(scripted=[broken, answer(imported, [])])
    result = cleanup_riff(imported, {}, fake)
    assert result["usage"]["attempts"] == 2
    assert "riff: notes[0].start" in fake.calls[1][1][2]["content"]
