import { beforeEach, describe, expect, it } from 'vitest';
import { newNote } from '@/model/factories';
import { bootstrapStore, useStore } from './index';
import {
  appendRiffToArrangement,
  deleteItem,
  duplicateName,
  duplicateRiff,
  renameItem,
  setTags,
} from './libraryOps';

describe('library ops (pure)', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('duplicates a riff with a fresh id and a "copy" name', () => {
    const lib = useStore.getState().library;
    const result = duplicateRiff(lib, 'demo-riff-walkdown')!;
    expect(result.riff.id).not.toBe('demo-riff-walkdown');
    expect(result.riff.name).toBe('Walkdown Turnaround copy');
    expect(result.riff.notes).toHaveLength(56);
    expect(result.library.riffs).toHaveLength(3);
    expect(duplicateRiff(lib, 'nope')).toBeNull();
    expect(duplicateName('x copy', ['x copy', 'x copy 2'])).toBe('x copy 3');
  });

  it('renames per tier and ignores blank names', () => {
    const lib = useStore.getState().library;
    expect(renameItem(lib, 'riffs', 'demo-riff-tritone', '  Chug  ').riffs[1]!.name).toBe('Chug');
    expect(renameItem(lib, 'arrangements', 'demo-arr-verse', 'V').arrangements[0]!.name).toBe('V');
    expect(renameItem(lib, 'songs', 'demo-song', 'S').songs[0]!.title).toBe('S');
    expect(renameItem(lib, 'riffs', 'demo-riff-tritone', '   ')).toBe(lib);
  });

  it('deleting cascades: riff out of arrangements, arrangement out of songs', () => {
    const lib = useStore.getState().library;
    const noWalkdown = deleteItem(lib, 'riffs', 'demo-riff-walkdown');
    expect(noWalkdown.riffs.map((r) => r.id)).toEqual(['demo-riff-tritone']);
    expect(noWalkdown.arrangements[0]!.entries.map((e) => e.riffId)).toEqual(['demo-riff-tritone']);
    const noArr = deleteItem(lib, 'arrangements', 'demo-arr-verse');
    expect(noArr.arrangements).toHaveLength(0);
    expect(noArr.songs[0]!.parts).toHaveLength(0);
    expect(deleteItem(lib, 'songs', 'demo-song').songs).toHaveLength(0);
  });

  it('normalizes tags and appends riffs to arrangements with a tuning check', () => {
    const lib = useStore.getState().library;
    const tagged = setTags(lib, 'riffs', 'demo-riff-tritone', [' Doom', 'doom', 'NEW ', '']);
    expect(tagged.riffs[1]!.tags).toEqual(['doom', 'new']);
    const ok = appendRiffToArrangement(lib, 'demo-arr-verse', 'demo-riff-tritone');
    expect('library' in ok && ok.library.arrangements[0]!.entries).toHaveLength(3);
    const eStandard = {
      ...lib.riffs[0]!,
      id: 'e',
      name: 'E riff',
      tuning: { name: 'E Standard', pitches: [40, 45, 50, 55, 59, 64] },
    };
    const mismatch = appendRiffToArrangement(
      { ...lib, riffs: [...lib.riffs, eStandard] },
      'demo-arr-verse',
      'e',
    );
    expect('error' in mismatch && mismatch.error).toMatch(/tuning mismatch/);
    expect('error' in appendRiffToArrangement(lib, 'nope', 'demo-riff-tritone')).toBe(true);
  });
});

describe('library slice', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('create, duplicate, rename, tag, delete through the store with current-item handling', () => {
    const s = useStore.getState();
    s.duplicateRiff('demo-riff-walkdown');
    expect(useStore.getState().riff.name).toBe('Walkdown Turnaround copy');
    const copyId = useStore.getState().currentRiffId!;
    s.renameItem('riffs', copyId, 'Walkdown B');
    expect(useStore.getState().riff.name).toBe('Walkdown B');
    expect(useStore.getState().library.riffs.find((r) => r.id === copyId)!.name).toBe('Walkdown B');
    s.addTag('riffs', copyId, 'Variation');
    expect(useStore.getState().riff.tags).toContain('variation');
    s.removeTag('riffs', copyId, 'variation');
    expect(useStore.getState().riff.tags).not.toContain('variation');
    s.deleteItem('riffs', copyId);
    expect(useStore.getState().currentRiffId).toBe('demo-riff-walkdown');
    expect(useStore.getState().library.riffs).toHaveLength(2);
    s.deleteItem('riffs', 'demo-riff-walkdown');
    s.deleteItem('riffs', 'demo-riff-tritone');
    expect(useStore.getState().library.riffs).toHaveLength(1);
    expect(useStore.getState().riff.name).toBe('Untitled riff');
  });

  it('arrangements and songs open into their editing mode; dirty dots follow commits', () => {
    const s = useStore.getState();
    const arr = s.createArrangement('Build');
    expect(useStore.getState().editing).toBe('arrangement');
    expect(useStore.getState().currentArrangementId).toBe(arr.id);
    expect(s.appendRiffToArrangement(arr.id, 'demo-riff-tritone')).toBeNull();
    expect(
      useStore.getState().library.arrangements.find((a) => a.id === arr.id)!.entries,
    ).toHaveLength(1);
    const song = s.createSong('Album opener');
    expect(useStore.getState().editing).toBe('song');
    s.openRiff('demo-riff-walkdown');
    expect(useStore.getState().editing).toBe('riff');
    expect(useStore.getState().dirtyRiffIds).toEqual([]);
    s.addNote(newNote({ string: 6, fret: 1, start: 0, duration: 120 }));
    expect(useStore.getState().dirtyRiffIds).toEqual(['demo-riff-walkdown']);
    s.markRiffClean('demo-riff-walkdown');
    expect(useStore.getState().dirtyRiffIds).toEqual([]);
    s.deleteItem('songs', song.id);
    s.deleteItem('arrangements', arr.id);
    expect(useStore.getState().library.songs).toHaveLength(1);
  });
});
