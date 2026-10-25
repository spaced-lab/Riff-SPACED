import { describe, expect, it } from 'vitest';
import demo from '../../../shared/fixtures/demo-library.json';
import type { LibraryBundle, Note, Riff } from '@/model/types';
import { validateRiff } from '@/model/validate';
import { fixture } from './fixture';
import { refingerRiff, retuneRiff, simultaneousGroups, transposeRiff } from './transpose';
import { pitchOf, presetByName } from './tuning';
import type { Tuning } from './tuning';

const library = demo as unknown as LibraryBundle;
const riffById = (id: string): Riff => library.riffs.find((r) => r.id === id)!;
const pitches = (riff: Riff) => riff.notes.map((n) => pitchOf(riff.tuning, n.string, n.fret));

describe('transposeRiff', () => {
  it('+2 keeps the walkdown playable within the home range and preserves every interval', () => {
    const riff = riffById('demo-riff-walkdown');
    const { riff: out, unplayable, moved } = transposeRiff(riff, 2);
    expect(unplayable).toBe(0);
    expect(moved).toBe(riff.notes.length);
    expect(out.tuning).toEqual(riff.tuning);
    expect(pitches(out)).toEqual(pitches(riff).map((p) => p + 2));
    expect(out.notes.every((n) => n.fret <= 12 && n.string >= 3)).toBe(true);
    expect(out.notes.map((n) => n.id)).toEqual(riff.notes.map((n) => n.id));
    expect(validateRiff(out).ok).toBe(true);
    // From the open C2 at 6:2 the Eb2 + Bb2 chug costs least as open 5:0 plus 4:2 (DECISIONS 45).
    const by = new Map(out.notes.map((n) => [n.id, n]));
    expect([by.get('wd-n02'), by.get('wd-n03')].map((n) => [n!.string, n!.fret])).toEqual([
      [5, 0],
      [4, 2],
    ]);
    expect(transposeRiff(riff, 0).riff).toBe(riff);
  });

  it('flags what no fingering can reach instead of dropping it', () => {
    const riff = riffById('demo-riff-walkdown');
    const { riff: out, unplayable } = transposeRiff(riff, -12);
    // Every pitch an octave down is below the open low string: all flagged, all kept.
    expect(unplayable).toBe(riff.notes.length);
    expect(out.notes).toHaveLength(riff.notes.length);
    expect(out.notes.every((n) => n.unplayable)).toBe(true);
    // Up two octaves plus a step: the home range cannot hold it, the second pass can.
    const high = transposeRiff(riff, 26);
    expect(high.unplayable).toBe(0);
    expect(high.riff.notes.some((n) => n.fret > 12 || n.string < 3)).toBe(true);
  });
});

describe('retuneRiff', () => {
  const dropAb = presetByName('Drop Ab')!;

  it('keepPitches to Drop Ab refingers only the low string, two frets up', () => {
    const riff = riffById('demo-riff-walkdown');
    const { riff: out, unplayable, moved } = retuneRiff(riff, dropAb, 'keepPitches');
    expect(unplayable).toBe(0);
    expect(out.tuning).toEqual({ name: 'Drop Ab', pitches: [32, 39, 44, 49, 53, 58] });
    expect(pitches(out)).toEqual(pitches(riff));
    const lowBefore = riff.notes.filter((n) => n.string === 6);
    expect(moved).toBe(lowBefore.length);
    for (const before of lowBefore) {
      const after = out.notes.find((n) => n.id === before.id)!;
      expect([after.string, after.fret]).toEqual([6, before.fret + 2]);
    }
    expect(validateRiff(out).ok).toBe(true);
  });

  it('keepShapes changes pitches on string 6 only and clears stale flags', () => {
    const riff = riffById('demo-riff-walkdown');
    const flagged: Riff = {
      ...riff,
      notes: riff.notes.map((n, i) => (i === 0 ? { ...n, unplayable: true } : n)),
    };
    const { riff: out, unplayable, moved } = retuneRiff(flagged, dropAb, 'keepShapes');
    expect(unplayable).toBe(0);
    expect(moved).toBe(0);
    expect(out.notes[0]!.unplayable).toBeUndefined();
    out.notes.forEach((after, i) => {
      const before = riff.notes[i]!;
      expect([after.string, after.fret]).toEqual([before.string, before.fret]);
      const delta =
        pitchOf(out.tuning, after.string, after.fret) -
        pitchOf(riff.tuning, before.string, before.fret);
      expect(delta).toBe(before.string === 6 ? -2 : 0);
    });
  });

  it('keepShapes to a tuning with fewer strings flags the notes that lose their string', () => {
    const seven: Tuning = { name: 'B Standard 7', pitches: [35, 40, 45, 50, 55, 59, 64] };
    const riff: Riff = {
      ...riffById('demo-riff-tritone'),
      tuning: seven,
      notes: riffById('demo-riff-tritone').notes.map((n, i) => (i === 0 ? { ...n, string: 7 } : n)),
    };
    const { unplayable, riff: out } = retuneRiff(riff, presetByName('E Standard')!, 'keepShapes');
    expect(unplayable).toBe(1);
    expect(out.notes[0]!.unplayable).toBe(true);
  });
});

describe('fixture cases', () => {
  it('match music-conventions.json', () => {
    for (const c of fixture.transpose) {
      const riff = riffById(c.riff);
      const result =
        c.op === 'transpose'
          ? transposeRiff(riff, c.semitones!)
          : retuneRiff(riff, presetByName(c.tuning!)!, c.mode as 'keepShapes' | 'keepPitches');
      expect(result.unplayable, c.why).toBe(c.expectedUnplayable);
      for (const [id, [string, fret]] of Object.entries(c.expectedPositions)) {
        const note = result.riff.notes.find((n) => n.id === id)!;
        expect([note.string, note.fret], `${c.why}: ${id}`).toEqual([string, fret]);
      }
    }
  });
});

describe('simultaneousGroups', () => {
  it('groups chord members and keeps solo notes apart, in time order', () => {
    const notes: Note[] = [
      { id: 'b', string: 5, fret: 5, start: 480, duration: 10, chordId: 'c' },
      { id: 'a', string: 6, fret: 3, start: 480, duration: 10, chordId: 'c' },
      { id: 's', string: 6, fret: 0, start: 0, duration: 10 },
      { id: 't', string: 5, fret: 0, start: 0, duration: 10 },
    ];
    expect(simultaneousGroups(notes).map((g) => g.map((n) => n.id))).toEqual([
      ['s'],
      ['t'],
      ['b', 'a'],
    ]);
    const riff = riffById('demo-riff-walkdown');
    const same = refingerRiff(riff, riff.tuning, (n) => pitchOf(riff.tuning, n.string, n.fret));
    expect(same.moved).toBe(0);
  });
});
