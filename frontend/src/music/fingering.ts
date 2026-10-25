/**
 * Fingering search (SPEC 3.6, DECISIONS 45). Used by transpose, retune, audio import, and
 * the AI suggestion repair step. Pure functions, deterministic, no React.
 */
import type { Tuning } from './tuning';
import { pitchOf, stringCount } from './tuning';

export type Position = { string: number; fret: number };

export type FingeringOptions = {
  /** Inclusive fret range to search. Default 0..12: riffs live near the nut. */
  fretRange?: readonly [number, number];
  /** Strings allowed, guitarist numbering. Default: the lowest four (N, N-1, N-2, N-3). */
  allowedStrings?: readonly number[];
};

export const MAX_SPAN = 4;

/**
 * Scoring weights for `bestFingering`. Lower cost wins. The balance matters: height must be
 * weaker than movement so a hand already up the neck stays there, while string and skip
 * costs keep shapes on adjacent low strings. See docs/MUSIC_MODEL.md for the worked cases.
 */
export const FINGERING_COST = {
  /** Per fret of span between the lowest and highest fretted finger. */
  span: 1.0,
  /** Per fret the hand must move from the previous hand position. */
  movement: 1.0,
  /** Per string above the lowest string, per note (prefer low strings). */
  string: 0.5,
  /** Extra per note on a string above the lowest three (the owner rarely goes there). */
  highString: 2.5,
  /** Per fret of hand position (mild preference for the nut area). */
  height: 0.3,
  /** Per unused string between the group's lowest and highest string. */
  skip: 2.0,
} as const;

export function defaultAllowedStrings(tuning: Tuning): number[] {
  const n = stringCount(tuning);
  const count = Math.min(4, n);
  return Array.from({ length: count }, (_, i) => n - i);
}

/**
 * Every (string, fret) producing `pitch` within the options.
 * Ordered lowest-pitched string first (string N, then N-1, ...).
 */
export function findFingerings(
  pitch: number,
  tuning: Tuning,
  options: FingeringOptions = {},
): Position[] {
  const [minFret, maxFret] = options.fretRange ?? [0, 12];
  const strings = [...(options.allowedStrings ?? defaultAllowedStrings(tuning))].sort(
    (x, y) => y - x,
  );
  const out: Position[] = [];
  for (const string of strings) {
    const fret = pitch - pitchOf(tuning, string, 0);
    if (fret >= minFret && fret <= maxFret) out.push({ string, fret });
  }
  return out;
}

/** Fretted (non-open) frets of a group. Open strings do not occupy a finger. */
function frettedFrets(positions: readonly Position[]): number[] {
  return positions.filter((p) => p.fret > 0).map((p) => p.fret);
}

/** Distance between the lowest and highest fretted finger; 0 with fewer than two fretted notes. */
export function handSpan(positions: readonly Position[]): number {
  const frets = frettedFrets(positions);
  if (frets.length < 2) return 0;
  return Math.max(...frets) - Math.min(...frets);
}

/** Where the hand sits: the lowest fretted finger, or 0 (the nut) when everything is open. */
export function handPosition(positions: readonly Position[]): number {
  const frets = frettedFrets(positions);
  return frets.length ? Math.min(...frets) : 0;
}

function cost(positions: readonly Position[], tuning: Tuning, previous?: readonly Position[]) {
  const n = stringCount(tuning);
  const pos = handPosition(positions);
  let c = FINGERING_COST.span * handSpan(positions) + FINGERING_COST.height * pos;
  if (previous && previous.length)
    c += FINGERING_COST.movement * Math.abs(pos - handPosition(previous));
  for (const p of positions) {
    c += FINGERING_COST.string * (n - p.string);
    if (p.string < n - 2) c += FINGERING_COST.highString;
  }
  if (positions.length > 1) {
    const strings = positions.map((p) => p.string);
    const used = strings.length;
    const spanned = Math.max(...strings) - Math.min(...strings) + 1;
    c += FINGERING_COST.skip * (spanned - used);
  }
  return c;
}

/** Tie-break: lower-pitched string first (higher number), then lower fret, position by position. */
function compareTie(a: readonly Position[], b: readonly Position[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const pa = a[i];
    const pb = b[i];
    if (!pa || !pb) break;
    if (pa.string !== pb.string) return pb.string - pa.string;
    if (pa.fret !== pb.fret) return pa.fret - pb.fret;
  }
  return 0;
}

/**
 * Pick one position per pitch for a simultaneous group, minimizing span, hand movement
 * from `previous`, and string height. Returns null when no playable combination exists
 * (each pitch on its own string, span 4 or less). Deterministic.
 */
export function bestFingering(
  pitches: readonly number[],
  tuning: Tuning,
  previous?: readonly Position[],
  options: FingeringOptions = {},
): Position[] | null {
  if (pitches.length === 0) return [];
  const choices = pitches.map((p) => findFingerings(p, tuning, options));
  if (choices.some((c) => c.length === 0)) return null;

  let best: Position[] | null = null;
  let bestCost = Infinity;

  // Depth-first over the cartesian product; groups are tiny (1 to 4 notes) so this is cheap.
  const current: Position[] = [];
  const used = new Set<number>();
  const visit = (i: number) => {
    if (i === pitches.length) {
      if (handSpan(current) > MAX_SPAN) return;
      const c = cost(current, tuning, previous);
      if (c < bestCost || (c === bestCost && best && compareTie(current, best) < 0)) {
        bestCost = c;
        best = current.slice();
      }
      return;
    }
    for (const p of choices[i] ?? []) {
      if (used.has(p.string)) continue;
      used.add(p.string);
      current.push(p);
      visit(i + 1);
      current.pop();
      used.delete(p.string);
    }
  };
  visit(0);
  return best;
}
