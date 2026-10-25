/**
 * Scales for the fretboard overlay (Phase 9).
 *
 * A scale is a set of intervals in semitones above a root. The overlay needs more than the
 * set: it colors each note by its *degree* (root, third, fifth...) and distinguishes a flat
 * degree from a natural one (b3 against 3, b7 against 7), so every interval here carries the
 * degree it plays in the scale. Degrees are counted against the major scale, the way
 * guitarists name them: the minor pentatonic is 1, b3, 4, 5, b7.
 *
 * The blues scale is the minor pentatonic plus the b5, the "blue note". It is a passing tone
 * rather than a scale degree in its own right, so it gets its own role instead of being
 * called a flat fifth and colored like the fifth.
 */
import type { Accidentals } from './naming';
import { nameOf } from './naming';
import { pitchClass } from './pitch';

export type ScaleId =
  | 'minorPentatonic'
  | 'blues'
  | 'majorPentatonic'
  | 'major'
  | 'naturalMinor'
  | 'dorian'
  | 'mixolydian'
  | 'harmonicMinor';

/** The role a note plays: its degree number, or the blue note of the blues scale. */
export type DegreeRole =
  'root' | 'second' | 'third' | 'fourth' | 'fifth' | 'sixth' | 'seventh' | 'blue';

export type Degree = {
  /** Semitones above the root, 0..11. */
  semitones: number;
  role: DegreeRole;
  /** Lowered against the major scale (b3, b6, b7) or the b5 blue note. */
  flat: boolean;
  /** Short label as a guitarist writes it: R, 2, b3, 4, b5, 5, 6, b7, 7. */
  label: string;
};

export type Scale = {
  id: ScaleId;
  name: string;
  /** Degrees in ascending order, starting at the root. */
  degrees: readonly Degree[];
};

/**
 * The color groups a player can switch on and off. Seconds, fourths and sixths share one
 * switch ("others") because they are the notes you pass through rather than land on.
 */
export type ColorGroup = 'roots' | 'thirds' | 'fifths' | 'sevenths' | 'blue' | 'others';

export const COLOR_GROUPS: readonly ColorGroup[] = [
  'roots',
  'thirds',
  'fifths',
  'sevenths',
  'blue',
  'others',
];

export const COLOR_GROUP_LABELS: Readonly<Record<ColorGroup, string>> = {
  roots: 'roots',
  thirds: 'thirds',
  fifths: 'fifths',
  sevenths: 'sevenths',
  blue: 'blue notes',
  others: 'others (2, 4, 6)',
};

export function groupOf(role: DegreeRole): ColorGroup {
  switch (role) {
    case 'root':
      return 'roots';
    case 'third':
      return 'thirds';
    case 'fifth':
      return 'fifths';
    case 'seventh':
      return 'sevenths';
    case 'blue':
      return 'blue';
    default:
      return 'others';
  }
}

/** One degree of the major scale, or its lowered form. The table everything else is built from. */
const D = (semitones: number, role: DegreeRole, label: string, flat = false): Degree => ({
  semitones,
  role,
  flat,
  label,
});

const ROOT = D(0, 'root', 'R');
const SECOND = D(2, 'second', '2');
const MINOR_THIRD = D(3, 'third', 'b3', true);
const MAJOR_THIRD = D(4, 'third', '3');
const FOURTH = D(5, 'fourth', '4');
const BLUE = D(6, 'blue', 'b5', true);
const FIFTH = D(7, 'fifth', '5');
const MINOR_SIXTH = D(8, 'sixth', 'b6', true);
const MAJOR_SIXTH = D(9, 'sixth', '6');
const MINOR_SEVENTH = D(10, 'seventh', 'b7', true);
const MAJOR_SEVENTH = D(11, 'seventh', '7');

/** Menu order: the owner wants the blues scale right next to the minor pentatonic. */
export const SCALES: readonly Scale[] = [
  {
    id: 'minorPentatonic',
    name: 'Minor Pentatonic',
    degrees: [ROOT, MINOR_THIRD, FOURTH, FIFTH, MINOR_SEVENTH],
  },
  {
    id: 'blues',
    name: 'Blues',
    degrees: [ROOT, MINOR_THIRD, FOURTH, BLUE, FIFTH, MINOR_SEVENTH],
  },
  {
    id: 'majorPentatonic',
    name: 'Major Pentatonic',
    degrees: [ROOT, SECOND, MAJOR_THIRD, FIFTH, MAJOR_SIXTH],
  },
  {
    id: 'major',
    name: 'Major (Ionian)',
    degrees: [ROOT, SECOND, MAJOR_THIRD, FOURTH, FIFTH, MAJOR_SIXTH, MAJOR_SEVENTH],
  },
  {
    id: 'naturalMinor',
    name: 'Natural Minor (Aeolian)',
    degrees: [ROOT, SECOND, MINOR_THIRD, FOURTH, FIFTH, MINOR_SIXTH, MINOR_SEVENTH],
  },
  {
    id: 'dorian',
    name: 'Dorian',
    degrees: [ROOT, SECOND, MINOR_THIRD, FOURTH, FIFTH, MAJOR_SIXTH, MINOR_SEVENTH],
  },
  {
    id: 'mixolydian',
    name: 'Mixolydian',
    degrees: [ROOT, SECOND, MAJOR_THIRD, FOURTH, FIFTH, MAJOR_SIXTH, MINOR_SEVENTH],
  },
  {
    id: 'harmonicMinor',
    name: 'Harmonic Minor',
    degrees: [ROOT, SECOND, MINOR_THIRD, FOURTH, FIFTH, MINOR_SIXTH, MAJOR_SEVENTH],
  },
];

export const DEFAULT_SCALE: ScaleId = 'minorPentatonic';

export function scaleById(id: ScaleId): Scale {
  const found = SCALES.find((s) => s.id === id);
  if (!found) throw new Error(`unknown scale: ${id}`);
  return found;
}

/**
 * The scale laid onto the twelve pitch classes: index is the pitch class (0 = C), value is
 * the degree that pitch plays, or null when it is not in the scale. Build once per scale and
 * root; the fretboard then looks up `pitchClass(midi)` for every cell.
 */
export function degreesOf(scale: Scale, root: number): readonly (Degree | null)[] {
  const table: (Degree | null)[] = Array.from({ length: 12 }, () => null);
  for (const degree of scale.degrees) {
    table[pitchClass(root + degree.semitones)] = degree;
  }
  return table;
}

/** `Bb Minor Pentatonic`, `C Major (Ionian)`: the heading the legend shows. */
export function scaleTitle(scale: Scale, root: number, accidentals: Accidentals): string {
  return `${nameOf(root, accidentals, false)} ${scale.name}`;
}

/** The twelve roots in chromatic order from C, for the root menu. */
export const ROOTS: readonly number[] = Array.from({ length: 12 }, (_, i) => i);

/**
 * The CSS modifier for a degree: `root`, `third-flat`, `third`, `blue`... The theme file
 * (fretboard.css) maps each one to a color token, so the mapping can change without touching
 * code (the owner expects to adjust the colors later).
 */
export function degreeClass(degree: Degree): string {
  if (degree.role === 'blue') return 'blue';
  return degree.flat ? `${degree.role}-flat` : degree.role;
}
