/**
 * Pure operations on a Riff. The store wraps each one in `commit` so undo history and
 * `updatedAt` are handled in exactly one place. Being pure, they are tested directly.
 * None of these mutate their input.
 */
import type { Note, Riff } from '@/model/types';

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
