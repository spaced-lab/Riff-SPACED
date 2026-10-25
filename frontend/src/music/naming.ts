/**
 * Note names (SPEC 3.2). Flats are the default spelling because the owner's
 * music lives in Bb, Eb, Ab, Db; sharps are a global toggle.
 */
import { octaveOf, pitchClass } from './pitch';

export type Accidentals = 'flats' | 'sharps';

export const FLAT_NAMES = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;
export const SHARP_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

/**
 * Name a MIDI note, e.g. `nameOf(34, 'flats', true)` is `Bb1` and
 * `nameOf(34, 'sharps', false)` is `A#`. Fretboard dots use the no-octave form.
 */
export function nameOf(
  midi: number,
  accidentals: Accidentals = 'flats',
  withOctave = true,
): string {
  const names = accidentals === 'flats' ? FLAT_NAMES : SHARP_NAMES;
  // pitchClass is always 0..11, so the index is in range; the fallback only satisfies
  // noUncheckedIndexedAccess.
  const letter = names[pitchClass(midi)] ?? 'C';
  return withOctave ? `${letter}${octaveOf(midi)}` : letter;
}
