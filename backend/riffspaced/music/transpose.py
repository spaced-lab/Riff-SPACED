"""Transpose and retune (SPEC 3.7), mirroring frontend/src/music/transpose.ts.

Both tools are one operation: decide the pitch each note should sound, then refinger every
simultaneous group with `best_fingering`, carrying the previous group's hand position for
continuity. A note no position can reach is flagged `unplayable` and kept where it was,
never dropped. The backend uses this for the AI tuning suggestions and the tuning search.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Literal

from riffspaced.music.fingering import Position, best_fingering
from riffspaced.music.tuning import Tuning, pitch_of

RetuneMode = Literal["keepShapes", "keepPitches"]
Note = dict[str, Any]


@dataclass(frozen=True)
class RefingerResult:
    """The new riff dict plus how many notes were flagged and how many moved."""

    riff: dict[str, Any]
    unplayable: int
    moved: int


def simultaneous_groups(notes: list[Note]) -> list[list[Note]]:
    """Notes that sound together: same start and chordId; a single note is its own group."""
    by_key: dict[str, list[Note]] = {}
    order: list[list[Note]] = []
    for note in sorted(notes, key=lambda n: n["start"]):
        key = f"{note['start']}:{note.get('chordId') or 'solo:' + note['id']}"
        group = by_key.get(key)
        if group is None:
            group = by_key[key] = []
            order.append(group)
        group.append(note)
    return order


def search_passes(tuning: Tuning) -> list[dict[str, Any]]:
    """The home range first (frets 0 to 12, low four strings), then the whole neck."""
    every = list(range(1, tuning.string_count + 1))
    return [{"fret_range": (0, 12)}, {"fret_range": (0, 24), "allowed_strings": every}]


def refinger_riff(
    riff: dict[str, Any], tuning: Tuning, target_pitch: Callable[[Note], int]
) -> RefingerResult:
    """Give every note the position that sounds `target_pitch(note)` on `tuning`."""
    positions: dict[str, Position | None] = {}
    previous: list[Position] | None = None
    for group in simultaneous_groups(riff["notes"]):
        pitches = [target_pitch(n) for n in group]
        found: list[Position] | None = None
        for options in search_passes(tuning):
            found = best_fingering(pitches, tuning, previous, **options)
            if found:
                break
        for i, note in enumerate(group):
            positions[note["id"]] = found[i] if found else None
        if found:
            previous = found
    unplayable = moved = 0
    notes: list[Note] = []
    for note in riff["notes"]:
        position = positions.get(note["id"])
        if position is None:
            unplayable += 1
            notes.append({**note, "unplayable": True})
            continue
        if (position.string, position.fret) != (note["string"], note["fret"]):
            moved += 1
        moved_note = {k: v for k, v in note.items() if k != "unplayable"}
        moved_note["string"], moved_note["fret"] = position.string, position.fret
        notes.append(moved_note)
    return RefingerResult({**riff, "tuning": tuning.to_dict(), "notes": notes}, unplayable, moved)


def transpose_riff(riff: dict[str, Any], semitones: int) -> RefingerResult:
    """Shift every pitch by `semitones` on the same tuning and refinger."""
    if semitones == 0:
        return RefingerResult(riff, 0, 0)
    tuning = Tuning.from_dict(riff["tuning"])
    return refinger_riff(
        riff, tuning, lambda n: pitch_of(tuning, n["string"], n["fret"]) + semitones
    )


def retune_riff(riff: dict[str, Any], tuning: Tuning, mode: RetuneMode) -> RefingerResult:
    """Change tuning keeping shapes (pitches move) or keeping pitches (positions move)."""
    old = Tuning.from_dict(riff["tuning"])
    if mode == "keepShapes":
        unplayable = 0
        notes: list[Note] = []
        for note in riff["notes"]:
            if note["string"] <= tuning.string_count:
                notes.append({k: v for k, v in note.items() if k != "unplayable"})
            else:
                unplayable += 1
                notes.append({**note, "unplayable": True})
        return RefingerResult({**riff, "tuning": tuning.to_dict(), "notes": notes}, unplayable, 0)

    def sounding(n: Note) -> int:
        if n["string"] <= old.string_count:
            return pitch_of(old, n["string"], n["fret"])
        return pitch_of(tuning, 1, 24)

    return refinger_riff(riff, tuning, sounding)
