"""Tunings and string numbering (SPEC 3.3, DECISIONS 23).

String 1 is the highest pitch, string N the lowest; `pitches` is stored low to high.
`pitch_of(tuning, string, fret) = pitches[N - string] + fret`.
"""

from __future__ import annotations

from dataclasses import dataclass, field

MIN_OPEN_PITCH = 20
MAX_OPEN_PITCH = 70
MIN_STRINGS = 6
MAX_STRINGS = 8
DEFAULT_FRET_COUNT = 24


@dataclass(frozen=True)
class Tuning:
    """A named tuning. `pitches` are open-string MIDI numbers, low to high."""

    name: str
    pitches: tuple[int, ...] = field(default_factory=tuple)

    @property
    def string_count(self) -> int:
        """Number of strings."""
        return len(self.pitches)

    def to_dict(self) -> dict[str, object]:
        """JSON shape used in riff files."""
        return {"name": self.name, "pitches": list(self.pitches)}

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> Tuning:
        """Build from the JSON shape."""
        pitches = data["pitches"]
        assert isinstance(pitches, list)
        return cls(str(data["name"]), tuple(int(p) for p in pitches))


STANDARD_PRESETS: tuple[Tuning, ...] = (
    Tuning("E Standard", (40, 45, 50, 55, 59, 64)),
    Tuning("Eb Standard", (39, 44, 49, 54, 58, 63)),
    Tuning("D Standard", (38, 43, 48, 53, 57, 62)),
    Tuning("C# Standard", (37, 42, 47, 52, 56, 61)),
    Tuning("C Standard", (36, 41, 46, 51, 55, 60)),
    Tuning("B Standard", (35, 40, 45, 50, 54, 59)),
    Tuning("Bb Standard", (34, 39, 44, 49, 53, 58)),
    Tuning("A Standard", (33, 38, 43, 48, 52, 57)),
)

_DROP_NAMES = {
    "E Standard": "Drop D",
    "Eb Standard": "Drop C#",
    "D Standard": "Drop C",
    "C# Standard": "Drop B",
    "C Standard": "Drop Bb",
    "B Standard": "Drop A",
    "Bb Standard": "Drop Ab",
}


def drop_of(standard: Tuning, name: str | None = None) -> Tuning:
    """A drop tuning is the standard tuning with the lowest string down a whole step."""
    lowest, *rest = standard.pitches
    return Tuning(
        name or _DROP_NAMES.get(standard.name, f"Drop ({standard.name})"),
        (lowest - 2, *rest),
    )


DROP_PRESETS: tuple[Tuning, ...] = tuple(
    drop_of(t) for t in STANDARD_PRESETS if t.name in _DROP_NAMES
)
SEVEN_STRING_PRESETS: tuple[Tuning, ...] = (Tuning("B Standard 7", (35, 40, 45, 50, 55, 59, 64)),)
ALL_PRESETS: tuple[Tuning, ...] = STANDARD_PRESETS + DROP_PRESETS + SEVEN_STRING_PRESETS
DEFAULT_TUNING = next(t for t in STANDARD_PRESETS if t.name == "Bb Standard")


def preset_by_name(name: str) -> Tuning | None:
    """Look up a preset by its display name."""
    return next((t for t in ALL_PRESETS if t.name == name), None)


def pitch_of(tuning: Tuning, string: int, fret: int) -> int:
    """MIDI pitch sounding at (string, fret); string 1 is the highest string."""
    n = tuning.string_count
    if not 1 <= string <= n:
        raise ValueError(f"string {string} is not in 1..{n}")
    if fret < 0:
        raise ValueError(f"fret {fret} must be a non-negative integer")
    return tuning.pitches[n - string] + fret


def is_valid_tuning(pitches: list[int] | tuple[int, ...]) -> bool:
    """6 to 8 integer pitches, strictly ascending, each between 20 and 70."""
    if not MIN_STRINGS <= len(pitches) <= MAX_STRINGS:
        return False
    if not all(isinstance(p, int) and MIN_OPEN_PITCH <= p <= MAX_OPEN_PITCH for p in pitches):
        return False
    return all(b > a for a, b in zip(pitches, pitches[1:], strict=False))


def retune_string(tuning: Tuning, string: int, semitones: int) -> Tuning:
    """Return a new "Custom" tuning with one string moved by `semitones`."""
    n = tuning.string_count
    if not 1 <= string <= n:
        raise ValueError(f"string {string} is not in 1..{n}")
    pitches = list(tuning.pitches)
    pitches[n - string] += semitones
    return Tuning("Custom", tuple(pitches))
