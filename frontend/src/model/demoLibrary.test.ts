import { describe, expect, it } from 'vitest';
import demo from '@shared/fixtures/demo-library.json';
import { describeDyad } from '@/music/dyad';
import { FLAT_NAMES, nameOf } from '@/music/naming';
import { pitchOf } from '@/music/tuning';
import type { Note, Riff } from './types';
import { validateLibrary } from './validate';

/**
 * The demo library is both the first-run content and a worked example of the music model:
 * every assertion here is something docs/MUSIC_MODEL.md explains.
 */
describe('demo library fixture', () => {
  const result = validateLibrary(demo);
  const riffs = result.ok ? result.value.riffs : [];
  const walkdown = riffs.find((r) => r.name === 'Walkdown Turnaround');
  const tritone = riffs.find((r) => r.name === 'Tritone Chug');

  it('validates as a library bundle with two riffs, one arrangement, one song', () => {
    expect(result.ok ? 'ok' : result.errors.join('\n')).toBe('ok');
    if (!result.ok) return;
    expect(result.value.riffs).toHaveLength(2);
    expect(result.value.arrangements[0]?.entries.map((e) => e.riffId)).toEqual([
      'demo-riff-walkdown',
      'demo-riff-tritone',
    ]);
    expect(result.value.songs[0]?.parts[0]?.arrangementId).toBe('demo-arr-verse');
  });

  it('keeps every note on the lowest four strings within frets 0..12', () => {
    for (const riff of riffs) {
      for (const n of riff.notes) {
        expect(n.string, `${riff.name} ${n.id}`).toBeGreaterThanOrEqual(3);
        expect(n.fret, `${riff.name} ${n.id}`).toBeLessThanOrEqual(12);
      }
    }
  });

  const chordPitches = (riff: Riff, chordId: string) =>
    riff.notes
      .filter((n) => n.chordId === chordId)
      .map((n) => pitchOf(riff.tuning, n.string, n.fret));

  it('labels the walkdown chords: P5 root Db on the chugs, inverted P4 root Db on the and of 4', () => {
    expect(walkdown).toBeDefined();
    const [a, b] = chordPitches(walkdown!, 'wd-c01');
    const p5 = describeDyad(a!, b!);
    expect(p5.interval).toBe('P5');
    expect(FLAT_NAMES[p5.rootPitchClass]).toBe('Db');
    expect(p5.lowerIsRoot).toBe(true);

    const [c, d] = chordPitches(walkdown!, 'wd-c07');
    const p4 = describeDyad(c!, d!);
    expect(p4.interval).toBe('P4');
    expect(p4.lowerIsRoot).toBe(false);
    expect(FLAT_NAMES[p4.rootPitchClass]).toBe('Db');
  });

  it('has the signature bar 4: Ab2 held while the low string walks Eb D Db C to the open Bb1', () => {
    const bar4 = walkdown!.notes.filter((n) => n.start >= 3 * 1920);
    const held = bar4.find((n) => n.string === 5);
    expect(held).toMatchObject({ fret: 5, duration: 1920, techniques: ['letRing'] });
    expect(nameOf(pitchOf(walkdown!.tuning, 5, 5))).toBe('Ab2');
    const walk = bar4
      .filter((n: Note) => n.string === 6)
      .sort((x, y) => x.start - y.start)
      .map((n) => n.fret);
    expect(walk).toEqual([5, 5, 4, 4, 3, 3, 2, 2]);
    const names = [...new Set(walk)].map((f) =>
      nameOf(pitchOf(walkdown!.tuning, 6, f), 'flats', false),
    );
    expect(names).toEqual(['Eb', 'D', 'Db', 'C']);
    expect(walkdown!.notes[0]).toMatchObject({ string: 6, fret: 0, start: 0 });
    expect(nameOf(34)).toBe('Bb1');
  });

  it('puts an unresolved tritone on beat 3 of bars 2 and 4 of the chug riff', () => {
    const chords = [...new Set(tritone!.notes.map((n) => n.chordId).filter(Boolean))] as string[];
    expect(chords).toHaveLength(2);
    for (const id of chords) {
      const [a, b] = chordPitches(tritone!, id);
      expect(describeDyad(a!, b!).interval).toBe('TT');
      const start = tritone!.notes.find((n) => n.chordId === id)!.start;
      expect([1920 + 960, 3 * 1920 + 960]).toContain(start);
    }
  });
});
