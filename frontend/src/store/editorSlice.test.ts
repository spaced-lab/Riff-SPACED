import { beforeEach, describe, expect, it } from 'vitest';
import { newNote, newRiff } from '@/model/factories';
import { bootstrapStore, useStore } from './index';
import { addNoteAt, clampCursor } from './editorSlice';

describe('addNoteAt (pure)', () => {
  it('adds a note of one grid step at the cursor', () => {
    const riff = newRiff();
    const next = addNoteAt(riff, 480, 6, 3, '1/8', false);
    expect(next.notes).toHaveLength(1);
    expect(next.notes[0]).toMatchObject({ string: 6, fret: 3, start: 480, duration: 240 });
    expect(next.notes[0]!.chordId).toBeUndefined();
  });

  it('replaces a note already on that string at the cursor', () => {
    let riff = addNoteAt(newRiff(), 0, 6, 3, '1/16', false);
    riff = addNoteAt(riff, 0, 6, 5, '1/16', false);
    expect(riff.notes).toHaveLength(1);
    expect(riff.notes[0]!.fret).toBe(5);
  });

  it('joins the chord at the cursor, sharing one chordId and the anchor duration', () => {
    let riff = addNoteAt(newRiff(), 0, 6, 3, '1/8', false);
    riff = addNoteAt(riff, 0, 5, 5, '1/16', true);
    expect(riff.notes).toHaveLength(2);
    const [a, b] = riff.notes;
    expect(a!.chordId).toBeDefined();
    expect(b!.chordId).toBe(a!.chordId);
    expect(b!.duration).toBe(240);
    riff = addNoteAt(riff, 0, 4, 5, '1/16', true);
    expect(new Set(riff.notes.map((n) => n.chordId)).size).toBe(1);
  });

  it('with chord but nothing at the cursor, just adds a plain note', () => {
    const riff = addNoteAt(newRiff(), 960, 6, 0, '1/16', true);
    expect(riff.notes[0]!.chordId).toBeUndefined();
  });

  it('clips the duration at the loop end', () => {
    const riff = addNoteAt(newRiff(), 4 * 1920 - 60, 6, 0, '1/4', false);
    expect(riff.notes[0]!.duration).toBe(60);
  });
});

describe('cursor', () => {
  it('snaps and clamps to the loop', () => {
    const riff = newRiff();
    expect(clampCursor(130, riff, '1/16')).toBe(120);
    expect(clampCursor(-50, riff, '1/16')).toBe(0);
    expect(clampCursor(99_999, riff, '1/16')).toBe(4 * 1920 - 120);
    expect(clampCursor(99_999, riff, '1/4')).toBe(4 * 1920 - 480);
  });
});

describe('editor slice', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
    useStore.getState().setRiff(newRiff());
  });

  it('moves the cursor by steps and bars and cycles the grid', () => {
    const s = useStore.getState();
    s.moveCursor(2);
    expect(useStore.getState().editCursorTick).toBe(240);
    s.moveCursorBars(1);
    expect(useStore.getState().editCursorTick).toBe(1920 + 240);
    s.moveCursor(-100);
    expect(useStore.getState().editCursorTick).toBe(0);
    s.cycleGrid(1);
    expect(useStore.getState().grid).toBe('1/8T');
    s.cycleGrid(-1);
    s.cycleGrid(-1);
    expect(useStore.getState().grid).toBe('1/8');
    s.setGrid('1/16T');
    s.cycleGrid(1);
    expect(useStore.getState().grid).toBe('1/4');
  });

  it('adds notes at the cursor through commit and selects all', () => {
    const s = useStore.getState();
    s.setEditCursor(480);
    s.addNoteAtCursor(6, 3);
    s.addNoteAtCursor(5, 5, { chord: true });
    const riff = useStore.getState().riff;
    expect(riff.notes).toHaveLength(2);
    expect(riff.notes[1]!.chordId).toBe(riff.notes[0]!.chordId);
    expect(useStore.getState().history.past.map((h) => h.label)).toEqual([
      'add note',
      'add chord note',
    ]);
    s.selectAll();
    expect(useStore.getState().selectedNoteIds).toHaveLength(2);
    useStore
      .getState()
      .setRiff({ ...newRiff(), notes: [newNote({ string: 6, fret: 0, start: 0, duration: 120 })] });
    expect(useStore.getState().editCursorTick).toBe(0);
  });
});
