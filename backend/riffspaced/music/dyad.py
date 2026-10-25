"""Two-note intervals (SPEC 3.5)."""

from __future__ import annotations

from dataclasses import dataclass

from riffspaced.music.pitch import pitch_class

LABELS = ("P1", "m2", "M2", "m3", "M3", "P4", "TT", "P5", "m6", "M6", "m7", "M7")

INTERVAL_MEANING = {
    "P1": "unison",
    "m2": "chromatic clash",
    "M2": "major second",
    "m3": "minor dyad",
    "M3": "major dyad",
    "P4": "inverted power chord (root on top)",
    "TT": "tritone",
    "P5": "power chord",
    "m6": "minor sixth",
    "M6": "major sixth",
    "m7": "minor seventh",
    "M7": "major seventh",
    "P8": "octave dyad",
}


@dataclass(frozen=True)
class DyadInfo:
    """Interval label, size within the octave, which note is the root."""

    interval: str
    semitones: int
    lower_is_root: bool
    root_pitch_class: int

    def to_dict(self) -> dict[str, object]:
        """CamelCase JSON shape matching the TypeScript DyadInfo."""
        return {
            "interval": self.interval,
            "semitones": self.semitones,
            "lowerIsRoot": self.lower_is_root,
            "rootPitchClass": self.root_pitch_class,
        }


def describe_dyad(a: int, b: int) -> DyadInfo:
    """Describe the interval between two pitches in either order.

    P5: root is the lower note. P4: root is the upper note, because a fourth is a fifth
    turned upside down (inverted power chord). Everything else: lower note is the root.
    """
    lower, upper = min(a, b), max(a, b)
    distance = upper - lower
    semitones = distance % 12
    interval = LABELS[semitones]
    if semitones == 0 and distance > 0:
        interval = "P8"
    lower_is_root = semitones != 5
    return DyadInfo(
        interval=interval,
        semitones=semitones,
        lower_is_root=lower_is_root,
        root_pitch_class=pitch_class(lower if lower_is_root else upper),
    )
