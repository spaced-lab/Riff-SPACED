"""Pitch arithmetic on MIDI note numbers (SPEC 3.1). C4 = 60, A4 = 69 = 440 Hz."""

A4_MIDI = 69
A4_HZ = 440.0


def freq_of(midi: int) -> float:
    """Frequency in Hz under equal temperament: twelve equal steps per octave."""
    return A4_HZ * 2 ** ((midi - A4_MIDI) / 12)


def pitch_class(midi: int) -> int:
    """Pitch class 0..11 with 0 = C. Python's % already keeps negatives positive."""
    return midi % 12


def octave_of(midi: int) -> int:
    """Scientific octave number: 60 is C4, 34 is Bb1."""
    return midi // 12 - 1
