import { describe, expect, it } from 'vitest';
import { newNote, newRiff } from '@/model/factories';
import { sequentialIds } from '@/model/ids';
import type { Riff } from '@/model/types';
import {
  copyNotes,
  duplicateNotes,
  expandToChords,
  moveNotes,
  pasteNotes,
  resizeNotes,
} from './riffOps';

function riff(): Riff {
  const r = newRiff();
  r.notes = [
    { ...newNote({ string: 6, fret: 3, start: 0, duration: 240, chordId: 'c1' }), id: 'a' },
    { ...newNote({ string: 5, fret: 5, start: 0, duration: 240, chordId: 'c1' }), id: 'b' },
    { ...newNote({ string: 6, fret: 5, start: 480, duration: 240 }), id: 'c' },
    { ...newNote({ string: 6, fret: 0, start: 7680 - 120, duration: 120 }), id: 'd' },
  ];
  return r;
}

describe('expandToChords', () => {
  it('pulls in every member of a touched chord, in riff order', () => {
    expect(expandToChords(riff(), ['b'])).toEqual(['a', 'b']);
    expect(expandToChords(riff(), ['c'])).toEqual(['c']);
    expect(expandToChords(riff(), ['zzz'])).toEqual([]);
  });
});

describe('moveNotes', () => {
  it('moves a chord together in time and clamps at the loop edges', () => {
    const moved = moveNotes(riff(), ['a'], 480, 0);
    expect(moved.notes.find((n) => n.id === 'a')!.start).toBe(480);
    expect(moved.notes.find((n) => n.id === 'b')!.start).toBe(480);
    expect(moved.notes.find((n) => n.id === 'c')!.start).toBe(480);
    const clamped = moveNotes(riff(), ['a'], -1000, 0);
    expect(clamped.notes.find((n) => n.id === 'a')!.start).toBe(0);
    const end = moveNotes(riff(), ['d'], 5000, 0);
    expect(end.notes.find((n) => n.id === 'd')!.start).toBe(7680 - 120);
  });

  it('changes string keeping the fret, clamped to real strings', () => {
    const up = moveNotes(riff(), ['c'], 0, -2);
    expect(up.notes.find((n) => n.id === 'c')).toMatchObject({ string: 4, fret: 5 });
    // Negative deltas go toward string 1 (up the lanes). The chord spans strings 6 and 5,
    // so it can move up at most to strings 2 and 1.
    const tooFar = moveNotes(riff(), ['a'], 0, -5);
    expect(tooFar.notes.find((n) => n.id === 'a')!.string).toBe(2);
    expect(tooFar.notes.find((n) => n.id === 'b')!.string).toBe(1);
    expect(moveNotes(riff(), ['a'], 0, 1).notes.find((n) => n.id === 'a')!.string).toBe(6);
  });

  it('with preservePitch refingers on the new string or flags unplayable', () => {
    // c is Eb2 (6:5). On string 5 (Eb2 open) that is fret 0.
    const kept = moveNotes(riff(), ['c'], 0, -1, { preservePitch: true });
    expect(kept.notes.find((n) => n.id === 'c')).toMatchObject({
      string: 5,
      fret: 0,
      unplayable: false,
    });
    // d is Bb1 (6:0); no higher string can reach it.
    const flagged = moveNotes(riff(), ['d'], 0, -1, { preservePitch: true });
    expect(flagged.notes.find((n) => n.id === 'd')).toMatchObject({
      string: 5,
      fret: 0,
      unplayable: true,
    });
  });

  it('returns the same riff for an empty or no-op move', () => {
    const r = riff();
    expect(moveNotes(r, [], 100, 0)).toBe(r);
    expect(moveNotes(r, ['a'], 0, 0)).toBe(r);
  });
});

describe('resizeNotes', () => {
  it('resizes chord members together with a minimum and a loop clip', () => {
    const grown = resizeNotes(riff(), ['b'], 240, 120);
    expect(grown.notes.find((n) => n.id === 'a')!.duration).toBe(480);
    expect(grown.notes.find((n) => n.id === 'b')!.duration).toBe(480);
    const shrunk = resizeNotes(riff(), ['c'], -1000, 120);
    expect(shrunk.notes.find((n) => n.id === 'c')!.duration).toBe(120);
    const clipped = resizeNotes(riff(), ['d'], 5000, 120);
    expect(clipped.notes.find((n) => n.id === 'd')!.duration).toBe(120);
    const same = riff();
    expect(resizeNotes(same, ['d'], 5000, 120)).toBe(same);
  });
});

describe('copy, paste, duplicate', () => {
  it('copies with relative starts and pastes with fresh ids and chordIds', () => {
    const r = riff();
    const clip = copyNotes(r, ['c', 'a']);
    expect(clip.map((n) => [n.id, n.start])).toEqual([
      ['a', 0],
      ['b', 0],
      ['c', 480],
    ]);
    const { riff: pasted, pastedIds } = pasteNotes(r, clip, 1920, sequentialIds('p'));
    expect(pastedIds).toEqual(['p-1', 'p-3', 'p-4']);
    const notes = pasted.notes.filter((n) => pastedIds.includes(n.id));
    expect(notes.map((n) => n.start)).toEqual([1920, 1920, 2400]);
    expect(notes[0]!.chordId).toBe('p-2');
    expect(notes[1]!.chordId).toBe('p-2');
    expect(notes[2]!.chordId).toBeUndefined();
    expect(pasted.notes).toHaveLength(7);
  });

  it('drops notes past the loop and clips durations at its end', () => {
    const r = riff();
    const clip = copyNotes(r, ['a', 'c']);
    const { riff: pasted, pastedIds } = pasteNotes(r, clip, 7680 - 100, sequentialIds('q'));
    expect(pastedIds).toHaveLength(2);
    expect(
      pasted.notes.filter((n) => pastedIds.includes(n.id)).every((n) => n.duration === 100),
    ).toBe(true);
    expect(pasteNotes(r, [], 0, sequentialIds()).riff).toBe(r);
  });

  it('duplicates one grid step after the selection start', () => {
    const r = riff();
    const { riff: dup, pastedIds } = duplicateNotes(r, ['c'], 120, sequentialIds('d'));
    expect(pastedIds).toEqual(['d-1']);
    expect(dup.notes.find((n) => n.id === 'd-1')).toMatchObject({ start: 600, fret: 5 });
    expect(duplicateNotes(r, [], 120, sequentialIds()).pastedIds).toEqual([]);
  });
});
