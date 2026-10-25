"""Precomputed musical facts that go to the model with every riff (plan P7.T2).

The model should not have to do arithmetic the backend already does perfectly: which pitch a
(string, fret) pair sounds, what interval a dyad is, where in the bar a chord starts. Giving it
those facts leaves it the judgment (what the riff is doing, what to suggest) and makes its
answers consistent across calls, which matters more now that sampling cannot be tuned
(DECISIONS 55).
"""

from __future__ import annotations

from typing import Any

from riffspaced.music.dyad import describe_dyad
from riffspaced.music.naming import name_of
from riffspaced.music.time import format_position
from riffspaced.music.tuning import Tuning, pitch_of


def note_facts(riff: dict[str, Any], tuning: Tuning) -> list[dict[str, Any]]:
    """One row per note: pitch, name, position, mute flag."""
    rows = []
    for note in riff["notes"]:
        pitch = pitch_of(tuning, note["string"], note["fret"])
        rows.append(
            {
                "id": note["id"],
                "string": note["string"],
                "fret": note["fret"],
                "pitch": pitch,
                "name": name_of(pitch),
                "start": note["start"],
                "position": format_position(note["start"]),
                "duration": note["duration"],
                "palmMute": "palmMute" in note.get("techniques", []),
                "chordId": note.get("chordId"),
            }
        )
    return rows


def chord_facts(riff: dict[str, Any], tuning: Tuning) -> list[dict[str, Any]]:
    """One row per chordId with the interval description from `describe_dyad`.

    Chords with one note (a chordId left behind by an edit) or more than two notes are still
    listed, with `label` None, so the model can mention them in `warnings`.
    """
    groups: dict[str, list[dict[str, Any]]] = {}
    for note in riff["notes"]:
        chord_id = note.get("chordId")
        if chord_id:
            groups.setdefault(chord_id, []).append(note)
    rows = []
    for chord_id, notes in groups.items():
        pitches = [pitch_of(tuning, n["string"], n["fret"]) for n in notes]
        row: dict[str, Any] = {
            "chordId": chord_id,
            "start": notes[0]["start"],
            "position": format_position(notes[0]["start"]),
            "notes": [
                {"id": n["id"], "string": n["string"], "fret": n["fret"], "name": name_of(p)}
                for n, p in zip(notes, pitches, strict=True)
            ],
            "label": None,
            "semitones": None,
            "root": None,
            "inverted": None,
        }
        if len(notes) == 2:
            info = describe_dyad(pitches[0], pitches[1])
            row.update(
                label=info.interval,
                semitones=info.semitones,
                root=name_of(info.root_pitch_class + 12, with_octave=False),
                inverted=not info.lower_is_root,
            )
        rows.append(row)
    return rows


def riff_facts(riff: dict[str, Any]) -> dict[str, Any]:
    """Everything derivable from the riff that the prompts promise the model."""
    tuning = Tuning.from_dict(riff["tuning"])
    notes = note_facts(riff, tuning)
    return {
        "tuning": {
            "name": tuning.name,
            "openStrings": {
                str(s): name_of(pitch_of(tuning, s, 0)) for s in range(tuning.string_count, 0, -1)
            },
        },
        "lengthBars": riff["lengthBars"],
        "bpm": riff["tempo"]["bpm"],
        "sections": [
            {
                "id": s["id"],
                "label": s["label"],
                "kind": s["kind"],
                "bars": f"{s['startBar'] + 1}-{s['startBar'] + s['lengthBars']}",
            }
            for s in riff["sections"]
        ],
        "noteCount": len(notes),
        "palmMutedCount": sum(1 for n in notes if n["palmMute"]),
        "stringsUsed": sorted({n["string"] for n in notes}, reverse=True),
        "notes": notes,
        "chords": chord_facts(riff, tuning),
    }
