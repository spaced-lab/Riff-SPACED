/**
 * Find an easier tuning (SPEC 3.7, P8.T2). Pure functions, no React.
 *
 * Candidates are every preset with the same string count plus every single-string change of
 * one or two semitones from the current tuning. Each candidate gets the riff refingered with
 * the pitches kept, then a score that is lower when fewer notes are unreachable, the hand
 * spans less, and it moves less between groups: `2.0 * unplayable + 0.5 * span + 0.2 * movement`.
 * The current tuning is always in the result so the owner can see what the change buys.
 */
import type { Riff } from '@/model/types';
import { handPosition, handSpan } from './fingering';
import type { Position } from './fingering';
import { retuneRiff, simultaneousGroups } from './transpose';
import { ALL_PRESETS, isValidTuning, retuneString, stringCount } from './tuning';
import type { Tuning } from './tuning';

export const SEARCH_WEIGHTS = { unplayable: 2.0, span: 0.5, movement: 0.2 } as const;
export const ADJUSTMENTS = [-2, -1, 1, 2] as const;

export type FingeringEffort = { totalSpan: number; handMovement: number };

export type TuningCandidate = {
  tuning: Tuning;
  /** The riff refingered on this tuning, pitches kept. */
  riff: Riff;
  unplayable: number;
  totalSpan: number;
  handMovement: number;
  score: number;
  /** True for the riff's own tuning, listed for reference. */
  current: boolean;
  /** True when the tuning is a named preset (ties break toward presets). */
  preset: boolean;
  /** Total semitones of retuning from the current tuning (ties break toward less). */
  distance: number;
};

/** Sum of fret spans over all groups and of hand moves between consecutive playable groups. */
export function fingeringEffort(riff: Riff): FingeringEffort {
  let totalSpan = 0;
  let handMovement = 0;
  let previous: Position[] | null = null;
  for (const group of simultaneousGroups(riff.notes)) {
    if (group.some((n) => n.unplayable)) continue;
    const positions = group.map((n) => ({ string: n.string, fret: n.fret }));
    totalSpan += handSpan(positions);
    if (previous) handMovement += Math.abs(handPosition(positions) - handPosition(previous));
    previous = positions;
  }
  return { totalSpan, handMovement };
}

function sameTuning(a: Tuning, b: Pick<Tuning, 'pitches'>): boolean {
  return a.pitches.join() === b.pitches.join();
}

/** Presets with the same string count plus one-string adjustments, deduplicated, current first. */
export function candidateTunings(current: Tuning): Tuning[] {
  const n = stringCount(current);
  const out: Tuning[] = [{ name: current.name, pitches: [...current.pitches] }];
  const push = (t: Tuning) => {
    if (!isValidTuning(t) || out.some((o) => sameTuning(o, t))) return;
    out.push(t);
  };
  for (const preset of ALL_PRESETS) if (stringCount(preset) === n) push(preset);
  for (let string = n; string >= 1; string--) {
    for (const delta of ADJUSTMENTS) {
      const adjusted = retuneString(current, string, delta);
      const preset = ALL_PRESETS.find((p) => sameTuning(p, adjusted));
      const sign = delta > 0 ? '+' : '';
      push(preset ?? { ...adjusted, name: `${current.name}, string ${string} ${sign}${delta}` });
    }
  }
  return out;
}

export function scoreCandidate(riff: Riff, tuning: Tuning, current: boolean): TuningCandidate {
  const distance = tuning.pitches.reduce(
    (sum, p, i) => sum + Math.abs(p - (riff.tuning.pitches[i] ?? p)),
    0,
  );
  const { riff: refingered, unplayable } = retuneRiff(riff, tuning, 'keepPitches');
  const { totalSpan, handMovement } = fingeringEffort(refingered);
  const score =
    SEARCH_WEIGHTS.unplayable * unplayable +
    SEARCH_WEIGHTS.span * totalSpan +
    SEARCH_WEIGHTS.movement * handMovement;
  const preset = ALL_PRESETS.some((p) => sameTuning(p, tuning));
  return {
    tuning,
    riff: refingered,
    unplayable,
    totalSpan,
    handMovement,
    score,
    current,
    preset,
    distance,
  };
}

/** The `top` best candidates by score, plus the current tuning if it did not make the cut. */
export function findEasierTunings(riff: Riff, top = 5): TuningCandidate[] {
  const scored = candidateTunings(riff.tuning).map((t, i) => scoreCandidate(riff, t, i === 0));
  // Lower score first; ties go to the tuning that needs the least retuning, then to a named
  // preset over a one-string adjustment, then by name.
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.distance - b.distance ||
      Number(b.preset) - Number(a.preset) ||
      a.tuning.name.localeCompare(b.tuning.name),
  );
  const best = scored.slice(0, top);
  if (!best.some((c) => c.current)) best.push(scored.find((c) => c.current)!);
  return best;
}
