import { beforeEach, describe, expect, it } from 'vitest';
import { newNote, newRiff } from '@/model/factories';
import { HISTORY_CAP, emptyHistory, pushHistory } from './history';
import { bootstrapStore, useStore } from './index';
import { selectRedoLabel, selectUndoLabel } from './riffSlice';

describe('undo / redo', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
    useStore.getState().setRiff(newRiff());
  });

  it('walks back and forward through edits with labels', () => {
    const s = useStore.getState();
    s.addNote(newNote({ string: 6, fret: 1, start: 0, duration: 120 }));
    s.addNote(newNote({ string: 6, fret: 2, start: 120, duration: 120 }));
    s.addNote(newNote({ string: 6, fret: 3, start: 240, duration: 120 }));
    expect(selectUndoLabel(useStore.getState())).toBe('add note');
    expect(selectRedoLabel(useStore.getState())).toBeNull();

    s.undo();
    expect(useStore.getState().riff.notes.map((n) => n.fret)).toEqual([1, 2]);
    s.undo();
    expect(useStore.getState().riff.notes.map((n) => n.fret)).toEqual([1]);
    expect(selectRedoLabel(useStore.getState())).toBe('add note');
    s.redo();
    expect(useStore.getState().riff.notes.map((n) => n.fret)).toEqual([1, 2]);
    s.undo();
    s.undo();
    expect(useStore.getState().riff.notes).toEqual([]);
    s.undo();
    expect(useStore.getState().riff.notes).toEqual([]);
    s.redo();
    s.redo();
    s.redo();
    s.redo();
    expect(useStore.getState().riff.notes.map((n) => n.fret)).toEqual([1, 2, 3]);
  });

  it('a new edit after undo clears the redo stack', () => {
    const s = useStore.getState();
    s.addNote(newNote({ string: 6, fret: 1, start: 0, duration: 120 }));
    s.addNote(newNote({ string: 6, fret: 2, start: 120, duration: 120 }));
    s.undo();
    s.addNote(newNote({ string: 6, fret: 9, start: 120, duration: 120 }));
    expect(useStore.getState().history.future).toEqual([]);
    s.redo();
    expect(useStore.getState().riff.notes.map((n) => n.fret)).toEqual([1, 9]);
  });

  it('caps the stack at 200 entries', () => {
    let h = emptyHistory();
    const r = newRiff();
    for (let i = 0; i < HISTORY_CAP + 25; i++) h = pushHistory(h, `edit ${i}`, r);
    expect(h.past).toHaveLength(HISTORY_CAP);
    expect(h.past[0]!.label).toBe('edit 25');
  });

  it('undo clears the selection so stale ids never linger', () => {
    const s = useStore.getState();
    s.addNote(newNote({ string: 6, fret: 1, start: 0, duration: 120 }));
    s.select([useStore.getState().riff.notes[0]!.id]);
    s.undo();
    expect(useStore.getState().selectedNoteIds).toEqual([]);
  });
});
