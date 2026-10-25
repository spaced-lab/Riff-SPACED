"""Version migrations (SPEC 4.5), mirroring frontend/src/model/migrate.ts.

Migration reshapes without judging; validate afterwards.
"""

from __future__ import annotations

from typing import Any

from riffspaced.model.types import (
    ARRANGEMENT_FORMAT,
    CURRENT_VERSION,
    LIBRARY_FORMAT,
    RIFF_FORMAT,
    SONG_FORMAT,
)


class MigrationError(ValueError):
    """The document is newer than this code understands."""


def _version(doc: dict[str, Any]) -> int:
    v = doc.get("version")
    return v if isinstance(v, int) else 0


def _check_not_future(doc: dict[str, Any], kind: str) -> None:
    if _version(doc) > CURRENT_VERSION:
        raise MigrationError(
            f"{kind} version {_version(doc)} is newer than this app understands ({CURRENT_VERSION})"
        )


def _riff_v0_to_v1(doc: dict[str, Any]) -> dict[str, Any]:
    # v0: `bars` instead of `lengthBars`, no `sections`, no `timeSignature`.
    length_bars = doc.get("bars", doc.get("lengthBars", 4))
    out = {k: v for k, v in doc.items() if k != "bars"}
    out["version"] = 1
    out["lengthBars"] = length_bars
    out.setdefault("timeSignature", {"beats": 4, "unit": 4})
    out.setdefault(
        "sections",
        [
            {
                "id": f"{doc.get('id', 'riff')}-main",
                "label": "A",
                "startBar": 0,
                "lengthBars": length_bars,
                "kind": "main",
            }
        ],
    )
    return out


def migrate_riff(doc: dict[str, Any]) -> dict[str, Any]:
    """Upgrade a riff dict to the current version."""
    doc = {**doc, "format": doc.get("format", RIFF_FORMAT)}
    _check_not_future(doc, "riff")
    if _version(doc) < 1:
        doc = _riff_v0_to_v1(doc)
    return doc


def migrate_arrangement(doc: dict[str, Any]) -> dict[str, Any]:
    """Upgrade an arrangement dict (only v1 exists)."""
    doc = {**doc, "format": doc.get("format", ARRANGEMENT_FORMAT)}
    _check_not_future(doc, "arrangement")
    return {**doc, "version": 1}


def migrate_song(doc: dict[str, Any]) -> dict[str, Any]:
    """Upgrade a song dict (only v1 exists)."""
    doc = {**doc, "format": doc.get("format", SONG_FORMAT)}
    _check_not_future(doc, "song")
    return {**doc, "version": 1}


def migrate_library(doc: dict[str, Any]) -> dict[str, Any]:
    """Upgrade a bundle and everything inside it."""
    doc = {**doc, "format": doc.get("format", LIBRARY_FORMAT)}
    _check_not_future(doc, "library")
    return {
        **doc,
        "version": 1,
        "riffs": [migrate_riff(r) for r in doc.get("riffs", [])],
        "arrangements": [migrate_arrangement(a) for a in doc.get("arrangements", [])],
        "songs": [migrate_song(s) for s in doc.get("songs", [])],
    }


def migrate_any(doc: dict[str, Any]) -> dict[str, Any]:
    """Dispatch on `format`."""
    fmt = doc.get("format")
    if fmt == ARRANGEMENT_FORMAT:
        return migrate_arrangement(doc)
    if fmt == SONG_FORMAT:
        return migrate_song(doc)
    if fmt == LIBRARY_FORMAT:
        return migrate_library(doc)
    return migrate_riff(doc)
