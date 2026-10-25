import { describe, expect, it } from 'vitest';
import demo from '../../../shared/fixtures/demo-library.json';
import { newNote, newRiff } from '@/model/factories';
import type { LibraryBundle } from '@/model/types';
import {
  candidateTunings,
  findEasierTunings,
  fingeringEffort,
  scoreCandidate,
} from './tuningSearch';
import { presetByName } from './tuning';

const library = demo as unknown as LibraryBundle;
const walkdown = library.riffs[0]!;

describe('candidateTunings', () => {
  it('lists the current tuning first, every same-size preset, and one-string adjustments', () => {
    const list = candidateTunings(presetByName('E Standard')!);
    expect(list[0]!.name).toBe('E Standard');
    const names = list.map((t) => t.name);
    expect(names).toContain('Drop D');
    expect(names).toContain('Bb Standard');
    expect(names).not.toContain('B Standard 7');
    expect(names).toContain('E Standard, string 1 +2');
    // String 6 down two from E Standard is Drop D, already present as the preset.
    expect(names.filter((n) => n === 'Drop D')).toHaveLength(1);
    expect(names).not.toContain('E Standard, string 6 -2');
    expect(new Set(list.map((t) => t.pitches.join())).size).toBe(list.length);
  });
});

describe('findEasierTunings', () => {
  it('ranks Drop D first for E Standard power chords that stretch two frets', () => {
    // E2+B2 and F2+C3: a two-fret reach on strings 6 and 5 in E Standard, same-fret shapes
    // once the low string drops to D. Drop D is also the smallest change (one string).
    const eStandard = presetByName('E Standard')!;
    const riff = newRiff(eStandard, {
      notes: [
        newNote({ string: 6, fret: 0, start: 0, duration: 480, chordId: 'c1' }),
        newNote({ string: 5, fret: 2, start: 0, duration: 480, chordId: 'c1' }),
        newNote({ string: 6, fret: 1, start: 480, duration: 480, chordId: 'c2' }),
        newNote({ string: 5, fret: 3, start: 480, duration: 480, chordId: 'c2' }),
      ],
    });
    const ranked = findEasierTunings(riff, 5);
    expect(ranked[0]!.tuning.name).toBe('Drop D');
    expect(ranked[0]!.unplayable).toBe(0);
    expect(ranked[0]!.totalSpan).toBe(0);
    expect(ranked[0]!.distance).toBe(2);
    const current = ranked.find((c) => c.current)!;
    expect(current.tuning.name).toBe('E Standard');
    expect(current.totalSpan).toBe(2);
    expect(current.score).toBeGreaterThan(ranked[0]!.score);
    // A tuning that cannot sound E2 or F2 at all pays two per flagged note (both chords).
    const fSharp = scoreCandidate(
      riff,
      { name: 'F# Standard', pitches: [42, 47, 52, 57, 61, 66] },
      false,
    );
    expect(fSharp.unplayable).toBe(4);
    expect(fSharp.score).toBeGreaterThan(current.score);
  });

  it('always includes the current tuning and scores the walkdown easier in Drop Ab', () => {
    const ranked = findEasierTunings(walkdown, 3);
    expect(ranked.some((c) => c.current)).toBe(true);
    const current = ranked.find((c) => c.current)!;
    const dropAb = ranked.find((c) => c.tuning.name === 'Drop Ab');
    expect(dropAb).toBeDefined();
    // Same-fret power chords: no span at all, so Drop Ab beats Bb Standard on the walkdown.
    expect(dropAb!.totalSpan).toBeLessThan(current.totalSpan);
    expect(dropAb!.score).toBeLessThan(current.score);
    expect(dropAb!.unplayable).toBe(0);
    expect(ranked.map((c) => c.score)).toEqual(
      [...ranked.map((c) => c.score)].sort((a, b) => a - b).slice(0, ranked.length),
    );
  });

  it('fingeringEffort skips unplayable groups and sums spans and moves', () => {
    // Twenty two-fret chugs and nothing else with a span; the hand moves 2 frets to each
    // inverted fourth and back, plus the walk down to the open string.
    expect(fingeringEffort(walkdown)).toEqual({ totalSpan: 40, handMovement: 16 });
    const flagged = { ...walkdown, notes: walkdown.notes.map((n) => ({ ...n, unplayable: true })) };
    expect(fingeringEffort(flagged)).toEqual({ totalSpan: 0, handMovement: 0 });
  });
});
