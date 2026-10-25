/**
 * Tunings and the string numbering convention (SPEC 3.3, DECISIONS 23).
 *
 * Strings are numbered the guitarist's way: string 1 is the highest pitch, string N the
 * lowest. A tuning's `pitches` array is stored low to high, the DAW way. The bridge
 * between the two is `pitchOf`: `pitches[N - string] + fret`.
 */

export type Tuning = {
  name: string;
  /** Open-string MIDI pitches, low to high. pitches[0] is string N. */
  pitches: number[];
};

export const MIN_OPEN_PITCH = 20;
export const MAX_OPEN_PITCH = 70;
export const MIN_STRINGS = 6;
export const MAX_STRINGS = 8;
export const DEFAULT_FRET_COUNT = 24;

export const STANDARD_PRESETS: readonly Tuning[] = [
  { name: 'E Standard', pitches: [40, 45, 50, 55, 59, 64] },
  { name: 'Eb Standard', pitches: [39, 44, 49, 54, 58, 63] },
  { name: 'D Standard', pitches: [38, 43, 48, 53, 57, 62] },
  { name: 'C# Standard', pitches: [37, 42, 47, 52, 56, 61] },
  { name: 'C Standard', pitches: [36, 41, 46, 51, 55, 60] },
  { name: 'B Standard', pitches: [35, 40, 45, 50, 54, 59] },
  { name: 'Bb Standard', pitches: [34, 39, 44, 49, 53, 58] },
  { name: 'A Standard', pitches: [33, 38, 43, 48, 52, 57] },
];

/** Which standard tunings get a generated drop variant, and what the drop is called. */
const DROP_NAMES: Readonly<Record<string, string>> = {
  'E Standard': 'Drop D',
  'Eb Standard': 'Drop C#',
  'D Standard': 'Drop C',
  'C# Standard': 'Drop B',
  'C Standard': 'Drop Bb',
  'B Standard': 'Drop A',
  'Bb Standard': 'Drop Ab',
};

/** A drop tuning is the standard tuning with the lowest string down a whole step. */
export function dropOf(standard: Tuning, name?: string): Tuning {
  const [lowest, ...rest] = standard.pitches;
  if (lowest === undefined) {
    throw new Error(`cannot drop an empty tuning: ${standard.name}`);
  }
  return {
    name: name ?? DROP_NAMES[standard.name] ?? `Drop (${standard.name})`,
    pitches: [lowest - 2, ...rest],
  };
}

export const DROP_PRESETS: readonly Tuning[] = STANDARD_PRESETS.filter(
  (t) => t.name in DROP_NAMES,
).map((t) => dropOf(t));

export const SEVEN_STRING_PRESETS: readonly Tuning[] = [
  { name: 'B Standard 7', pitches: [35, 40, 45, 50, 55, 59, 64] },
];

export const ALL_PRESETS: readonly Tuning[] = [
  ...STANDARD_PRESETS,
  ...DROP_PRESETS,
  ...SEVEN_STRING_PRESETS,
];

export const DEFAULT_TUNING: Tuning = STANDARD_PRESETS.find((t) => t.name === 'Bb Standard') ?? {
  name: 'Bb Standard',
  pitches: [34, 39, 44, 49, 53, 58],
};

export function presetByName(name: string): Tuning | undefined {
  return ALL_PRESETS.find((t) => t.name === name);
}

export function stringCount(tuning: Tuning): number {
  return tuning.pitches.length;
}

/** MIDI pitch sounding at (string, fret). String 1 is highest; see the module comment. */
export function pitchOf(tuning: Tuning, string: number, fret: number): number {
  const n = tuning.pitches.length;
  const open = tuning.pitches[n - string];
  if (open === undefined || !Number.isInteger(string) || string < 1 || string > n) {
    throw new RangeError(`string ${string} is not in 1..${n}`);
  }
  if (!Number.isInteger(fret) || fret < 0) {
    throw new RangeError(`fret ${fret} must be a non-negative integer`);
  }
  return open + fret;
}

/** Valid: 6 to 8 integer pitches, strictly ascending, each between 20 and 70. */
export function isValidTuning(tuning: Pick<Tuning, 'pitches'>): boolean {
  const p = tuning.pitches;
  if (p.length < MIN_STRINGS || p.length > MAX_STRINGS) return false;
  return p.every(
    (pitch, i) =>
      Number.isInteger(pitch) &&
      pitch >= MIN_OPEN_PITCH &&
      pitch <= MAX_OPEN_PITCH &&
      (i === 0 || pitch > (p[i - 1] ?? -Infinity)),
  );
}

/** Return a new tuning with one string moved by `semitones`. The name becomes "Custom". */
export function retuneString(tuning: Tuning, string: number, semitones: number): Tuning {
  const n = tuning.pitches.length;
  const index = n - string;
  const current = tuning.pitches[index];
  if (current === undefined) {
    throw new RangeError(`string ${string} is not in 1..${n}`);
  }
  const pitches = tuning.pitches.slice();
  pitches[index] = current + semitones;
  return { name: 'Custom', pitches };
}
