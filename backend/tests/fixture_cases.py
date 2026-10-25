"""Enumerates every case in music-conventions.json as (section, case) pairs.

Both the parametrized tests and the parity test use this, so the count the parity test
asserts is the count the tests actually consumed.
"""

import json

from riffspaced.paths import FIXTURES_DIR

CONVENTIONS = json.loads((FIXTURES_DIR / "music-conventions.json").read_text())


def cases(section: str) -> list:
    t = CONVENTIONS
    match section:
        case "pitchNames" | "frequencies" | "pitchOf" | "dyads":
            return t[section]
        case "standard" | "drop" | "sevenString" | "validity":
            return t["tunings"][section]
        case "grid":
            return list(t["ticks"]["grid"].items())
        case "ticksToSeconds" | "barBeatTick" | "snapToGrid":
            return t["ticks"][section]
        case "find" | "best" | "handSpan":
            return t["fingerings"][section]
    raise KeyError(section)


SECTIONS = (
    "pitchNames",
    "frequencies",
    "standard",
    "drop",
    "sevenString",
    "validity",
    "pitchOf",
    "grid",
    "ticksToSeconds",
    "barBeatTick",
    "snapToGrid",
    "dyads",
    "find",
    "best",
    "handSpan",
)


def total_cases() -> int:
    return sum(len(cases(s)) for s in SECTIONS)
