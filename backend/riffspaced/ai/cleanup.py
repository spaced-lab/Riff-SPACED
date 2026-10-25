"""POST /ai/cleanup and `ingest --ai` (SPEC 9.2, plan P7.T4): a bounded repair pass.

The analyzer's output carries a confidence per note. The model may fix what a spectral
matcher typically gets wrong, and nothing else:

| kind     | allowed                                                                 |
|----------|-------------------------------------------------------------------------|
| moveFret | one note, same string, one fret up or down                              |
| merge    | two notes on one string starting within a sixteenth become one note     |
| split    | one note becomes two on the same string and fret covering the same time |
| palmMute | add or remove the palmMute technique                                    |
| delete   | remove a note whose confidence is below 0.5                             |

Enforcement does not trust the model's riff. It starts from the original and applies only
the declared changes that pass their check; an undeclared or out-of-bounds edit never
reaches the result and is reported in `rejected` so the owner can see what the model tried.
"""

from __future__ import annotations

import copy
import json
from typing import Any

from riffspaced.ai.client import AiClient
from riffspaced.ai.facts import riff_facts
from riffspaced.ai.prompting import load_prompt
from riffspaced.ai.schemas import CLEANUP_RESPONSE
from riffspaced.model.validate import ValidationError, validate_riff

MAX_FRET_MOVE = 1
DELETE_BELOW = 0.5
MERGE_WINDOW_TICKS = 120  # a sixteenth

# Fields of a note that no change kind may alter, apart from the kind's own field.
_FROZEN_RIFF_KEYS = ("tuning", "tempo", "timeSignature", "ppq", "lengthBars", "sections", "id")

Note = dict[str, Any]


def build_request(riff: dict[str, Any], report: dict[str, Any]) -> dict[str, Any]:
    """The JSON envelope the cleanup prompt describes."""
    return {"task": "cleanup", "riff": riff, "report": report, "facts": riff_facts(riff)}


def check_cleanup(answer: dict[str, Any]) -> list[str]:
    """Problems quoted back to the model: the corrected riff must still be a valid riff."""
    try:
        validate_riff(answer["riff"])
    except ValidationError as error:
        return [f"riff: {msg}" for msg in error.errors]
    return []


def _end(note: Note) -> int:
    return note["start"] + note["duration"]


def _same_except(a: Note, b: Note, *allowed: str) -> bool:
    """True when the two notes differ at most in the `allowed` keys."""
    keys = set(a) | set(b)
    return all(a.get(k) == b.get(k) for k in keys if k not in allowed)


def _check_move_fret(ids: list[str], orig: dict[str, Note], new: dict[str, Note]) -> str | None:
    if len(ids) != 1:
        return "moveFret names exactly one note"
    (i,) = ids
    if i not in orig or i not in new:
        return f"note {i} must exist before and after"
    a, b = orig[i], new[i]
    if not _same_except(a, b, "fret"):
        return f"note {i}: moveFret may change only the fret"
    if abs(a["fret"] - b["fret"]) != MAX_FRET_MOVE:
        return f"note {i}: fret moved {abs(a['fret'] - b['fret'])}, allowed {MAX_FRET_MOVE}"
    return None


def _check_palm_mute(ids: list[str], orig: dict[str, Note], new: dict[str, Note]) -> str | None:
    for i in ids:
        if i not in orig or i not in new:
            return f"note {i} must exist before and after"
        a, b = orig[i], new[i]
        if not _same_except(a, b, "techniques"):
            return f"note {i}: palmMute may change only the techniques"
        before = set(a.get("techniques", [])) - {"palmMute"}
        after = set(b.get("techniques", [])) - {"palmMute"}
        if before != after:
            return f"note {i}: only palmMute may be added or removed"
    return None


def _check_delete(ids: list[str], orig: dict[str, Note], new: dict[str, Note]) -> str | None:
    for i in ids:
        if i not in orig:
            return f"note {i} is not in the riff"
        if i in new:
            return f"note {i} was declared deleted but is still present"
        confidence = orig[i].get("confidence", 1.0)
        if confidence >= DELETE_BELOW:
            return f"note {i}: confidence {confidence:.2f} is not below {DELETE_BELOW}"
    return None


def _check_merge(ids: list[str], orig: dict[str, Note], new: dict[str, Note]) -> str | None:
    if len(ids) != 2 or any(i not in orig for i in ids):
        return "merge names exactly two existing notes"
    a, b = (orig[i] for i in ids)
    if a["string"] != b["string"]:
        return "merge needs two notes on the same string"
    if abs(a["start"] - b["start"]) > MERGE_WINDOW_TICKS:
        return f"merge needs starts within {MERGE_WINDOW_TICKS} ticks"
    survivors = [i for i in ids if i in new]
    if len(survivors) != 1:
        return "merge must keep exactly one of the two notes"
    kept = new[survivors[0]]
    first, last = min(a, b, key=lambda n: n["start"]), max(a, b, key=_end)
    expected = {
        **orig[survivors[0]],
        "start": first["start"],
        "duration": _end(last) - first["start"],
    }
    if not _same_except(kept, expected, "confidence", "velocity"):
        return "merged note must span both originals and change nothing else"
    return None


def _check_split(ids: list[str], orig: dict[str, Note], new: dict[str, Note]) -> str | None:
    old_ids = [i for i in ids if i in orig]
    if len(old_ids) != 1:
        return "split names one existing note (and optionally the new one)"
    (i,) = old_ids
    if i not in new:
        return f"note {i} must survive the split as its first part"
    a, b = orig[i], new[i]
    if not _same_except(a, b, "duration", "confidence") or not 0 < b["duration"] < a["duration"]:
        return f"note {i}: a split keeps the start and shortens the duration"
    added = [n for k, n in new.items() if k not in orig and n["string"] == a["string"]]
    second = [n for n in added if n["start"] == _end(b) and _end(n) == _end(a)]
    if len(second) != 1 or second[0]["fret"] != a["fret"]:
        return f"note {i}: the second part must start where the first ends and cover the rest"
    return None


_CHECKS = {
    "moveFret": _check_move_fret,
    "palmMute": _check_palm_mute,
    "delete": _check_delete,
    "merge": _check_merge,
    "split": _check_split,
}


def _apply(kind: str, ids: list[str], out_by_id: dict[str, Note], new: dict[str, Note]) -> None:
    """Copy the (already checked) change from the model's riff onto the result."""
    if kind == "delete":
        for i in ids:
            out_by_id.pop(i, None)
    elif kind == "merge":
        survivor = next(i for i in ids if i in new)
        for i in ids:
            if i != survivor:
                out_by_id.pop(i, None)
        out_by_id[survivor] = copy.deepcopy(new[survivor])
    elif kind == "split":
        old = next(i for i in ids if i in out_by_id)
        out_by_id[old] = copy.deepcopy(new[old])
        second = next(
            n
            for k, n in new.items()
            if k not in out_by_id
            and n["string"] == new[old]["string"]
            and n["start"] == _end(new[old])
        )
        out_by_id[second["id"]] = copy.deepcopy(second)
    else:
        for i in ids:
            out_by_id[i] = copy.deepcopy(new[i])


def _rejection(kind: str, ids: list[str], because: str) -> dict[str, Any]:
    return {"kind": kind, "noteIds": ids, "reason": "", "rejectedBecause": because}


def enforce_limits(
    original: dict[str, Any], cleaned: dict[str, Any], changes: list[dict[str, Any]]
) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    """Return (riff, accepted changes, rejected changes) built from the original riff."""
    orig = {n["id"]: n for n in original["notes"]}
    new = {n["id"]: n for n in cleaned["notes"]}
    out_by_id: dict[str, Note] = {i: copy.deepcopy(n) for i, n in orig.items()}
    accepted: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    for key in _FROZEN_RIFF_KEYS:
        if cleaned.get(key) != original.get(key):
            rejected.append(
                {
                    "kind": "riff",
                    "noteIds": [],
                    "reason": "",
                    "rejectedBecause": f"{key} may not change",
                }
            )
    touched: set[str] = set()
    mentioned: set[str] = set()
    for change in changes:
        kind, ids = change["kind"], list(change["noteIds"])
        mentioned.update(ids)
        problem = _CHECKS[kind](ids, orig, new)
        if problem is None and touched & set(ids):
            problem = "a note may appear in one change only"
        if problem is not None:
            rejected.append({**change, "rejectedBecause": problem})
            continue
        _apply(kind, ids, out_by_id, new)
        touched.update(ids)
        if kind == "split":
            touched.update(n["id"] for n in out_by_id.values() if n["id"] not in orig)
        accepted.append(change)
    # Anything the model edited without declaring it never made it into `out_by_id`; say so.
    # Notes named in a rejected change are already reported once, so they are skipped here.
    for i, note in new.items():
        if i in touched or i in mentioned:
            continue
        if i not in orig:
            rejected.append(_rejection("undeclared", [i], "new note"))
        elif note != orig[i]:
            rejected.append(_rejection("undeclared", [i], "edited"))
    for i in orig:
        if i not in new and i not in touched and i not in mentioned:
            rejected.append(_rejection("undeclared", [i], "removed"))
    riff = copy.deepcopy(original)
    riff["notes"] = sorted(out_by_id.values(), key=lambda n: (n["start"], -n["string"], n["id"]))
    riff["updatedAt"] = cleaned.get("updatedAt") or original["updatedAt"]
    return riff, accepted, rejected


def cleanup_riff(riff: dict[str, Any], report: dict[str, Any], client: AiClient) -> dict[str, Any]:
    """Validate the input, ask the model, enforce the limits, return the API response body."""
    validate_riff(riff)
    prompt = load_prompt("cleanup")
    user = json.dumps(build_request(riff, report))
    answer = client.complete_json(
        prompt.text, user, CLEANUP_RESPONSE, purpose="cleanup", check=check_cleanup
    )
    cleaned, accepted, rejected = enforce_limits(riff, answer["riff"], answer["changes"])
    validate_riff(cleaned)
    usage = client.last_usage
    return {
        "riff": cleaned,
        "changes": accepted,
        "rejected": rejected,
        "model": client.model,
        "promptVersion": prompt.version,
        "usage": usage.to_dict() if usage else None,
    }
