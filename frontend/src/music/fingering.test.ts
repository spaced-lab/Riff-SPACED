import { describe, expect, it } from 'vitest';
import { fixture } from './fixture';
import { bestFingering, findFingerings, handSpan } from './fingering';
import type { Position } from './fingering';
import { presetByName } from './tuning';

const toPositions = (pairs: readonly (readonly number[])[]): Position[] =>
  pairs.map(([string, fret]) => ({ string: string!, fret: fret! }));
const toPairs = (positions: readonly Position[] | null) =>
  positions ? positions.map((p) => [p.string, p.fret]) : null;

describe('findFingerings', () => {
  it.each(fixture.fingerings.find)('pitch $pitch on strings $strings frets $frets', (c) => {
    const result = findFingerings(c.pitch, presetByName(c.tuning)!, {
      fretRange: [c.frets[0]!, c.frets[1]!],
      allowedStrings: c.strings,
    });
    expect(toPairs(result)).toEqual(c.expected);
  });

  it('defaults to the lowest four strings and frets 0..12', () => {
    // Db3 (49) sits at 6:15 (out of range), 5:10, 4:5, 3:0; string 2 and 1 are not allowed.
    expect(toPairs(findFingerings(49, presetByName('Bb Standard')!))).toEqual([
      [5, 10],
      [4, 5],
      [3, 0],
    ]);
  });
});

describe('handSpan', () => {
  it.each(fixture.fingerings.handSpan)('$positions spans $span', (c) => {
    expect(handSpan(toPositions(c.positions))).toBe(c.span);
  });
});

describe('bestFingering', () => {
  it.each(fixture.fingerings.best)('$pitches -> $expected ($why)', (c) => {
    const previous = 'previous' in c && c.previous ? toPositions(c.previous) : undefined;
    const options = 'strings' in c && c.strings ? { allowedStrings: c.strings } : {};
    const result = bestFingering(c.pitches, presetByName(c.tuning)!, previous, options);
    expect(toPairs(result)).toEqual(c.expected);
  });

  it('rejects groups whose only shapes exceed the span limit', () => {
    // Db2 (37) is only at 6:3; C3 (48) is at 5:9 or 4:4 or 3:-1. 6:3 + 4:4 spans 1: fine.
    // Force a wide one: 37 and 47 (B2): 5:8 (span 5) or 4:3 (span 0) -> picks 4:3.
    const bb = presetByName('Bb Standard')!;
    expect(toPairs(bestFingering([37, 47], bb))).toEqual([
      [6, 3],
      [4, 3],
    ]);
    // Restrict to strings 6 and 5 and the only shape spans 5: unplayable.
    expect(bestFingering([37, 47], bb, undefined, { allowedStrings: [6, 5] })).toBeNull();
  });

  it('returns an empty list for no pitches and null for unreachable pitches', () => {
    const bb = presetByName('Bb Standard')!;
    expect(bestFingering([], bb)).toEqual([]);
    expect(bestFingering([20], bb)).toBeNull();
  });
});
