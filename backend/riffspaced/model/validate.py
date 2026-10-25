"""Schema validation plus the semantic rules JSON Schema cannot express.

Documents are checked against shared/schema/*.json with the jsonschema library, then the
rules the schema cannot state: chord members share a start, sections cover the riff without
overlap, strings fit the tuning (DECISIONS 17).
"""

from __future__ import annotations

import json
from datetime import datetime
from functools import lru_cache
from typing import Any

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from riffspaced.paths import SCHEMA_DIR

SCHEMA_FILES = {
    "riff": "riff.schema.json",
    "arrangement": "arrangement.schema.json",
    "song": "song.schema.json",
    "library": "library.schema.json",
}


class ValidationError(ValueError):
    """Raised with every problem found, one message per line."""

    def __init__(self, errors: list[str]):
        super().__init__("\n".join(errors))
        self.errors = errors


@lru_cache(maxsize=1)
def _registry() -> Registry:
    # The four schemas reference one another by $id; a registry lets the validator resolve
    # "riff.schema.json#/$defs/tuning" without network access.
    registry: Registry = Registry()
    for filename in SCHEMA_FILES.values():
        schema = json.loads((SCHEMA_DIR / filename).read_text())
        registry = registry.with_resource(schema["$id"], Resource.from_contents(schema))
    return registry


@lru_cache(maxsize=4)
def _validator(kind: str) -> Draft202012Validator:
    schema = json.loads((SCHEMA_DIR / SCHEMA_FILES[kind]).read_text())
    return Draft202012Validator(schema, registry=_registry())


def _path(error: Any) -> str:
    parts: list[str] = []
    for p in error.absolute_path:
        parts.append(f"[{p}]" if isinstance(p, int) else (f".{p}" if parts else str(p)))
    return "".join(parts) or "document"


def schema_errors(kind: str, doc: Any) -> list[str]:
    """Human-readable JSON Schema violations, sorted by path."""
    errors = sorted(_validator(kind).iter_errors(doc), key=lambda e: list(e.absolute_path))
    return [f"{_path(e)}: {e.message}" for e in errors]


def _is_datetime(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def _semantic_riff_errors(doc: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for key in ("createdAt", "updatedAt"):
        if not _is_datetime(doc.get(key)):
            errors.append(f"{key}: must be an ISO 8601 date-time string")
    pitches = doc["tuning"]["pitches"]
    if any(b <= a for a, b in zip(pitches, pitches[1:], strict=False)):
        errors.append("tuning.pitches: must be strictly ascending (low to high)")
    n = len(pitches)
    starts: dict[str, int] = {}
    for i, note in enumerate(doc["notes"]):
        if note["string"] > n:
            errors.append(f"notes[{i}].string: must be an integer between 1 and {n}")
        chord_id = note.get("chordId")
        if chord_id:
            seen = starts.setdefault(chord_id, note["start"])
            if seen != note["start"]:
                errors.append(
                    f"notes[{i}]: shares chordId {chord_id!r} but starts at "
                    f"{note['start']}, not {seen}"
                )
    expected = 0
    for s in sorted(doc["sections"], key=lambda s: s["startBar"]):
        if s["startBar"] != expected:
            errors.append(
                "sections: must be contiguous: expected a section starting at bar "
                f"{expected}, found {s['label']!r} at {s['startBar']}"
            )
            return errors
        expected = s["startBar"] + s["lengthBars"]
    if expected != doc["lengthBars"]:
        errors.append(
            f"sections: must cover 0..{doc['lengthBars']} bars exactly, they cover 0..{expected}"
        )
    return errors


def validate_riff(doc: Any) -> dict[str, Any]:
    """Return the riff dict if valid, else raise ValidationError with every problem."""
    errors = schema_errors("riff", doc)
    if not errors:
        errors = _semantic_riff_errors(doc)
    if errors:
        raise ValidationError(errors)
    return doc


def validate_arrangement(doc: Any) -> dict[str, Any]:
    """Schema plus date-time checks."""
    errors = schema_errors("arrangement", doc)
    if not errors:
        errors = [
            f"{k}: must be an ISO 8601 date-time string"
            for k in ("createdAt", "updatedAt")
            if not _is_datetime(doc.get(k))
        ]
    if errors:
        raise ValidationError(errors)
    return doc


def validate_song(doc: Any) -> dict[str, Any]:
    """Schema plus date-time and tuning order checks."""
    errors = schema_errors("song", doc)
    if not errors:
        errors = [
            f"{k}: must be an ISO 8601 date-time string"
            for k in ("createdAt", "updatedAt")
            if not _is_datetime(doc.get(k))
        ]
        pitches = doc["tuning"]["pitches"]
        if any(b <= a for a, b in zip(pitches, pitches[1:], strict=False)):
            errors.append("tuning.pitches: must be strictly ascending (low to high)")
    if errors:
        raise ValidationError(errors)
    return doc


def validate_library(doc: Any) -> dict[str, Any]:
    """Schema for the bundle, then each item through its own validator with prefixed paths."""
    errors = schema_errors("library", doc)
    if not errors:
        for key, fn in (
            ("riffs", validate_riff),
            ("arrangements", validate_arrangement),
            ("songs", validate_song),
        ):
            for i, item in enumerate(doc[key]):
                try:
                    fn(item)
                except ValidationError as e:
                    errors.extend(f"{key}[{i}]: {msg}" for msg in e.errors)
    if errors:
        raise ValidationError(errors)
    return doc
