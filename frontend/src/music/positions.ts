/**
 * Hand positions for the scale overlay (Phase 9, P9.T5): the CAGED shapes.
 *
 * The idea: a scale on a guitar neck is learned as a handful of shapes, each playable
 * without moving the hand, that chain together up the neck. The common system is CAGED,
 * named after the five open chord shapes (C, A, G, E, D) each position is built around.
 *
 * How the shapes are derived here. Every pentatonic box has exactly two notes per string,
 * and the five boxes of a pentatonic tile the neck. The box anchored at the k-th pentatonic
 * note on the lowest string takes, on every other string, the consecutive pair of pentatonic
 * notes whose lower note is nearest in fret to that anchor (ties go to the lower pair, so a
 * box never reaches up more than it has to). For a seven-note scale the same five boxes are
 * built from the scale's pentatonic skeleton (major pentatonic for scales with a major third,
 * minor pentatonic otherwise) and the remaining scale notes that fall inside the box's fret
 * span are added. That reproduces the classic pentatonic boxes exactly and gives the usual
 * CAGED major-scale positions (two or three notes per string, four to five frets wide).
 *
 * Naming: in the CAGED order going up the neck (E, D, C, A, G, then E again an octave up),
 * the E shape is the box whose lowest-string pair starts on the root, because the E chord
 * shape has its root under the first finger on the low string. Letters only make sense for a
 * six-string tuning with standard intervals (fourths, with a major third between strings 3
 * and 2); any other tuning gets "Position 1, 2, 3..." from the nut up.
 */
import { pitchClass } from './pitch';
import type { Scale } from './scales';
import { pitchOf } from './tuning';
import type { Tuning } from './tuning';

export type Position = {
  /** 0-based, from the nut up. */
  index: number;
  /** `E shape`, `D shape`... or `Position 3` when the tuning has no CAGED letters. */
  name: string;
  /** Lowest and highest fret used by any string in the position. */
  fromFret: number;
  toFret: number;
  /** The (string, fret) cells in the position, keyed `${string}:${fret}`. */
  cells: ReadonlySet<string>;
};

export const cellKey = (string: number, fret: number): string => `${string}:${fret}`;

const MAJOR_PENTATONIC = [0, 2, 4, 7, 9];
const MINOR_PENTATONIC = [0, 3, 5, 7, 10];
/** The CAGED letters as the shapes follow each other up the neck. */
const CAGED_ASCENDING = ['E', 'D', 'C', 'A', 'G'] as const;

/** Semitones between adjacent strings, low to high, for a standard six-string tuning. */
const STANDARD_INTERVALS = [5, 5, 5, 4, 5];

/** Standard intervals (E Standard, Bb Standard...): the CAGED letters apply. */
export function hasStandardIntervals(tuning: Tuning): boolean {
  const p = tuning.pitches;
  if (p.length !== 6) return false;
  return STANDARD_INTERVALS.every((step, i) => (p[i + 1] ?? 0) - (p[i] ?? 0) === step);
}

/** The pentatonic the boxes are built on: major if the scale has a natural third. */
export function skeletonOf(scale: Scale): readonly number[] {
  const third = scale.degrees.find((d) => d.role === 'third');
  return third && !third.flat ? MAJOR_PENTATONIC : MINOR_PENTATONIC;
}

/** Frets on `string` (0..fretCount) whose pitch class is in `classes`, ascending. */
function fretsIn(
  tuning: Tuning,
  string: number,
  classes: ReadonlySet<number>,
  fretCount: number,
): number[] {
  const out: number[] = [];
  for (let f = 0; f <= fretCount; f++) {
    if (classes.has(pitchClass(pitchOf(tuning, string, f)))) out.push(f);
  }
  return out;
}

/** The consecutive pair in `frets` whose lower note is nearest `anchor`; ties to the lower. */
function nearestPair(frets: readonly number[], anchor: number): [number, number] | null {
  let best: [number, number] | null = null;
  let bestDistance = Infinity;
  for (let j = 0; j + 1 < frets.length; j++) {
    const lower = frets[j] ?? 0;
    const upper = frets[j + 1] ?? 0;
    const distance = Math.abs(lower - anchor);
    if (distance < bestDistance) {
      best = [lower, upper];
      bestDistance = distance;
    }
  }
  return best;
}

export function positionsOf(
  scale: Scale,
  root: number,
  tuning: Tuning,
  fretCount = 24,
): Position[] {
  const stringCount = tuning.pitches.length;
  if (stringCount === 0) return [];
  const lowest = stringCount;
  const skeleton = new Set(skeletonOf(scale).map((semi) => pitchClass(root + semi)));
  const scaleClasses = new Set(scale.degrees.map((d) => pitchClass(root + d.semitones)));
  const skeletonFrets = new Map<number, number[]>();
  for (let s = 1; s <= stringCount; s++) {
    skeletonFrets.set(s, fretsIn(tuning, s, skeleton, fretCount));
  }

  const anchors = skeletonFrets.get(lowest) ?? [];
  const positions: Position[] = [];
  const caged = hasStandardIntervals(tuning);
  // The box whose lowest-string pair starts on the root is the E shape; letters count from it.
  const rootPc = pitchClass(root);
  const eIndex = anchors.findIndex((a) => pitchClass(pitchOf(tuning, lowest, a)) === rootPc);

  for (let k = 0; k + 1 < anchors.length; k++) {
    const anchor = anchors[k] ?? 0;
    const cells = new Set<string>();
    let from = Infinity;
    let to = -Infinity;
    for (let s = 1; s <= stringCount; s++) {
      const pair = nearestPair(skeletonFrets.get(s) ?? [], anchor);
      if (!pair) continue;
      // The skeleton shapes the box; only notes the scale really has become cells (the
      // harmonic minor's skeleton has a b7 the scale does not).
      for (const f of pair) {
        if (scaleClasses.has(pitchClass(pitchOf(tuning, s, f)))) cells.add(cellKey(s, f));
      }
      from = Math.min(from, pair[0]);
      to = Math.max(to, pair[1]);
    }
    if (!Number.isFinite(from)) continue;
    // Fill in the scale notes that are not in the skeleton but fall inside the box.
    for (let s = 1; s <= stringCount; s++) {
      for (let f = from; f <= to; f++) {
        const pc = pitchClass(pitchOf(tuning, s, f));
        if (scaleClasses.has(pc) && !skeleton.has(pc)) cells.add(cellKey(s, f));
      }
    }
    const index = positions.length;
    const name =
      caged && eIndex >= 0
        ? `${CAGED_ASCENDING[(((k - eIndex) % 5) + 5) % 5]} shape`
        : `Position ${index + 1}`;
    positions.push({ index, name, fromFret: from, toFret: to, cells });
  }
  return positions;
}
