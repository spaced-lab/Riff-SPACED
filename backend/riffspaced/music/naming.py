"""Note names (SPEC 3.2). Flats by default, sharps as a toggle."""

from typing import Literal

from riffspaced.music.pitch import octave_of, pitch_class

Accidentals = Literal["flats", "sharps"]

FLAT_NAMES = ("C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B")
SHARP_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")


def name_of(midi: int, accidentals: Accidentals = "flats", with_octave: bool = True) -> str:
    """Return the note name, e.g. "Bb1" for 34, or "A#" with sharps and no octave."""
    names = FLAT_NAMES if accidentals == "flats" else SHARP_NAMES
    letter = names[pitch_class(midi)]
    return f"{letter}{octave_of(midi)}" if with_octave else letter
