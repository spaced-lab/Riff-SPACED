"""Fingering search (SPEC 3.6, DECISIONS 45), mirroring frontend/src/music/fingering.ts.

Used by the audio importer (candidate shapes), the AI suggestion repair step, and the
transpose tools. Deterministic; see docs/MUSIC_MODEL.md for the cost model and worked cases.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from itertools import product

from riffspaced.music.tuning import Tuning, pitch_of

MAX_SPAN = 4

FINGERING_COST = {
    "span": 1.0,  # per fret between the lowest and highest fretted finger
    "movement": 1.0,  # per fret the hand moves from the previous hand position
    "string": 0.5,  # per string above the lowest string, per note
    "highString": 2.5,  # extra per note above the lowest three strings
    "height": 0.3,  # per fret of hand position (prefer the nut area)
    "skip": 2.0,  # per unused string skipped inside the group
}


@dataclass(frozen=True, order=True)
class Position:
    """One fretted or open note: guitarist string number and fret."""

    string: int
    fret: int

    def to_pair(self) -> list[int]:
        """[string, fret] as the fixture writes it."""
        return [self.string, self.fret]


def default_allowed_strings(tuning: Tuning) -> list[int]:
    """The lowest four strings (N, N-1, N-2, N-3)."""
    n = tuning.string_count
    return [n - i for i in range(min(4, n))]


def find_fingerings(
    pitch: int,
    tuning: Tuning,
    fret_range: tuple[int, int] = (0, 12),
    allowed_strings: Iterable[int] | None = None,
) -> list[Position]:
    """Every (string, fret) producing `pitch`, lowest-pitched string first."""
    lo, hi = fret_range
    strings = sorted(allowed_strings or default_allowed_strings(tuning), reverse=True)
    out: list[Position] = []
    for string in strings:
        fret = pitch - pitch_of(tuning, string, 0)
        if lo <= fret <= hi:
            out.append(Position(string, fret))
    return out


def _fretted(positions: Sequence[Position]) -> list[int]:
    return [p.fret for p in positions if p.fret > 0]


def hand_span(positions: Sequence[Position]) -> int:
    """Distance between the lowest and highest fretted finger; open strings do not count."""
    frets = _fretted(positions)
    return max(frets) - min(frets) if len(frets) >= 2 else 0


def hand_position(positions: Sequence[Position]) -> int:
    """The lowest fretted finger, or 0 (the nut) when everything is open."""
    frets = _fretted(positions)
    return min(frets) if frets else 0


def _cost(
    positions: Sequence[Position], tuning: Tuning, previous: Sequence[Position] | None
) -> float:
    n = tuning.string_count
    pos = hand_position(positions)
    c = FINGERING_COST["span"] * hand_span(positions) + FINGERING_COST["height"] * pos
    if previous:
        c += FINGERING_COST["movement"] * abs(pos - hand_position(previous))
    for p in positions:
        c += FINGERING_COST["string"] * (n - p.string)
        if p.string < n - 2:
            c += FINGERING_COST["highString"]
    if len(positions) > 1:
        strings = [p.string for p in positions]
        c += FINGERING_COST["skip"] * (max(strings) - min(strings) + 1 - len(strings))
    return c


def _tie_key(positions: Sequence[Position]) -> tuple[tuple[int, int], ...]:
    # Lower-pitched string first (higher number), then lower fret.
    return tuple((-p.string, p.fret) for p in positions)


def best_fingering(
    pitches: Sequence[int],
    tuning: Tuning,
    previous: Sequence[Position] | None = None,
    fret_range: tuple[int, int] = (0, 12),
    allowed_strings: Iterable[int] | None = None,
) -> list[Position] | None:
    """One position per pitch for a simultaneous group, or None if unplayable.

    Minimizes span, hand movement from `previous`, string height, and skipped strings;
    each pitch must land on its own string and the fretted span may not exceed 4.
    """
    if not pitches:
        return []
    allowed = list(allowed_strings) if allowed_strings is not None else None
    choices = [find_fingerings(p, tuning, fret_range, allowed) for p in pitches]
    if any(not c for c in choices):
        return None
    best: list[Position] | None = None
    best_key: tuple[float, tuple[tuple[int, int], ...]] | None = None
    for combo in product(*choices):
        if len({p.string for p in combo}) != len(combo) or hand_span(combo) > MAX_SPAN:
            continue
        key = (_cost(combo, tuning, previous), _tie_key(combo))
        if best_key is None or key < best_key:
            best_key = key
            best = list(combo)
    return best
