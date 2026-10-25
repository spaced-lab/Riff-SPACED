import json

import pytest
from fastapi.testclient import TestClient

from riffspaced.ai.analyze import analyze_riff
from riffspaced.ai.fake_client import FakeAiClient, generate
from riffspaced.api import create_app


@pytest.fixture
def fake_env(monkeypatch):
    monkeypatch.setenv("RIFFSPACED_AI_FAKE", "1")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


def chord_ids(riff):
    return {n["chordId"] for n in riff["notes"] if n.get("chordId")}


def test_health_reports_ai_configured_with_the_fake(fake_env):
    client = TestClient(create_app())
    assert client.get("/health").json()["aiConfigured"] is True


def test_analyze_labels_every_chord_of_the_walkdown(fake_env, demo_library):
    walkdown = demo_library["riffs"][0]
    response = TestClient(create_app()).post("/ai/analyze", json=walkdown)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["style"]["turnaroundDetected"] is True
    assert {d["chordId"] for d in body["dyads"]} == chord_ids(walkdown)
    assert all(d["source"] == "model" for d in body["dyads"])
    labels = {d["chordId"]: d["label"] for d in body["dyads"]}
    assert labels["wd-c01"] == "P5"
    assert "P4" in labels.values()
    assert body["model"] == "fake" and body["promptVersion"] == 1
    assert body["usage"]["attempts"] == 1 and body["warnings"] == []


def test_computed_fallback_fills_what_the_model_omits(demo_library):
    walkdown = demo_library["riffs"][0]
    answer = generate({"task": "analyze", "riff": walkdown})
    dropped = answer["dyads"].pop(5)
    answer["dyads"].append({**answer["dyads"][0], "chordId": "ghost"})
    fake = FakeAiClient(scripted=[json.dumps(answer)])
    body = analyze_riff(walkdown, fake)
    by_id = {d["chordId"]: d for d in body["dyads"]}
    assert set(by_id) == chord_ids(walkdown)
    assert by_id[dropped["chordId"]]["source"] == "computed"
    assert by_id[dropped["chordId"]]["label"] == dropped["label"]
    assert sum(d["source"] == "computed" for d in body["dyads"]) == 1
    assert any("ghost" in w for w in body["warnings"])


def test_analyze_without_key_or_fake_is_503(monkeypatch, demo_library):
    monkeypatch.delenv("RIFFSPACED_AI_FAKE", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    client = TestClient(create_app())
    assert client.get("/health").json()["aiConfigured"] is False
    response = client.post("/ai/analyze", json=demo_library["riffs"][0])
    assert response.status_code == 503
    assert response.json() == {"reason": "ANTHROPIC_API_KEY not set"}


def test_analyze_rejects_an_invalid_riff(fake_env):
    response = TestClient(create_app()).post("/ai/analyze", json={"format": "nope"})
    assert response.status_code == 400
    assert "invalid riff" in response.json()["detail"]


def test_bad_model_answers_are_a_502(fake_env, demo_library, monkeypatch):
    import riffspaced.api as api

    monkeypatch.setattr(api, "make_client", lambda model=None: FakeAiClient(scripted=["x", "y"]))
    response = TestClient(create_app()).post("/ai/analyze", json=demo_library["riffs"][0])
    assert response.status_code == 502
    assert "failed validation" in response.json()["reason"]


def test_model_override_header_is_gated(fake_env, demo_library, monkeypatch):
    app_client = TestClient(create_app())
    headers = {"X-Riffspaced-Model": "claude-custom"}
    assert (
        app_client.post("/ai/analyze", json=demo_library["riffs"][0], headers=headers).json()[
            "model"
        ]
        == "fake"
    )
    monkeypatch.setenv("RIFFSPACED_ALLOW_MODEL_OVERRIDE", "1")
    assert (
        app_client.post("/ai/analyze", json=demo_library["riffs"][0], headers=headers).json()[
            "model"
        ]
        == "claude-custom"
    )
