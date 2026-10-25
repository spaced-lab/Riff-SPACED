import io
import json

import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

from riffspaced.api import create_app
from riffspaced.synth import render_riff


def wav_bytes(riff, drive=6.0):
    audio, _ = render_riff(riff, drive=drive, noise_db=-60)
    buf = io.BytesIO()
    sf.write(buf, np.clip(audio, -1, 1), 44100, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def test_tunings_lists_presets():
    client = TestClient(create_app())
    data = client.get("/tunings").json()
    names = [t["name"] for t in data]
    assert "Bb Standard" in names and "Drop Ab" in names and "B Standard 7" in names
    assert next(t for t in data if t["name"] == "Bb Standard")["pitches"] == [
        34,
        39,
        44,
        49,
        53,
        58,
    ]


def test_analyze_returns_a_valid_riff_and_report(demo_library):
    client = TestClient(create_app())
    wav = wav_bytes(demo_library["riffs"][0])
    response = client.post(
        "/analyze",
        files={"file": ("walkdown.wav", wav, "audio/wav")},
        data={
            "options": json.dumps({"tuning": "Bb Standard", "maxFret": 12, "strings": [6, 5, 4, 3]})
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    riff = body["riff"]
    assert riff["format"] == "riff-spaced/riff"
    assert riff["name"] == "walkdown"
    assert riff["source"]["type"] == "audio"
    assert riff["source"]["audioFile"] == "walkdown.wav"
    assert abs(riff["tempo"]["bpm"] - 92) <= 2
    assert len(riff["notes"]) >= 50
    assert body["report"]["noteCount"] == len(riff["notes"])
    assert "tempo" in body["reportMarkdown"]
    assert "imported" in riff["tags"]


def test_analyze_honors_bpm_override_and_name(demo_library):
    client = TestClient(create_app())
    wav = wav_bytes(demo_library["riffs"][1], drive=4.0)
    response = client.post(
        "/analyze",
        files={"file": ("chug.wav", wav, "audio/wav")},
        data={"options": json.dumps({"bpm": 80}), "name": "My chug"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["riff"]["tempo"]["bpm"] == 80
    assert body["riff"]["name"] == "My chug"
    assert body["report"]["bpmOverridden"] is True


def test_analyze_rejects_bad_input():
    client = TestClient(create_app())
    assert (
        client.post("/analyze", files={"file": ("riff.txt", b"hello", "text/plain")}).status_code
        == 415
    )
    assert (
        client.post("/analyze", files={"file": ("riff.wav", b"", "audio/wav")}).status_code == 400
    )
    bad_json = client.post(
        "/analyze", files={"file": ("riff.wav", b"RIFF", "audio/wav")}, data={"options": "{nope"}
    )
    assert bad_json.status_code == 400
    bad_tuning = client.post(
        "/analyze",
        files={"file": ("riff.wav", b"RIFF", "audio/wav")},
        data={"options": json.dumps({"tuning": "Nope"})},
    )
    assert bad_tuning.status_code == 400
    assert "unknown tuning" in bad_tuning.json()["detail"]


def test_batch_mixes_successes_and_failures(demo_library):
    client = TestClient(create_app())
    wav = wav_bytes(demo_library["riffs"][1], drive=4.0)
    response = client.post(
        "/analyze/batch",
        files=[("files", ("a.wav", wav, "audio/wav")), ("files", ("b.txt", b"x", "text/plain"))],
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] == 1 and body["failed"] == 1
    assert (
        body["results"][0]["ok"] is True
        and body["results"][0]["riff"]["format"] == "riff-spaced/riff"
    )
    assert body["results"][1]["ok"] is False and body["results"][1]["status"] == 415
