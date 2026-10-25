import copy
import json

import pytest
from fastapi.testclient import TestClient

from riffspaced.ai.fake_client import FakeAiClient, generate
from riffspaced.ai.schemas import SUGGEST_KINDS
from riffspaced.ai.suggest import suggest
from riffspaced.api import create_app
from riffspaced.model.validate import validate_riff
from riffspaced.music.fingering import Position, hand_span
from riffspaced.music.tuning import Tuning, pitch_of


@pytest.fixture
def fake_env(monkeypatch):
    monkeypatch.setenv("RIFFSPACED_AI_FAKE", "1")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


@pytest.mark.parametrize("kind", SUGGEST_KINDS)
def test_every_kind_returns_count_valid_riffs(fake_env, demo_library, kind):
    walkdown = demo_library["riffs"][0]
    body = {"riff": walkdown, "kind": kind, "count": 3, "intent": "keep it ugly"}
    response = TestClient(create_app()).post("/ai/suggest", json=body)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["kind"] == kind and len(data["suggestions"]) == 3 and data["warnings"] == []
    for s in data["suggestions"]:
        riff = s["riff"]
        validate_riff(riff)
        assert riff["id"] != walkdown["id"]
        assert riff["source"] == {
            "type": "ai",
            "model": "fake",
            "promptVersion": 1,
            "parentRiffId": walkdown["id"],
        }
        assert "ai" in riff["tags"]
        assert "keep it ugly" in s["rationale"]
        if kind == "tunings":
            assert riff["tuning"]["pitches"][0] < walkdown["tuning"]["pitches"][0]
        else:
            assert riff["tuning"] == walkdown["tuning"]
    assert data["usage"]["purpose"] == f"suggest:{kind}"


def scripted_answer(parent, mutate):
    answer = generate({"task": "suggest", "kind": "variation", "count": 1, "riff": parent})
    mutate(answer["suggestions"][0]["riff"])
    return json.dumps(answer)


def test_wide_chord_is_refingered_and_tuning_change_is_undone(demo_library):
    parent = demo_library["riffs"][0]

    def mutate(riff):
        # The model moved to Drop Ab (low string two semitones down) and wrote a chord no
        # hand can reach: fret 3 and fret 9 on adjacent strings.
        riff["tuning"] = {"name": "Drop Ab", "pitches": [32, 39, 44, 49, 53, 58]}
        riff["notes"][1]["fret"] = 3
        riff["notes"][2]["fret"] = 9

    fake = FakeAiClient(scripted=[scripted_answer(parent, mutate)])
    result = suggest(parent, "variation", 1, fake)
    s = result["suggestions"][0]
    riff = s["riff"]
    assert riff["tuning"] == parent["tuning"]
    assert any("tuning restored" in r for r in s["repairs"])
    drop = Tuning.from_dict({"name": "Drop Ab", "pitches": [32, 39, 44, 49, 53, 58]})
    bb = Tuning.from_dict(parent["tuning"])
    by_id = {n["id"]: n for n in riff["notes"]}
    # The chord's pitches as the model meant them on Drop Ab survive on Bb Standard.
    meant = sorted([pitch_of(drop, 6, 3), pitch_of(drop, 5, 9)])
    chord = [by_id["wd-n02"], by_id["wd-n03"]]
    got = sorted(pitch_of(bb, n["string"], n["fret"]) for n in chord)
    assert got == meant
    assert hand_span([Position(n["string"], n["fret"]) for n in chord]) <= 4
    assert any("refingered: wd-n02, wd-n03" in r for r in s["repairs"])
    # The open low string on Drop Ab (Ab1) does not exist on Bb Standard: flagged, kept.
    assert by_id["wd-n01"]["unplayable"] is True
    assert any("flagged unplayable: wd-n01" in r for r in s["repairs"])


def test_oversized_suggestion_is_truncated(demo_library):
    parent = demo_library["riffs"][0]

    def mutate(riff):
        base = copy.deepcopy(riff["notes"])
        riff["notes"] = [
            {**n, "id": f"{n['id']}-{k}", "chordId": None} for k in range(9) for n in base
        ]
        for n in riff["notes"]:
            n.pop("chordId")

    fake = FakeAiClient(scripted=[scripted_answer(parent, mutate)])
    s = suggest(parent, "embellish", 1, fake)["suggestions"][0]
    assert len(s["riff"]["notes"]) == 400
    assert any("truncated" in r for r in s["repairs"])


def test_invalid_suggested_riff_earns_one_retry(demo_library):
    parent = demo_library["riffs"][0]

    def broken(riff):
        riff["notes"][0]["start"] = -5

    fake = FakeAiClient(
        scripted=[scripted_answer(parent, broken), scripted_answer(parent, lambda r: None)]
    )
    result = suggest(parent, "variation", 1, fake)
    assert len(result["suggestions"]) == 1
    assert "suggestions[0].riff" in fake.calls[1][1][2]["content"]
    assert result["usage"]["attempts"] == 2


def test_fewer_than_count_is_a_warning_not_an_error(demo_library):
    parent = demo_library["riffs"][0]
    fake = FakeAiClient(scripted=[scripted_answer(parent, lambda r: None)])
    result = suggest(parent, "variation", 3, fake)
    assert len(result["suggestions"]) == 1
    assert result["warnings"] == ["asked for 3 suggestions, the model returned 1"]


def test_bad_requests_are_400(fake_env, demo_library):
    client = TestClient(create_app())
    riff = demo_library["riffs"][0]
    post = lambda body: client.post("/ai/suggest", json=body).status_code  # noqa: E731
    assert post({"riff": riff, "kind": "dance"}) == 422
    assert post({"riff": riff, "kind": "variation", "count": 9}) == 422
    assert post({"riff": {"x": 1}, "kind": "variation"}) == 400
