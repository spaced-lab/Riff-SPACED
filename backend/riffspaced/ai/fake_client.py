"""A deterministic stand-in for the model (plan P7.T1, DECISIONS 54).

Two modes:

- **scripted**: `FakeAiClient(scripted=[text, ...])` returns those texts in order. Tests use it
  to stage a malformed first answer, a missing dyad, an out-of-bounds cleanup edit.
- **generated** (default): the fake reads the request JSON the endpoint sent as the user
  message and derives a plausible, schema-valid answer from the riff itself with the same
  music helpers the backend uses. That lets every endpoint, the ingest `--ai` flag and the
  frontend e2e suite run end to end without a key, in CI too.

The fake is not clever and does not try to be: its job is to exercise every validation and
repair path in the backend with answers that look like the real thing in shape.
"""

from __future__ import annotations

import copy
import json
from collections import Counter
from datetime import UTC, datetime
from typing import Any

from riffspaced.ai.client import AiClient, Completion, Message
from riffspaced.music.dyad import describe_dyad
from riffspaced.music.fingering import Position, best_fingering, find_fingerings
from riffspaced.music.naming import name_of
from riffspaced.music.tuning import ALL_PRESETS, Tuning, pitch_of

FAKE_MODEL = "fake"


class FakeAiClient(AiClient):
    """See the module docstring. `calls` keeps every (system, messages) pair for assertions."""

    def __init__(self, model: str = FAKE_MODEL, scripted: list[str] | None = None) -> None:
        super().__init__(model)
        self.scripted = list(scripted) if scripted is not None else None
        self.calls: list[tuple[str, list[Message]]] = []

    def _complete(self, system: str, messages: list[Message], purpose: str) -> Completion:
        self.calls.append((system, [dict(m) for m in messages]))
        if self.scripted is not None:
            if not self.scripted:
                raise AssertionError("FakeAiClient ran out of scripted responses")
            text = self.scripted.pop(0)
        else:
            text = json.dumps(generate(json.loads(messages[0]["content"])), indent=1)
        # Rough token estimate so usage reporting has something to show.
        return Completion(text=text, input_tokens=len(system) // 4, output_tokens=len(text) // 4)


def generate(request: dict[str, Any]) -> dict[str, Any]:
    """Dispatch on `request["task"]` (analyze, suggest, cleanup)."""
    task = request.get("task")
    if task == "analyze":
        return fake_analysis(request["riff"])
    if task == "suggest":
        return fake_suggestions(
            request["riff"], request["kind"], int(request.get("count", 1)), request
        )
    if task == "cleanup":
        return fake_cleanup(request["riff"])
    raise ValueError(f"fake client: unknown task {task!r}")


# --- analyze -----------------------------------------------------------------------------


def chord_groups(riff: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    """Notes grouped by chordId, in order of first appearance."""
    groups: dict[str, list[dict[str, Any]]] = {}
    for note in riff["notes"]:
        chord_id = note.get("chordId")
        if chord_id:
            groups.setdefault(chord_id, []).append(note)
    return groups


def chromatic_descents(riff: dict[str, Any], tuning: Tuning) -> list[list[int]]:
    """Runs of three or more consecutive half-step descents on the lowest string."""
    lowest = tuning.string_count
    pitches = [
        pitch_of(tuning, n["string"], n["fret"])
        for n in sorted(riff["notes"], key=lambda n: n["start"])
        if n["string"] == lowest
    ]
    distinct: list[int] = []
    for p in pitches:
        if not distinct or distinct[-1] != p:
            distinct.append(p)
    runs: list[list[int]] = []
    run: list[int] = []
    for a, b in zip(distinct, distinct[1:], strict=False):
        if b == a - 1:
            run = run or [a]
            run.append(b)
        else:
            if len(run) >= 3:
                runs.append(run)
            run = []
    if len(run) >= 3:
        runs.append(run)
    return runs


def fake_analysis(riff: dict[str, Any]) -> dict[str, Any]:
    """Dyad labels from `describe_dyad`, a key guess from the bass, a canned summary."""
    tuning = Tuning.from_dict(riff["tuning"])
    dyads = []
    for chord_id, notes in chord_groups(riff).items():
        if len(notes) < 2:
            continue
        a, b = (pitch_of(tuning, n["string"], n["fret"]) for n in notes[:2])
        info = describe_dyad(a, b)
        dyads.append(
            {
                "chordId": chord_id,
                "label": info.interval,
                "altLabels": [],
                "root": name_of(info.root_pitch_class + 12, with_octave=False),
                "inverted": not info.lower_is_root,
            }
        )
    bass = Counter(
        pitch_of(tuning, n["string"], n["fret"]) % 12
        for n in riff["notes"]
        if n["string"] == tuning.string_count
    )
    key = name_of(bass.most_common(1)[0][0] + 12, with_octave=False) if bass else "unknown"
    descents = chromatic_descents(riff, tuning)
    devices = []
    if descents:
        devices.append("chromatic descent in half steps on the low string")
    labels = {d["label"] for d in dyads}
    if "TT" in labels:
        devices.append("tritone dyad")
    if "m2" in labels:
        devices.append("minor second clash")
    if any(d["inverted"] for d in dyads):
        devices.append("inverted power chord (root on top)")
    turnaround = bool(descents)
    summary = (
        f"{len(riff['notes'])} notes over {riff['lengthBars']} bars in {tuning.name}. "
        f"Dyads: {', '.join(sorted(labels)) or 'none'}. "
        + (
            "A blues turnaround: the low string walks down chromatically while the "
            "upper note holds."
            if turnaround
            else "No chromatic walkdown found; the riff sits on its shapes."
        )
    )
    return {
        "dyads": dyads,
        "style": {
            "keyCenterGuess": key,
            "modeGuess": "chromatic minor" if descents else "minor",
            "chromaticDevices": devices,
            "turnaroundDetected": turnaround,
            "summary": summary,
        },
        "warnings": [] if dyads else ["no dyads in this riff; labels are empty"],
    }


# --- suggest -----------------------------------------------------------------------------


def _stamp(riff: dict[str, Any], suffix: str, kind: str, index: int) -> dict[str, Any]:
    out = copy.deepcopy(riff)
    now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    out["id"] = f"{riff['id']}-{kind}-{index + 1}"
    out["name"] = f"{riff['name']} ({suffix} {index + 1})"
    out["createdAt"] = now
    out["updatedAt"] = now
    out["tags"] = sorted({*riff.get("tags", []), "ai"})
    out["source"] = {"type": "ai", "model": FAKE_MODEL, "parentRiffId": riff["id"]}
    return out


def _nudge(riff: dict[str, Any], index: int, direction: int) -> None:
    """Move a few notes by one fret: the cheapest 'intentional chromatic tension'."""
    notes = riff["notes"]
    for k in range(index, len(notes), 7):
        fret = notes[k]["fret"] + direction
        if 0 <= fret <= 24:
            notes[k]["fret"] = fret


def _lower_tunings(current: Tuning) -> list[Tuning]:
    return [
        t
        for t in ALL_PRESETS
        if t.string_count == current.string_count and t.pitches[0] < current.pitches[0]
    ]


def _refinger(riff: dict[str, Any], tuning: Tuning, new_tuning: Tuning) -> None:
    """Keep every pitch, find positions on `new_tuning`; flag what does not fit."""
    by_start: dict[tuple[int, str | None], list[dict[str, Any]]] = {}
    for note in riff["notes"]:
        by_start.setdefault((note["start"], note.get("chordId")), []).append(note)
    previous: list[Position] | None = None
    for group in by_start.values():
        pitches = [pitch_of(tuning, n["string"], n["fret"]) for n in group]
        positions = best_fingering(pitches, new_tuning, previous, fret_range=(0, 15))
        if positions is None:
            for n in group:
                n["unplayable"] = True
            continue
        for n, pos in zip(group, positions, strict=True):
            n["string"], n["fret"] = pos.string, pos.fret
            n.pop("unplayable", None)
        previous = positions
    riff["tuning"] = new_tuning.to_dict()


def fake_suggestions(
    riff: dict[str, Any], kind: str, count: int, request: dict[str, Any]
) -> dict[str, Any]:
    """`count` schema-valid riffs that differ from the input in a kind-specific way."""
    tuning = Tuning.from_dict(riff["tuning"])
    suggestions = []
    for i in range(count):
        out = _stamp(riff, kind, kind, i)
        rationale = f"Fake {kind} {i + 1}: "
        if kind == "simplify":
            starts = sorted({n["start"] for n in out["notes"]})
            keep = set(starts[::2])
            out["notes"] = [n for n in out["notes"] if n["start"] in keep]
            rationale += "every other attack removed, same shapes and feel for practice."
        elif kind == "fingerings":
            for note in out["notes"][i::2]:
                pitch = pitch_of(tuning, note["string"], note["fret"])
                options = [
                    p
                    for p in find_fingerings(pitch, tuning, (0, 15))
                    if (p.string, p.fret) != (note["string"], note["fret"])
                ]
                if options:
                    note["string"], note["fret"] = options[0].string, options[0].fret
            rationale += "same pitches on neighboring strings; trades reach for position."
        elif kind == "tunings":
            lower = _lower_tunings(tuning)
            new_tuning = lower[i % len(lower)] if lower else tuning
            _refinger(out, tuning, new_tuning)
            out["name"] = f"{riff['name']} in {new_tuning.name}"
            rationale += f"{new_tuning.name} puts the walkdown lower on the neck."
        else:
            _nudge(out, i, 1 if i % 2 == 0 else -1)
            rationale += "two to six notes moved a half step for intentional tension."
        if request.get("intent"):
            rationale += f" Intent honored: {request['intent']}."
        suggestions.append(
            {
                "riff": out,
                "rationale": rationale,
                "playingNotes": "Palm mute the chugs; let the held note ring over the walk.",
            }
        )
    return {"suggestions": suggestions}


# --- cleanup -----------------------------------------------------------------------------


def fake_cleanup(riff: dict[str, Any]) -> dict[str, Any]:
    """Delete the first note under 0.5 confidence, else move the first note one fret."""
    out = copy.deepcopy(riff)
    changes = []
    weak = next((n for n in out["notes"] if n.get("confidence", 1.0) < 0.5), None)
    if weak is not None:
        out["notes"] = [n for n in out["notes"] if n["id"] != weak["id"]]
        changes.append(
            {
                "kind": "delete",
                "noteIds": [weak["id"]],
                "reason": f"confidence {weak.get('confidence'):.2f} is below 0.5",
            }
        )
    elif out["notes"]:
        first = out["notes"][0]
        if first["fret"] < 24:
            first["fret"] += 1
            changes.append(
                {
                    "kind": "moveFret",
                    "noteIds": [first["id"]],
                    "reason": "neighboring fret matches the walkdown shape",
                }
            )
    return {"riff": out, "changes": changes}
