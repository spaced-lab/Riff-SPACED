/**
 * Pure helpers for accepting AI suggestions (SPEC 9.3). No React, no store: a riff in, a
 * riff out, so "Add as variation" is one `commit` and therefore one undo step.
 */
import { uuid } from '@/model/ids';
import type { Note, Riff } from '@/model/types';
import { TICKS_PER_BAR } from '@/music/time';
import { nextLabel } from './sectionOps';

export const MAX_LENGTH_BARS = 64;

/**
 * Append `suggestion` to the end of `riff` as a new `variation` section.
 *
 * Every incoming note gets a fresh id (two riffs made from the same parent share ids) and
 * chordIds are namespaced so a chord in the variation never merges with one in the parent.
 * The tuning must match: a suggestion in another tuning can only become a new riff.
 */
export function appendAsVariation(riff: Riff, suggestion: Riff): Riff {
  if (riff.tuning.pitches.join() !== suggestion.tuning.pitches.join())
    throw new Error(
      `tuning mismatch: the riff is in ${riff.tuning.name}, the suggestion in ${suggestion.tuning.name}`,
    );
  const lengthBars = riff.lengthBars + suggestion.lengthBars;
  if (lengthBars > MAX_LENGTH_BARS)
    throw new Error(`the riff would be ${lengthBars} bars; the limit is ${MAX_LENGTH_BARS}`);
  const offset = riff.lengthBars * TICKS_PER_BAR;
  const chordPrefix = uuid().slice(0, 8);
  const notes: Note[] = suggestion.notes.map((n) => {
    const moved: Note = { ...n, id: uuid(), start: n.start + offset };
    if (n.chordId) moved.chordId = `${chordPrefix}:${n.chordId}`;
    return moved;
  });
  return {
    ...riff,
    lengthBars,
    sections: [
      ...riff.sections,
      {
        id: uuid(),
        label: nextLabel(riff.sections),
        startBar: riff.lengthBars,
        lengthBars: suggestion.lengthBars,
        kind: 'variation',
      },
    ],
    notes: [...riff.notes, ...notes],
  };
}

/** A copy of a suggested riff ready to live in the library beside its parent. */
export function asSiblingRiff(suggestion: Riff, existingNames: readonly string[]): Riff {
  let name = suggestion.name;
  let n = 2;
  while (existingNames.includes(name)) name = `${suggestion.name} (${n++})`;
  const now = new Date().toISOString();
  return {
    ...structuredClone(suggestion),
    id: uuid(),
    name,
    createdAt: now,
    updatedAt: now,
    tags: [...new Set([...(suggestion.tags ?? []), 'ai'])],
  };
}
