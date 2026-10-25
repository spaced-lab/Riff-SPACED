/**
 * Two-note intervals (SPEC 3.5). Most of the owner's riffs are dyads: power chords,
 * inverted power chords (a fourth, root on top), minor and major thirds, tritones.
 */
import { pitchClass } from './pitch';

export type IntervalLabel =
  'P1' | 'm2' | 'M2' | 'm3' | 'M3' | 'P4' | 'TT' | 'P5' | 'm6' | 'M6' | 'm7' | 'M7' | 'P8';

const LABELS: readonly IntervalLabel[] = [
  'P1',
  'm2',
  'M2',
  'm3',
  'M3',
  'P4',
  'TT',
  'P5',
  'm6',
  'M6',
  'm7',
  'M7',
];

/** Plain-English meanings used by the inspector and the AI prompt table. */
export const INTERVAL_MEANING: Readonly<Record<IntervalLabel, string>> = {
  P1: 'unison',
  m2: 'chromatic clash',
  M2: 'major second',
  m3: 'minor dyad',
  M3: 'major dyad',
  P4: 'inverted power chord (root on top)',
  TT: 'tritone',
  P5: 'power chord',
  m6: 'minor sixth',
  M6: 'major sixth',
  m7: 'minor seventh',
  M7: 'major seventh',
  P8: 'octave dyad',
};

export type DyadInfo = {
  interval: IntervalLabel;
  /** Interval size reduced to one octave, 0..11. */
  semitones: number;
  /** False only for the P4, whose root is the upper note (it is an inverted fifth). */
  lowerIsRoot: boolean;
  rootPitchClass: number;
};

/**
 * Describe the interval between two MIDI pitches in either order.
 * P5: root is the lower note. P4: root is the upper note (inverted fifth).
 * Every other interval takes the lower note as root by default.
 */
export function describeDyad(a: number, b: number): DyadInfo {
  const lower = Math.min(a, b);
  const upper = Math.max(a, b);
  const distance = upper - lower;
  const semitones = distance % 12;
  let interval: IntervalLabel = LABELS[semitones] ?? 'P1';
  if (semitones === 0 && distance > 0) interval = 'P8';
  const lowerIsRoot = semitones !== 5;
  return {
    interval,
    semitones,
    lowerIsRoot,
    rootPitchClass: pitchClass(lowerIsRoot ? lower : upper),
  };
}
