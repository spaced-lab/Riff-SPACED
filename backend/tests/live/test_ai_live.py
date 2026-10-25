"""Live smoke test against the real API (plan P7.T5). Costs money; runs only on request.

    RIFFSPACED_LIVE=1 uv run pytest tests/live -q -s

Needs ANTHROPIC_API_KEY (environment or backend/.env). Prints the model's style summary and
the token counts so they can be pasted into docs/AI_LAYER.md as the worked example.
"""

import os

import pytest
from dotenv import load_dotenv

from riffspaced.ai.analyze import analyze_riff
from riffspaced.ai.client import AnthropicAiClient
from riffspaced.ai.suggest import suggest
from riffspaced.model.validate import validate_riff

load_dotenv()

live = pytest.mark.skipif(
    os.getenv("RIFFSPACED_LIVE") != "1" or not os.getenv("ANTHROPIC_API_KEY"),
    reason="set RIFFSPACED_LIVE=1 and ANTHROPIC_API_KEY to run the live smoke test",
)


@live
def test_live_analysis_of_the_demo_walkdown(demo_library):
    client = AnthropicAiClient()
    body = analyze_riff(demo_library["riffs"][0], client)
    labels = [d["label"] for d in body["dyads"]]
    assert body["style"]["turnaroundDetected"] is True
    assert "P5" in labels and "P4" in labels
    assert all(d["source"] == "model" for d in body["dyads"]), "model skipped a chord"
    print("\n--- live analysis ---")
    print("model:", body["model"], "promptVersion:", body["promptVersion"])
    print("usage:", body["usage"])
    print("style:", body["style"])
    print("warnings:", body["warnings"])


@live
def test_live_two_variations_are_valid_and_playable(demo_library):
    client = AnthropicAiClient()
    parent = demo_library["riffs"][0]
    body = suggest(parent, "variation", 2, client)
    assert len(body["suggestions"]) == 2
    for s in body["suggestions"]:
        validate_riff(s["riff"])
        assert s["riff"]["tuning"] == parent["tuning"]
        assert not any(n.get("unplayable") for n in s["riff"]["notes"])
        assert s["riff"]["source"]["parentRiffId"] == parent["id"]
    print("\n--- live variations ---")
    print("usage:", body["usage"])
    for s in body["suggestions"]:
        print("-", s["riff"]["name"], "|", s["rationale"], "| repairs:", s["repairs"])
