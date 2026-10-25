from fastapi.testclient import TestClient

from riffspaced import __version__
from riffspaced.api import cors_origins, create_app


def test_health_reports_status_version_and_ai_flag(monkeypatch):
    # CI runs with RIFFSPACED_AI_FAKE=1 (DECISIONS 54); this test is about the bare default.
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("RIFFSPACED_AI_FAKE", raising=False)
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": __version__, "aiConfigured": False}


def test_health_ai_flag_follows_the_api_key(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-not-a-real-key")
    client = TestClient(create_app())

    assert client.get("/health").json()["aiConfigured"] is True


def test_cors_origins_default_and_override(monkeypatch):
    monkeypatch.delenv("RIFFSPACED_CORS_ORIGINS", raising=False)
    assert "http://localhost:5173" in cors_origins()

    monkeypatch.setenv("RIFFSPACED_CORS_ORIGINS", " https://a.example , https://b.example ")
    assert cors_origins() == ["https://a.example", "https://b.example"]


def test_cors_header_is_returned_for_the_dev_origin():
    client = TestClient(create_app())
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
