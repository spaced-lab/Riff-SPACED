/**
 * Transpose and retune (SPEC 3.7). Pure functions over a riff; no React, no store.
 *
 * Both tools reduce to one operation, `refingerRiff`: decide the pitch every note should
 * sound, then find positions for each simultaneous group with `bestFingering`, carrying the
 * previous group's hand position for continuity. A note with no fingering at all is flagged
 * `unplayable` and kept at its old position (amber in the UI, silent in playback), never
 * dropped: the owner would rather see the problem than lose the note.
 */
import type { Note, Riff } from '@/model/types';
import { bestFingering } from './fingering';
import type { FingeringOptions, Position } from './fingering';
import { pitchOf, stringCount } from './tuning';
import type { Tuning } from './tuning';

export type RetuneMode = 'keepShapes' | 'keepPitches';

export type RefingerResult = {
  riff: Riff;
  /** Notes flagged unplayable because no position exists on the tuning. */
  unplayable: number;
  /** Notes whose (string, fret) changed. */
  moved: number;
};

/** Notes that sound together: same start and chordId (a single note is its own group). */
export function simultaneousGroups(notes: readonly Note[]): Note[][] {
  const byKey = new Map<string, Note[]>();
  const order: Note[][] = [];
  for (const note of [...notes].sort((a, b) => a.start - b.start)) {
    const key = `${note.start}:${note.chordId ?? `solo:${note.id}`}`;
    let group = byKey.get(key);
    if (!group) {
      group = [];
      byKey.set(key, group);
      order.push(group);
    }
    group.push(note);
  }
  return order;
}

/** The home range first (frets 0 to 12 on the low four strings), then anywhere on the neck. */
export function searchPasses(tuning: Tuning): FingeringOptions[] {
  const all = Array.from({ length: stringCount(tuning) }, (_, i) => i + 1);
  return [{ fretRange: [0, 12] }, { fretRange: [0, 24], allowedStrings: all }];
}

/**
 * Give every note the position that sounds `targetPitch(note)` on `tuning`.
 * Group by group in time order; `previous` carries the last found hand position.
 */
export function refingerRiff(
  riff: Riff,
  tuning: Tuning,
  targetPitch: (note: Note) => number,
): RefingerResult {
  const passes = searchPasses(tuning);
  const positions = new Map<string, Position | null>();
  let previous: Position[] | undefined;
  for (const group of simultaneousGroups(riff.notes)) {
    const pitches = group.map(targetPitch);
    let found: Position[] | null = null;
    for (const options of passes) {
      found = bestFingering(pitches, tuning, previous, options);
      if (found) break;
    }
    group.forEach((note, i) => positions.set(note.id, found ? (found[i] ?? null) : null));
    if (found) previous = found;
  }
  let unplayable = 0;
  let moved = 0;
  const notes = riff.notes.map((note) => {
    const position = positions.get(note.id) ?? null;
    if (!position) {
      unplayable += 1;
      return { ...note, unplayable: true };
    }
    const next: Note = { ...note, string: position.string, fret: position.fret };
    delete next.unplayable;
    if (position.string !== note.string || position.fret !== note.fret) moved += 1;
    return next;
  });
  return {
    riff: { ...riff, tuning: { name: tuning.name, pitches: [...tuning.pitches] }, notes },
    unplayable,
    moved,
  };
}

/** Shift every pitch by `semitones` on the same tuning and refinger (SPEC 3.7). */
export function transposeRiff(riff: Riff, semitones: number): RefingerResult {
  if (semitones === 0) return { riff, unplayable: 0, moved: 0 };
  const tuning = riff.tuning;
  return refingerRiff(riff, tuning, (n) => pitchOf(tuning, n.string, n.fret) + semitones);
}

/**
 * Change tuning. `keepShapes` keeps every (string, fret) so the pitches move with the
 * strings (the owner's "one click lower everything"); `keepPitches` keeps the sounding notes
 * and refingers them on the new tuning.
 */
export function retuneRiff(riff: Riff, tuning: Tuning, mode: RetuneMode): RefingerResult {
  if (mode === 'keepShapes') {
    const n = stringCount(tuning);
    let unplayable = 0;
    const notes = riff.notes.map((note) => {
      if (note.string <= n) {
        if (!note.unplayable) return note;
        const next = { ...note };
        delete next.unplayable;
        return next;
      }
      unplayable += 1;
      return { ...note, unplayable: true };
    });
    return {
      riff: { ...riff, tuning: { name: tuning.name, pitches: [...tuning.pitches] }, notes },
      unplayable,
      moved: 0,
    };
  }
  const old = riff.tuning;
  return refingerRiff(riff, tuning, (n) =>
    n.string <= stringCount(old) ? pitchOf(old, n.string, n.fret) : pitchOf(tuning, 1, 24),
  );
}
