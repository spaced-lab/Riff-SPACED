import { describe, expect, it } from 'vitest';
import { newNote, newRiff } from '@/model/factories';
import { validateRiff } from '@/model/validate';
import {
  mergeWithNext,
  nextLabel,
  notesCutBy,
  quantizeNotes,
  setLengthBars,
  splitSection,
  updateSection,
} from './sectionOps';

function riff() {
  const r = newRiff();
  r.notes = [
    { ...newNote({ string: 6, fret: 3, start: 0, duration: 240 }), id: 'a' },
    { ...newNote({ string: 6, fret: 3, start: 3 * 1920, duration: 480 }), id: 'b' },
    { ...newNote({ string: 6, fret: 3, start: 4 * 1920 - 120, duration: 480 }), id: 'c' },
  ];
  return r;
}

describe('setLengthBars', () => {
  it('growing pads the last section and keeps notes', () => {
    const grown = setLengthBars(riff(), 8);
    expect(grown.lengthBars).toBe(8);
    expect(grown.sections).toHaveLength(1);
    expect(grown.sections[0]!.lengthBars).toBe(8);
    expect(grown.notes).toHaveLength(3);
    expect(validateRiff(grown).ok).toBe(true);
  });

  it('shrinking removes notes past the end, clips crossing notes, and truncates sections', () => {
    let r = setLengthBars(riff(), 8);
    r = splitSection(r, r.sections[0]!.id, 4);
    r = splitSection(r, r.sections[1]!.id, 6);
    expect(r.sections.map((s) => [s.startBar, s.lengthBars])).toEqual([
      [0, 4],
      [4, 2],
      [6, 2],
    ]);
    expect(notesCutBy(r, 3).map((n) => n.id)).toEqual(['b', 'c']);
    const shrunk = setLengthBars(r, 3);
    expect(shrunk.lengthBars).toBe(3);
    expect(shrunk.sections.map((s) => [s.startBar, s.lengthBars])).toEqual([[0, 3]]);
    expect(shrunk.notes.map((n) => n.id)).toEqual(['a']);
    expect(validateRiff(shrunk).ok).toBe(true);
    const clipped = setLengthBars(riff(), 4);
    expect(clipped).toBe(clipped);
    const four = {
      ...riff(),
      lengthBars: 8,
      sections: [{ id: 's', label: 'A', startBar: 0, lengthBars: 8, kind: 'main' as const }],
    };
    const back = setLengthBars(four, 4);
    expect(back.notes.find((n) => n.id === 'c')!.duration).toBe(120);
  });
});

describe('quantizeNotes', () => {
  it('snaps starts and durations to the grid with a one-step minimum', () => {
    const r = newRiff();
    r.notes = [
      { ...newNote({ string: 6, fret: 0, start: 131, duration: 100 }), id: 'x' },
      { ...newNote({ string: 6, fret: 0, start: 7679, duration: 5 }), id: 'y' },
      { ...newNote({ string: 6, fret: 0, start: 240, duration: 240 }), id: 'z' },
    ];
    const q = quantizeNotes(r, ['x', 'y', 'z'], '1/16');
    expect(q.notes.find((n) => n.id === 'x')).toMatchObject({ start: 120, duration: 120 });
    expect(q.notes.find((n) => n.id === 'y')).toMatchObject({ start: 7680 - 120, duration: 120 });
    expect(q.notes.find((n) => n.id === 'z')).toBe(r.notes[2]);
    expect(quantizeNotes(r, ['z'], '1/16')).toBe(r);
  });
});

describe('sections', () => {
  it('split and merge keep coverage and are inverse-ish', () => {
    const r = riff();
    const id = r.sections[0]!.id;
    const split = splitSection(r, id, 2);
    expect(split.sections.map((s) => [s.label, s.startBar, s.lengthBars])).toEqual([
      ['A', 0, 2],
      ['B', 2, 2],
    ]);
    expect(validateRiff(split).ok).toBe(true);
    expect(splitSection(r, id, 0)).toBe(r);
    expect(splitSection(r, id, 4)).toBe(r);
    expect(splitSection(r, 'nope', 2)).toBe(r);
    const merged = mergeWithNext(split, id);
    expect(merged.sections).toHaveLength(1);
    expect(merged.sections[0]).toMatchObject({ id, lengthBars: 4 });
    expect(mergeWithNext(merged, id)).toBe(merged);
    const renamed = updateSection(split, split.sections[1]!.id, {
      label: 'turn',
      kind: 'turnaround',
    });
    expect(renamed.sections[1]).toMatchObject({ label: 'turn', kind: 'turnaround' });
    expect(updateSection(split, 'nope', { label: 'x' })).toBe(split);
    expect(nextLabel(split.sections)).toBe('C');
  });
});
