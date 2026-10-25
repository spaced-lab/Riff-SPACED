import { describe, expect, it } from 'vitest';
import { fixture } from './fixture';
import { FLAT_NAMES, nameOf, SHARP_NAMES } from './naming';

describe('naming', () => {
  it.each(fixture.pitchNames)('names $midi as $flat / $sharp', ({ midi, flat, sharp }) => {
    expect(nameOf(midi, 'flats', true)).toBe(flat);
    expect(nameOf(midi, 'sharps', true)).toBe(sharp);
    expect(nameOf(midi, 'flats', false)).toBe(flat.replace(/-?\d+$/, ''));
  });

  it('defaults to flats with octave', () => {
    expect(nameOf(34)).toBe('Bb1');
    expect(FLAT_NAMES).toHaveLength(12);
    expect(SHARP_NAMES).toHaveLength(12);
  });
});
