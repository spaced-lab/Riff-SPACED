import { describe, expect, it } from 'vitest';
import { newNote, newRiff } from '@/model/factories';
import { addNote, notesInBarOf, notesSoundingAt, removeNotes, updateNote } from './riffOps';

const riff = () => {
  const r = newRiff();
  r.notes = [
    newNote({ string: 6, fret: 3, start: 0, duration: 240 }),
    newNote({ string: 5, fret: 5, start: 240, duration: 480 }),
    newNote({ string: 6, fret: 0, start: 1920, duration: 120 }),
  ];
  return r;
};

describe('riffOps', () => {
  it('adds without mutating the input', () => {
    const r = riff();
    const n = newNote({ string: 4, fret: 5, start: 480, duration: 240 });
    const next = addNote(r, n);
    expect(next.notes).toHaveLength(4);
    expect(r.notes).toHaveLength(3);
  });

  it('updates one note and returns the same object when nothing matched', () => {
    const r = riff();
    const id = r.notes[1]!.id;
    const next = updateNote(r, id, { fret: 7 });
    expect(next.notes[1]!.fret).toBe(7);
    expect(r.notes[1]!.fret).toBe(5);
    expect(updateNote(r, 'nope', { fret: 1 })).toBe(r);
  });

  it('removes by id set', () => {
    const r = riff();
    const next = removeNotes(r, [r.notes[0]!.id, r.notes[2]!.id]);
    expect(next.notes.map((n) => n.fret)).toEqual([5]);
    expect(removeNotes(r, ['nope'])).toBe(r);
  });

  it('finds notes sounding at a tick and notes in a bar', () => {
    const r = riff();
    expect(notesSoundingAt(r, 0).map((n) => n.fret)).toEqual([3]);
    expect(notesSoundingAt(r, 300).map((n) => n.fret)).toEqual([5]);
    expect(notesSoundingAt(r, 720)).toEqual([]);
    expect(notesInBarOf(r, 100)).toHaveLength(2);
    expect(notesInBarOf(r, 1920 + 5)).toHaveLength(1);
  });
});
