import { describe, expect, it } from 'vitest';
import demo from '@shared/fixtures/demo-library.json';
import type { LibraryBundle } from '@/model/types';
import { validateRiff } from '@/model/validate';
import { arrangementLengthBars, flattenArrangement, flattenSong } from './flatten';

const lib = demo as unknown as LibraryBundle;

describe('flattenArrangement', () => {
  it('concatenates entries with repeats into correct ticks and one section per entry', () => {
    const arr = lib.arrangements[0]!; // Walkdown x3, Tritone x1
    const flat = flattenArrangement(arr, lib);
    expect(arrangementLengthBars(arr, lib)).toBe(16);
    expect(flat.lengthBars).toBe(16);
    expect(flat.notes).toHaveLength(56 * 3 + 60);
    expect(flat.sections.map((s) => [s.label, s.startBar, s.lengthBars])).toEqual([
      ['Walkdown x3', 0, 12],
      ['Tritone', 12, 4],
    ]);
    expect(flat.markers.map((m) => m.tick)).toEqual([0, 4 * 1920, 8 * 1920, 12 * 1920]);
    // The second repeat's first note starts one riff length later and keeps its pitch.
    const firstRepeat = flat.notes.find((n) => n.id.endsWith(':0:0:wd-n01'))!;
    const secondRepeat = flat.notes.find((n) => n.id.endsWith(':0:1:wd-n01'))!;
    expect(secondRepeat.start - firstRepeat.start).toBe(4 * 1920);
    expect(secondRepeat.fret).toBe(firstRepeat.fret);
    // Chord ids are namespaced per repeat so chords never merge across repeats.
    const chordIds = new Set(
      flat.notes.filter((n) => n.chordId?.endsWith('wd-c01')).map((n) => n.chordId),
    );
    expect(chordIds.size).toBe(3);
    expect(flat.sourceNoteIds[secondRepeat.id]).toBe('wd-n01');
    expect(validateRiff({ ...flat, markers: undefined, sourceNoteIds: undefined }).ok).toBe(true);
    expect(flat.tempo.bpm).toBe(92);
    expect(flat.tuning.name).toBe('Bb Standard');
  });

  it('transposes by shifting frets and flags notes that leave the neck', () => {
    const arr = {
      ...lib.arrangements[0]!,
      entries: [
        { riffId: 'demo-riff-walkdown', repeats: 1, transpose: 2 },
        { riffId: 'demo-riff-tritone', repeats: 1, transpose: -3 },
      ],
    };
    const flat = flattenArrangement(arr, lib);
    const up = flat.notes.find((n) => n.id.endsWith(':0:0:wd-n02'))!;
    expect(up.fret).toBe(5);
    expect(up.unplayable).toBe(false);
    const down = flat.notes.find((n) => n.id.endsWith(':1:0:tc-n01'))!;
    expect(down.fret).toBe(0);
    expect(down.unplayable).toBe(true);
  });

  it('an empty arrangement is one empty bar, and missing riffs are skipped', () => {
    const empty = flattenArrangement({ ...lib.arrangements[0]!, entries: [] }, lib);
    expect(empty.lengthBars).toBe(1);
    expect(empty.notes).toEqual([]);
    expect(empty.sections[0]!.label).toBe('empty');
    const missing = flattenArrangement(
      { ...lib.arrangements[0]!, entries: [{ riffId: 'nope', repeats: 2 }] },
      lib,
    );
    expect(missing.notes).toEqual([]);
  });
});

describe('flattenSong', () => {
  it('lays parts back to back with part labels on the markers', () => {
    const song = {
      ...lib.songs[0]!,
      parts: [
        { arrangementId: 'demo-arr-verse', label: 'Verse' },
        { arrangementId: 'demo-arr-verse', label: 'Verse again' },
      ],
    };
    const flat = flattenSong(song, lib);
    expect(flat.lengthBars).toBe(32);
    expect(flat.sections.map((s) => [s.label, s.startBar])).toEqual([
      ['Verse', 0],
      ['Verse again', 16],
    ]);
    expect(flat.markers[0]!.label).toBe('Verse · Walkdown x3');
    expect(flat.notes).toHaveLength((56 * 3 + 60) * 2);
    expect(new Set(flat.notes.map((n) => n.id)).size).toBe(flat.notes.length);
    expect(flat.notes.at(-1)!.start).toBeGreaterThanOrEqual(16 * 1920);
  });
});
