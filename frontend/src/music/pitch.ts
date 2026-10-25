/**
 * Pitch arithmetic on MIDI note numbers (SPEC 3.1).
 * C4 = 60, A4 = 69 = 440 Hz. Everything else is derived from those two facts.
 */

/** A4 is 440 Hz by convention; every other frequency is 2^(semitones / 12) away from it. */
export const A4_MIDI = 69;
export const A4_HZ = 440;

/** Frequency in Hz of a MIDI note. Equal temperament: twelve equal steps per octave. */
export function freqOf(midi: number): number {
  return A4_HZ * 2 ** ((midi - A4_MIDI) / 12);
}

/** Pitch class 0..11 where 0 = C. The `((x % 12) + 12) % 12` form keeps negatives positive. */
export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

/** Scientific octave number: 60 is C4, 34 is Bb1. */
export function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1;
}
