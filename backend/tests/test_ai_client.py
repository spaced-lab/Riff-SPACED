import json

import pytest

from riffspaced.ai import client as ai_client
from riffspaced.ai import schemas
from riffspaced.ai.client import AiError, AiNotConfiguredError, make_client, strip_code_fences
from riffspaced.ai.fake_client import FakeAiClient, generate
from riffspaced.model.validate import validate_riff

SCHEMA = {
    "type": "object",
    "required": ["a"],
    "properties": {"a": {"type": "integer"}},
    "additionalProperties": False,
}


def test_strip_code_fences():
    assert strip_code_fences('```json\n{"a": 1}\n```') == '{"a": 1}'
    assert strip_code_fences('```\n{"a": 1}```') == '{"a": 1}'
    assert strip_code_fences('  {"a": 1}  ') == '{"a": 1}'


def test_scripted_fake_returns_validated_json():
    fake = FakeAiClient(scripted=['{"a": 1}'])
    assert fake.complete_json("sys", "user", SCHEMA, purpose="t") == {"a": 1}
    assert len(fake.calls) == 1
    assert fake.last_usage is not None and fake.last_usage.attempts == 1


def test_malformed_first_response_triggers_exactly_one_retry():
    fake = FakeAiClient(scripted=['```json\n{"a": 1, oops', '{"a": 1}'])
    assert fake.complete_json("sys", "user", SCHEMA, purpose="t") == {"a": 1}
    assert len(fake.calls) == 2
    _, retry_messages = fake.calls[1]
    assert [m["role"] for m in retry_messages] == ["user", "assistant", "user"]
    assert "not valid JSON" in retry_messages[2]["content"]
    assert fake.usage_log[-1].attempts == 2


def test_schema_violation_is_quoted_back_then_accepted():
    fake = FakeAiClient(scripted=['{"a": "one"}', '{"a": 1}'])
    assert fake.complete_json("sys", "user", SCHEMA, purpose="t") == {"a": 1}
    assert "a: 'one' is not of type 'integer'" in fake.calls[1][1][2]["content"]


def test_two_bad_responses_raise_after_two_attempts():
    fake = FakeAiClient(scripted=["nope", '{"b": 2}'])
    with pytest.raises(AiError, match="failed validation 2 times"):
        fake.complete_json("sys", "user", SCHEMA, purpose="t")
    assert len(fake.calls) == 2


def test_check_callback_problems_count_as_validation_failures():
    fake = FakeAiClient(scripted=['{"a": 1}', '{"a": 2}'])
    result = fake.complete_json(
        "sys",
        "user",
        SCHEMA,
        purpose="t",
        check=lambda d: [] if d["a"] == 2 else ["a must be 2"],
    )
    assert result == {"a": 2}
    assert "a must be 2" in fake.calls[1][1][2]["content"]


def test_make_client_selects_fake_or_raises(monkeypatch):
    monkeypatch.setenv("RIFFSPACED_AI_FAKE", "1")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert isinstance(make_client(), FakeAiClient)
    assert ai_client.ai_configured() is True
    monkeypatch.delenv("RIFFSPACED_AI_FAKE")
    assert ai_client.ai_configured() is False
    with pytest.raises(AiNotConfiguredError, match="ANTHROPIC_API_KEY not set"):
        make_client()


def test_live_client_reads_model_from_env_without_network(monkeypatch):
    monkeypatch.setenv("RIFFSPACED_MODEL", "claude-test-model")
    live = ai_client.AnthropicAiClient(api_key="sk-test-not-real")
    assert live.model == "claude-test-model"
    monkeypatch.delenv("RIFFSPACED_MODEL")
    assert ai_client.model_name() == ai_client.DEFAULT_MODEL


def test_generated_analysis_of_the_demo_walkdown(demo_library):
    walkdown = demo_library["riffs"][0]
    answer = generate({"task": "analyze", "riff": walkdown})
    assert ai_client.schema_problems(schemas.ANALYZE_RESPONSE, answer) == []
    assert answer["style"]["turnaroundDetected"] is True
    labels = {d["chordId"]: d["label"] for d in answer["dyads"]}
    assert len(labels) == 23
    assert labels["wd-c01"] == "P5"
    assert "P4" in labels.values()
    assert answer["style"]["keyCenterGuess"] in {"Db", "Bb"}


@pytest.mark.parametrize("kind", schemas.SUGGEST_KINDS)
def test_generated_suggestions_are_valid_riffs(demo_library, kind):
    walkdown = demo_library["riffs"][0]
    answer = generate({"task": "suggest", "kind": kind, "count": 2, "riff": walkdown})
    assert ai_client.schema_problems(schemas.SUGGEST_RESPONSE, answer) == []
    assert len(answer["suggestions"]) == 2
    for s in answer["suggestions"]:
        validate_riff(s["riff"])
        assert s["riff"]["source"]["type"] == "ai"
        if kind != "tunings":
            assert s["riff"]["tuning"] == walkdown["tuning"]
        else:
            assert s["riff"]["tuning"]["pitches"][0] < walkdown["tuning"]["pitches"][0]


def test_generated_cleanup_reports_its_change(demo_library):
    riff = json.loads(json.dumps(demo_library["riffs"][1]))
    riff["notes"][3]["confidence"] = 0.3
    answer = generate({"task": "cleanup", "riff": riff, "report": {}})
    assert ai_client.schema_problems(schemas.CLEANUP_RESPONSE, answer) == []
    validate_riff(answer["riff"])
    assert answer["changes"][0]["kind"] == "delete"
    assert answer["changes"][0]["noteIds"] == [riff["notes"][3]["id"]]
    assert len(answer["riff"]["notes"]) == len(riff["notes"]) - 1


def test_generated_fake_through_complete_json(demo_library):
    fake = FakeAiClient()
    user = json.dumps({"task": "analyze", "riff": demo_library["riffs"][0]})
    answer = fake.complete_json("sys", user, schemas.ANALYZE_RESPONSE, purpose="analyze")
    assert answer["style"]["turnaroundDetected"] is True
    assert fake.last_usage is not None and fake.last_usage.output_tokens > 0
