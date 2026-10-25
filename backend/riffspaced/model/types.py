"""Dataclasses for the document tiers (SPEC 4) with JSON round-tripping.

Field names stay camelCase in JSON and snake_case in Python; `from_dict` and `to_dict`
are the only places that know both spellings.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from riffspaced.music.tuning import Tuning

RIFF_FORMAT = "riff-spaced/riff"
ARRANGEMENT_FORMAT = "riff-spaced/arrangement"
SONG_FORMAT = "riff-spaced/song"
LIBRARY_FORMAT = "riff-spaced/library"
CURRENT_VERSION = 1

TECHNIQUES = (
    "palmMute",
    "letRing",
    "slideUp",
    "slideDown",
    "bend",
    "hammerOn",
    "pullOff",
    "vibrato",
    "dead",
    "harmonic",
    "tremolo",
)
SECTION_KINDS = ("main", "variation", "turnaround", "bridge", "other")
SOURCE_TYPES = ("manual", "audio", "ai")
MAX_FRET = 24


def _drop_none(d: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in d.items() if v is not None}


@dataclass
class Note:
    """One note on one string (SPEC 4.1)."""

    id: str
    string: int
    fret: int
    start: int
    duration: int
    velocity: int = 100
    techniques: list[str] = field(default_factory=list)
    chord_id: str | None = None
    confidence: float = 1.0
    unplayable: bool = False

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Note:
        """Build from JSON."""
        return cls(
            id=d["id"],
            string=d["string"],
            fret=d["fret"],
            start=d["start"],
            duration=d["duration"],
            velocity=d.get("velocity", 100),
            techniques=list(d.get("techniques", [])),
            chord_id=d.get("chordId"),
            confidence=d.get("confidence", 1.0),
            unplayable=d.get("unplayable", False),
        )

    def to_dict(self) -> dict[str, Any]:
        """JSON shape; optional fields are written only when they carry information."""
        out: dict[str, Any] = {
            "id": self.id,
            "string": self.string,
            "fret": self.fret,
            "start": self.start,
            "duration": self.duration,
            "velocity": self.velocity,
        }
        if self.techniques:
            out["techniques"] = list(self.techniques)
        if self.chord_id:
            out["chordId"] = self.chord_id
        if self.confidence != 1.0:
            out["confidence"] = self.confidence
        if self.unplayable:
            out["unplayable"] = True
        return out


@dataclass
class Section:
    """A labeled bar range (SPEC 4.1)."""

    id: str
    label: str
    start_bar: int
    length_bars: int
    kind: str = "main"

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Section:
        """Build from JSON."""
        return cls(d["id"], d["label"], d["startBar"], d["lengthBars"], d.get("kind", "main"))

    def to_dict(self) -> dict[str, Any]:
        """JSON shape."""
        return {
            "id": self.id,
            "label": self.label,
            "startBar": self.start_bar,
            "lengthBars": self.length_bars,
            "kind": self.kind,
        }


@dataclass
class Riff:
    """A riff document (SPEC 4.1)."""

    id: str
    name: str
    created_at: str
    updated_at: str
    tuning: Tuning
    bpm: float
    length_bars: int
    sections: list[Section]
    notes: list[Note]
    time_signature: tuple[int, int] = (4, 4)
    tags: list[str] = field(default_factory=list)
    style: dict[str, Any] | None = None
    naming_prefs: dict[str, Any] | None = None
    source: dict[str, Any] | None = None

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Riff:
        """Build from validated JSON."""
        ts = d.get("timeSignature", {"beats": 4, "unit": 4})
        return cls(
            id=d["id"],
            name=d["name"],
            created_at=d["createdAt"],
            updated_at=d["updatedAt"],
            tuning=Tuning.from_dict(d["tuning"]),
            bpm=d["tempo"]["bpm"],
            length_bars=d["lengthBars"],
            sections=[Section.from_dict(s) for s in d["sections"]],
            notes=[Note.from_dict(n) for n in d["notes"]],
            time_signature=(ts["beats"], ts["unit"]),
            tags=list(d.get("tags", [])),
            style=d.get("style"),
            naming_prefs=d.get("namingPrefs"),
            source=d.get("source"),
        )

    def to_dict(self) -> dict[str, Any]:
        """JSON shape matching riff.schema.json."""
        return _drop_none(
            {
                "format": RIFF_FORMAT,
                "version": CURRENT_VERSION,
                "id": self.id,
                "name": self.name,
                "createdAt": self.created_at,
                "updatedAt": self.updated_at,
                "tuning": self.tuning.to_dict(),
                "tempo": {"bpm": self.bpm},
                "timeSignature": {"beats": self.time_signature[0], "unit": self.time_signature[1]},
                "ppq": 480,
                "lengthBars": self.length_bars,
                "sections": [s.to_dict() for s in self.sections],
                "notes": [n.to_dict() for n in self.notes],
                "tags": list(self.tags),
                "style": self.style,
                "namingPrefs": self.naming_prefs,
                "source": self.source,
            }
        )


@dataclass
class Arrangement:
    """An ordered sequence of riff references (SPEC 4.2)."""

    id: str
    name: str
    bpm: float
    entries: list[dict[str, Any]]
    created_at: str
    updated_at: str
    tags: list[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Arrangement:
        """Build from validated JSON."""
        return cls(
            d["id"],
            d["name"],
            d["tempo"]["bpm"],
            list(d["entries"]),
            d["createdAt"],
            d["updatedAt"],
            list(d.get("tags", [])),
        )

    def to_dict(self) -> dict[str, Any]:
        """JSON shape."""
        return {
            "format": ARRANGEMENT_FORMAT,
            "version": CURRENT_VERSION,
            "id": self.id,
            "name": self.name,
            "tempo": {"bpm": self.bpm},
            "entries": list(self.entries),
            "tags": list(self.tags),
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }


@dataclass
class Song:
    """A tuning plus ordered arrangement parts (SPEC 4.3)."""

    id: str
    title: str
    tuning: Tuning
    parts: list[dict[str, Any]]
    created_at: str
    updated_at: str
    notes: str = ""
    tags: list[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Song:
        """Build from validated JSON."""
        return cls(
            d["id"],
            d["title"],
            Tuning.from_dict(d["tuning"]),
            list(d["parts"]),
            d["createdAt"],
            d["updatedAt"],
            d.get("notes", ""),
            list(d.get("tags", [])),
        )

    def to_dict(self) -> dict[str, Any]:
        """JSON shape."""
        return {
            "format": SONG_FORMAT,
            "version": CURRENT_VERSION,
            "id": self.id,
            "title": self.title,
            "tuning": self.tuning.to_dict(),
            "parts": list(self.parts),
            "notes": self.notes,
            "tags": list(self.tags),
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }


@dataclass
class LibraryBundle:
    """Everything in one file (SPEC 4.4)."""

    exported_at: str
    riffs: list[Riff]
    arrangements: list[Arrangement]
    songs: list[Song]

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> LibraryBundle:
        """Build from validated JSON."""
        return cls(
            d["exportedAt"],
            [Riff.from_dict(r) for r in d["riffs"]],
            [Arrangement.from_dict(a) for a in d["arrangements"]],
            [Song.from_dict(s) for s in d["songs"]],
        )

    def to_dict(self) -> dict[str, Any]:
        """JSON shape."""
        return {
            "format": LIBRARY_FORMAT,
            "version": CURRENT_VERSION,
            "exportedAt": self.exported_at,
            "riffs": [r.to_dict() for r in self.riffs],
            "arrangements": [a.to_dict() for a in self.arrangements],
            "songs": [s.to_dict() for s in self.songs],
        }
