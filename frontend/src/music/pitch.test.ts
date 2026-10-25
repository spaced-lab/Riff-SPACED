import { describe, expect, it } from 'vitest';
import { fixture } from './fixture';
import { freqOf, octaveOf, pitchClass } from './pitch';

describe('pitch', () => {
  it.each(fixture.frequencies)('freqOf($midi) is $hz Hz', ({ midi, hz }) => {
    expect(freqOf(midi)).toBeCloseTo(hz, 4);
  });

  it.each(fixture.pitchNames)(
    'pitch class and octave of $midi',
    ({ midi, pitchClass: pc, octave }) => {
      expect(pitchClass(midi)).toBe(pc);
      expect(octaveOf(midi)).toBe(octave);
    },
  );

  it('pitch class of a negative number stays in 0..11', () => {
    expect(pitchClass(-1)).toBe(11);
  });
});
