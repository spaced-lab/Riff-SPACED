import { beforeEach, describe, expect, it } from 'vitest';
import { newNote } from '@/model/factories';
import { bootstrapStore, useStore } from './index';
import { clampRange } from './viewSlice';

describe('store', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('boots with the demo library and opens the first riff', () => {
    const s = useStore.getState();
    expect(s.library.riffs.map((r) => r.name)).toEqual(['Walkdown Turnaround', 'Tritone Chug']);
    expect(s.currentRiffId).toBe('demo-riff-walkdown');
    expect(s.riff.name).toBe('Walkdown Turnaround');
    expect(s.riff.notes).toHaveLength(56);
  });

  it('records one history snapshot per commit and stamps updatedAt', () => {
    const s = useStore.getState();
    const before = s.riff.updatedAt;
    s.addNote(newNote({ string: 4, fret: 5, start: 480, duration: 240 }));
    s.updateNote(useStore.getState().riff.notes.at(-1)!.id, { fret: 7 });
    const after = useStore.getState();
    expect(after.history.past.map((h) => h.label)).toEqual(['add note', 'edit note']);
    expect(after.history.past[0]!.snapshot.notes).toHaveLength(56);
    expect(after.riff.notes).toHaveLength(57);
    expect(after.riff.updatedAt >= before).toBe(true);
  });

  it('a no-op change records nothing', () => {
    const s = useStore.getState();
    s.updateNote('does-not-exist', { fret: 1 });
    s.removeNotes(['does-not-exist']);
    expect(useStore.getState().history.past).toEqual([]);
  });

  it('removing notes drops them from the selection too', () => {
    const s = useStore.getState();
    const [a, b] = s.riff.notes;
    s.select([a!.id, b!.id]);
    s.removeNotes([a!.id]);
    expect(useStore.getState().selectedNoteIds).toEqual([b!.id]);
  });

  it('opening another riff writes edits back to the library and resets history', () => {
    const s = useStore.getState();
    s.addNote(newNote({ string: 4, fret: 5, start: 480, duration: 240 }));
    s.openRiff('demo-riff-tritone');
    const after = useStore.getState();
    expect(after.riff.name).toBe('Tritone Chug');
    expect(after.history.past).toEqual([]);
    expect(after.library.riffs[0]!.notes).toHaveLength(57);
    expect(after.selectedNoteIds).toEqual([]);
  });

  it('selection is additive on request and highlight updates skip unchanged sets', () => {
    const s = useStore.getState();
    s.select(['a']);
    s.select(['b'], true);
    s.select(['b', 'c'], true);
    expect(useStore.getState().selectedNoteIds).toEqual(['a', 'b', 'c']);
    s.setHighlightIds(['x']);
    const ref = useStore.getState().highlightIds;
    s.setHighlightIds(['x']);
    expect(useStore.getState().highlightIds).toBe(ref);
    s.clearSelection();
    expect(useStore.getState().selectedNoteIds).toEqual([]);
  });

  it('view toggles and fret range clamping', () => {
    const s = useStore.getState();
    s.setShowLetters(true);
    s.setAccidentals('sharps');
    s.setFretRange({ from: -3, to: 40 });
    s.togglePanel('library');
    const v = useStore.getState();
    expect(v.showLetters).toBe(true);
    expect(v.accidentals).toBe('sharps');
    expect(v.fretRange).toEqual({ from: 0, to: 24 });
    expect(v.panels.library).toBe(false);
    expect(clampRange({ from: 10, to: 10 })).toEqual({ from: 10, to: 11 });
  });
});
