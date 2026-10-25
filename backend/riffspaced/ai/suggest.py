"""POST /ai/suggest (SPEC 9.2, plan P7.T3): variations, counter riffs, fingerings, tunings.

The model writes whole riffs. The backend treats each one as a draft: it must validate, it
keeps the input tuning unless the kind is `tunings`, every simultaneous group must be
something a hand can play (else `best_fingering` repairs it or the notes are flagged
`unplayable`), the `source` says exactly which model and prompt made it, and a suggestion is
capped at 400 notes. Every repair is listed so the UI can say what changed.
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

from riffspaced.ai.client import AiClient
from riffspaced.ai.facts import riff_facts
from riffspaced.ai.prompting import load_prompt
from riffspaced.ai.schemas import SUGGEST_KINDS, SUGGEST_RESPONSE
from riffspaced.model.validate import ValidationError, validate_riff
from riffspaced.music.fingering import MAX_SPAN, Position, best_fingering, hand_span
from riffspaced.music.tuning import Tuning, pitch_of

MAX_NOTES = 400
SUGGEST_FRET_RANGE = (0, 15)


def build_request(
    riff: dict[str, Any],
    kind: str,
    count: int,
    intent: str | None,
    avoid: list[str],
) -> dict[str, Any]:
    """The JSON envelope the suggest prompt describes."""
    return {
        "task": "suggest",
        "kind": kind,
        "count": count,
        "intent": intent or None,
        "avoid": list(avoid),
        "riff": riff,
        "facts": riff_facts(riff),
    }


def check_suggestions(answer: dict[str, Any]) -> list[str]:
    """Problems quoted back to the model: every suggested riff must validate."""
    problems: list[str] = []
    for i, suggestion in enumerate(answer["suggestions"]):
        try:
            validate_riff(suggestion["riff"])
        except ValidationError as error:
            problems.extend(f"suggestions[{i}].riff: {msg}" for msg in error.errors)
    return problems


def _groups(notes: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """Notes that sound together: same start and chordId (single notes are their own group)."""
    seen: dict[tuple[int, str], list[dict[str, Any]]] = {}
    order: list[list[dict[str, Any]]] = []
    for note in sorted(notes, key=lambda n: n["start"]):
        key = (note["start"], note.get("chordId") or f"solo:{note['id']}")
        if key not in seen:
            seen[key] = []
            order.append(seen[key])
        seen[key].append(note)
    return order


def _playable_as_written(positions: list[Position], tuning: Tuning) -> bool:
    strings = [p.string for p in positions]
    if len(set(strings)) != len(strings):
        return False
    if any(not 1 <= p.string <= tuning.string_count for p in positions):
        return False
    return hand_span(positions) <= MAX_SPAN


def repair_fingerings(riff: dict[str, Any], sounding: Tuning) -> list[str]:
    """Make every group playable on `riff["tuning"]`, keeping the pitches the model meant.

    `sounding` is the tuning the model's (string, fret) pairs were written for; when the
    tuning has been forced back to the parent's, that differs from `riff["tuning"]` and the
    pitches are what carries over. Returns one line per repaired or flagged group.
    """
    target = Tuning.from_dict(riff["tuning"])
    notes_out: list[str] = []
    previous: list[Position] | None = None
    for group in _groups(riff["notes"]):
        pitches = [pitch_of(sounding, n["string"], n["fret"]) for n in group]
        written = [Position(n["string"], n["fret"]) for n in group]
        same_tuning = sounding.pitches == target.pitches
        if same_tuning and _playable_as_written(written, target):
            for n in group:
                n.pop("unplayable", None)
            previous = written
            continue
        found = best_fingering(pitches, target, previous, fret_range=SUGGEST_FRET_RANGE)
        ids = ", ".join(n["id"] for n in group)
        if found is None:
            for n in group:
                n["unplayable"] = True
            notes_out.append(f"flagged unplayable: {ids} (pitches {pitches} not on this tuning)")
            continue
        for n, pos in zip(group, found, strict=True):
            n["string"], n["fret"] = pos.string, pos.fret
            n.pop("unplayable", None)
        notes_out.append(f"refingered: {ids} to {[p.to_pair() for p in found]}")
        previous = found
    return notes_out


def finish_suggestion(
    suggestion: dict[str, Any],
    parent: dict[str, Any],
    kind: str,
    model: str,
    prompt_version: int,
) -> dict[str, Any]:
    """Apply the backend's rules to one validated suggestion and return the API shape."""
    riff = suggestion["riff"]
    repairs: list[str] = []
    sounding = Tuning.from_dict(riff["tuning"])
    if kind != "tunings" and riff["tuning"]["pitches"] != parent["tuning"]["pitches"]:
        riff["tuning"] = dict(parent["tuning"])
        name = parent["tuning"]["name"]
        repairs.append(f"tuning restored to {name} (only the 'tunings' kind may change it)")
    if len(riff["notes"]) > MAX_NOTES:
        riff["notes"] = sorted(riff["notes"], key=lambda n: n["start"])[:MAX_NOTES]
        repairs.append(f"truncated to the first {MAX_NOTES} notes")
    repairs.extend(repair_fingerings(riff, sounding))
    now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    if not riff.get("id") or riff["id"] == parent["id"]:
        riff["id"] = str(uuid.uuid4())
    riff["createdAt"] = riff.get("createdAt") or now
    riff["updatedAt"] = now
    riff["tags"] = sorted({*riff.get("tags", []), "ai"})
    riff["source"] = {
        "type": "ai",
        "model": model,
        "promptVersion": prompt_version,
        "parentRiffId": parent["id"],
    }
    validate_riff(riff)
    return {
        "riff": riff,
        "rationale": suggestion["rationale"],
        "playingNotes": suggestion["playingNotes"],
        "repairs": repairs,
    }


def suggest(
    riff: dict[str, Any],
    kind: str,
    count: int,
    client: AiClient,
    intent: str | None = None,
    avoid: list[str] | None = None,
) -> dict[str, Any]:
    """Validate the input, ask the model, repair, and return the API response body."""
    if kind not in SUGGEST_KINDS:
        raise ValueError(f"unknown kind {kind!r}; expected one of {', '.join(SUGGEST_KINDS)}")
    if not 1 <= count <= 4:
        raise ValueError("count must be between 1 and 4")
    validate_riff(riff)
    prompt = load_prompt("suggest")
    user = json.dumps(build_request(riff, kind, count, intent, avoid or []))
    answer = client.complete_json(
        prompt.text, user, SUGGEST_RESPONSE, purpose=f"suggest:{kind}", check=check_suggestions
    )
    suggestions = [
        finish_suggestion(s, riff, kind, client.model, prompt.version)
        for s in answer["suggestions"][:count]
    ]
    warnings: list[str] = []
    if len(suggestions) < count:
        warnings.append(f"asked for {count} suggestions, the model returned {len(suggestions)}")
    usage = client.last_usage
    return {
        "kind": kind,
        "suggestions": suggestions,
        "warnings": warnings,
        "model": client.model,
        "promptVersion": prompt.version,
        "usage": usage.to_dict() if usage else None,
    }
