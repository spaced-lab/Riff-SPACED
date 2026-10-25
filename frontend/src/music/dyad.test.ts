import { describe, expect, it } from 'vitest';
import { FLAT_NAMES } from './naming';
import { describeDyad, INTERVAL_MEANING } from './dyad';
import { fixture } from './fixture';

describe('describeDyad', () => {
  it.each(fixture.dyads)('($a, $b) is $interval root $rootName', (c) => {
    const d = describeDyad(c.a, c.b);
    expect(d.interval).toBe(c.interval);
    expect(d.semitones).toBe(c.semitones);
    expect(d.lowerIsRoot).toBe(c.lowerIsRoot);
    expect(d.rootPitchClass).toBe(c.rootPitchClass);
    expect(FLAT_NAMES[d.rootPitchClass]).toBe(c.rootName);
  });

  it('is symmetric in argument order', () => {
    expect(describeDyad(37, 44)).toEqual(describeDyad(44, 37));
  });

  it('has a meaning for every label', () => {
    expect(INTERVAL_MEANING.P5).toBe('power chord');
    expect(INTERVAL_MEANING.P4).toContain('inverted');
  });
});
