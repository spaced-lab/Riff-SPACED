"""POST /ai/analyze (SPEC 9.2, plan P7.T2): name the dyads, read the style.

The model gets the riff plus the precomputed facts and answers with dyad labels and a style
reading. The backend then makes sure every chord in the riff has a label: anything the model
skipped is filled from `describe_dyad` and marked `source: "computed"`, so the UI can always
draw a label above every chord bracket and still show which ones came from the model.
"""

from __future__ import annotations

import json
from typing import Any

from riffspaced.ai.client import AiClient
from riffspaced.ai.facts import riff_facts
from riffspaced.ai.prompting import load_prompt
from riffspaced.ai.schemas import ANALYZE_RESPONSE
from riffspaced.model.validate import validate_riff


def build_user_message(riff: dict[str, Any]) -> str:
    """The JSON envelope the analyze prompt describes."""
    return json.dumps({"task": "analyze", "riff": riff, "facts": riff_facts(riff)})


def fill_missing_dyads(answer: dict[str, Any], facts: dict[str, Any]) -> list[str]:
    """Make `answer["dyads"]` cover every two-note chord; return warnings about the rest.

    Model entries keep their order and get `source: "model"`; entries for chords the model
    did not mention are appended in riff order with `source: "computed"`. Entries naming a
    chordId that is not in the riff are dropped, with a warning, rather than shown.
    """
    known = {c["chordId"]: c for c in facts["chords"]}
    warnings: list[str] = []
    kept: list[dict[str, Any]] = []
    seen: set[str] = set()
    for dyad in answer["dyads"]:
        chord_id = dyad["chordId"]
        if chord_id not in known:
            warnings.append(f"model named a chordId that is not in the riff: {chord_id}")
            continue
        if chord_id in seen:
            continue
        seen.add(chord_id)
        kept.append({**dyad, "source": "model"})
    for chord in facts["chords"]:
        if chord["chordId"] in seen:
            continue
        if chord["label"] is None:
            warnings.append(
                f"chord {chord['chordId']} has {len(chord['notes'])} notes, not a dyad; no label"
            )
            continue
        kept.append(
            {
                "chordId": chord["chordId"],
                "label": chord["label"],
                "altLabels": [],
                "root": chord["root"],
                "inverted": chord["inverted"],
                "source": "computed",
            }
        )
    answer["dyads"] = kept
    return warnings


def analyze_riff(riff: dict[str, Any], client: AiClient) -> dict[str, Any]:
    """Validate the riff, ask the model, post-process, and return the API response body."""
    validate_riff(riff)
    prompt = load_prompt("analyze")
    facts = riff_facts(riff)
    user = json.dumps({"task": "analyze", "riff": riff, "facts": facts})
    answer = client.complete_json(prompt.text, user, ANALYZE_RESPONSE, purpose="analyze")
    warnings = fill_missing_dyads(answer, facts)
    answer["warnings"] = [*answer["warnings"], *warnings]
    answer["model"] = client.model
    answer["promptVersion"] = prompt.version
    usage = client.last_usage
    answer["usage"] = usage.to_dict() if usage else None
    return answer
