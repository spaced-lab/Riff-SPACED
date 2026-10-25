"""JSON shapes the model must return (SPEC 9.2), as JSON Schema.

The client validates every answer against one of these before the endpoint sees it, and the
same text is shown to the model inside the prompt. Riffs inside an answer are checked only
loosely here (`type: object`); the endpoints run the full riff validator on each one, so
a bad riff still earns the model its one retry.
"""

from __future__ import annotations

from typing import Any

from riffspaced.music.dyad import LABELS

DYAD_LABELS = (*LABELS, "P8")

# Suggestion kinds (SPEC 9.2). The guidance per kind lives in prompts/suggest.md.
SUGGEST_KINDS = (
    "variation",
    "counterRiff",
    "counterMelody",
    "switchUp",
    "simplify",
    "embellish",
    "newInStyle",
    "fingerings",
    "tunings",
)

# What the cleanup pass may do to an imported riff (SPEC 9.2, plan P7.T4).
CHANGE_KINDS = ("moveFret", "merge", "split", "palmMute", "delete")

_STRING_LIST: dict[str, Any] = {"type": "array", "items": {"type": "string"}}

ANALYZE_RESPONSE: dict[str, Any] = {
    "type": "object",
    "required": ["dyads", "style", "warnings"],
    "additionalProperties": False,
    "properties": {
        "dyads": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["chordId", "label", "altLabels", "root", "inverted"],
                "additionalProperties": False,
                "properties": {
                    "chordId": {"type": "string", "minLength": 1},
                    "label": {"enum": list(DYAD_LABELS)},
                    "altLabels": _STRING_LIST,
                    "root": {"type": "string", "minLength": 1},
                    "inverted": {"type": "boolean"},
                },
            },
        },
        "style": {
            "type": "object",
            "required": [
                "keyCenterGuess",
                "modeGuess",
                "chromaticDevices",
                "turnaroundDetected",
                "summary",
            ],
            "additionalProperties": False,
            "properties": {
                "keyCenterGuess": {"type": "string"},
                "modeGuess": {"type": "string"},
                "chromaticDevices": _STRING_LIST,
                "turnaroundDetected": {"type": "boolean"},
                "summary": {"type": "string", "minLength": 1},
            },
        },
        "warnings": _STRING_LIST,
    },
}

SUGGEST_RESPONSE: dict[str, Any] = {
    "type": "object",
    "required": ["suggestions"],
    "additionalProperties": False,
    "properties": {
        "suggestions": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "required": ["riff", "rationale", "playingNotes"],
                "additionalProperties": False,
                "properties": {
                    "riff": {"type": "object"},
                    "rationale": {"type": "string", "minLength": 1},
                    "playingNotes": {"type": "string"},
                },
            },
        }
    },
}

CLEANUP_RESPONSE: dict[str, Any] = {
    "type": "object",
    "required": ["riff", "changes"],
    "additionalProperties": False,
    "properties": {
        "riff": {"type": "object"},
        "changes": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["kind", "noteIds", "reason"],
                "additionalProperties": False,
                "properties": {
                    "kind": {"enum": list(CHANGE_KINDS)},
                    "noteIds": {"type": "array", "items": {"type": "string"}, "minItems": 1},
                    "reason": {"type": "string", "minLength": 1},
                },
            },
        },
    },
}
