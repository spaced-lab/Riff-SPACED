/**
 * Pure operations on a Riff. The store wraps each one in `commit` so undo history and
 * `updatedAt` are handled in exactly one place. Being pure, they are tested directly.
 * None of these mutate their input.
 */
import type { Note, Riff } from '@/model/types';
import { bestFingering } from '@/music/fingering';
import { TICKS_PER_BAR } from '@/music/time';
import { pitchOf } from '@/music/tuning';

export function addNote(riff: Riff, note: Note): Riff {
  return { ...riff, notes: [...riff.notes, note] };
}

export function updateNote(riff: Riff, id: string, patch: Partial<Omit<Note, 'id'>>): Riff {
  let changed = false;
  const notes = riff.notes.map((n) => {
    if (n.id !== id) return n;
    changed = true;
    return { ...n, ...patch };
  });
  return changed ? { ...riff, notes } : riff;
}

export function removeNotes(riff: Riff, ids: readonly string[]): Riff {
  const drop = new Set(ids);
  const notes = riff.notes.filter((n) => !drop.has(n.id));
  return notes.length === riff.notes.length ? riff : { ...riff, notes };
}

/** Notes whose [start, start + duration) interval contains `tick`. */
export function notesSoundingAt(riff: Riff, tick: number): Note[] {
  return riff.notes.filter((n) => n.start <= tick && tick < n.start + n.duration);
}

/** Notes starting within the bar that contains `tick`. */
export function notesInBarOf(riff: Riff, tick: number, ticksPerBar = 1920): Note[] {
  const barStart = Math.floor(tick / ticksPerBar) * ticksPerBar;
  return riff.notes.filter((n) => n.start >= barStart && n.start < barStart + ticksPerBar);
}

// ---------------------------------------------------------------------------
// Editing operations on a selection (P3.T3). All of them respect chord integrity:
// a chord member drags its whole chord along, so dyads never come apart by accident.
// ---------------------------------------------------------------------------

/** Expand a set of ids to include every member of any chord touched. */
export function expandToChords(riff: Riff, ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  const chordIds = new Set(
    riff.notes.filter((n) => wanted.has(n.id) && n.chordId).map((n) => n.chordId as string),
  );
  for (const n of riff.notes) if (n.chordId && chordIds.has(n.chordId)) wanted.add(n.id);
  return riff.notes.filter((n) => wanted.has(n.id)).map((n) => n.id);
}

export type MoveOptions = {
  /** Keep the sounding pitch when changing string, refingering with bestFingering. */
  preservePitch?: boolean;
};

/**
 * Move notes in time and across strings. The time delta is clamped so the group stays
 * inside the loop; the string delta is clamped so every note stays on a real string.
 */
export function moveNotes(
  riff: Riff,
  ids: readonly string[],
  deltaTicks: number,
  deltaStrings: number,
  options: MoveOptions = {},
): Riff {
  const moving = new Set(expandToChords(riff, ids));
  const group = riff.notes.filter((n) => moving.has(n.id));
  if (!group.length) return riff;

  const loopEnd = riff.lengthBars * TICKS_PER_BAR;
  const minStart = Math.min(...group.map((n) => n.start));
  const maxEnd = Math.max(...group.map((n) => n.start + n.duration));
  const dt = Math.max(-minStart, Math.min(loopEnd - maxEnd, deltaTicks));

  const stringCount = riff.tuning.pitches.length;
  const minString = Math.min(...group.map((n) => n.string));
  const maxString = Math.max(...group.map((n) => n.string));
  const ds = Math.max(1 - minString, Math.min(stringCount - maxString, deltaStrings));

  if (dt === 0 && ds === 0) return riff;

  const notes = riff.notes.map((n) => {
    if (!moving.has(n.id)) return n;
    const string = n.string + ds;
    if (ds === 0 || !options.preservePitch) {
      return { ...n, start: n.start + dt, string };
    }
    const pitch = pitchOf(riff.tuning, n.string, n.fret);
    const found = bestFingering([pitch], riff.tuning, undefined, {
      allowedStrings: [string],
      fretRange: [0, 24],
    });
    const fret = found?.[0]?.fret;
    return fret === undefined
      ? { ...n, start: n.start + dt, string, unplayable: true }
      : { ...n, start: n.start + dt, string, fret, unplayable: false };
  });
  return { ...riff, notes };
}

/** Change duration by a delta, never below `minDuration`, never past the loop end. */
export function resizeNotes(
  riff: Riff,
  ids: readonly string[],
  deltaTicks: number,
  minDuration: number,
): Riff {
  const resizing = new Set(expandToChords(riff, ids));
  const loopEnd = riff.lengthBars * TICKS_PER_BAR;
  let changed = false;
  const notes = riff.notes.map((n) => {
    if (!resizing.has(n.id)) return n;
    const duration = Math.max(minDuration, Math.min(loopEnd - n.start, n.duration + deltaTicks));
    if (duration === n.duration) return n;
    changed = true;
    return { ...n, duration };
  });
  return changed ? { ...riff, notes } : riff;
}

/** Notes copied with their starts made relative to the earliest one. */
export function copyNotes(riff: Riff, ids: readonly string[]): Note[] {
  const copying = new Set(expandToChords(riff, ids));
  const group = riff.notes.filter((n) => copying.has(n.id));
  if (!group.length) return [];
  const origin = Math.min(...group.map((n) => n.start));
  return group.map((n) => ({ ...n, start: n.start - origin }));
}

/**
 * Paste relative notes at `cursor` with fresh ids and chordIds, dropping anything that
 * would start past the loop and clipping durations at the loop end.
 */
export function pasteNotes(
  riff: Riff,
  clip: readonly Note[],
  cursor: number,
  makeId: () => string,
): { riff: Riff; pastedIds: string[] } {
  const loopEnd = riff.lengthBars * TICKS_PER_BAR;
  const chordMap = new Map<string, string>();
  const pasted: Note[] = [];
  for (const n of clip) {
    const start = cursor + n.start;
    if (start >= loopEnd) continue;
    const note: Note = {
      ...n,
      id: makeId(),
      start,
      duration: Math.min(n.duration, loopEnd - start),
    };
    if (n.chordId) {
      let mapped = chordMap.get(n.chordId);
      if (!mapped) {
        mapped = makeId();
        chordMap.set(n.chordId, mapped);
      }
      note.chordId = mapped;
    }
    pasted.push(note);
  }
  if (!pasted.length) return { riff, pastedIds: [] };
  return {
    riff: { ...riff, notes: [...riff.notes, ...pasted] },
    pastedIds: pasted.map((n) => n.id),
  };
}

/** Duplicate the selection `offset` ticks later (one grid step by default). */
export function duplicateNotes(
  riff: Riff,
  ids: readonly string[],
  offset: number,
  makeId: () => string,
): { riff: Riff; pastedIds: string[] } {
  const clip = copyNotes(riff, ids);
  if (!clip.length) return { riff, pastedIds: [] };
  const origin = Math.min(
    ...riff.notes.filter((n) => expandToChords(riff, ids).includes(n.id)).map((n) => n.start),
  );
  return pasteNotes(riff, clip, origin + offset, makeId);
}
