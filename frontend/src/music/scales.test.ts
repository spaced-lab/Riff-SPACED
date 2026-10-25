import { describe, expect, it } from 'vitest';
import {
  COLOR_GROUPS,
  SCALES,
  degreeClass,
  degreesOf,
  groupOf,
  scaleById,
  scaleTitle,
} from './scales';

describe('scales', () => {
  it('lists the eight scales with the blues scale right after the minor pentatonic', () => {
    expect(SCALES.map((s) => s.id)).toEqual([
      'minorPentatonic',
      'blues',
      'majorPentatonic',
      'major',
      'naturalMinor',
      'dorian',
      'mixolydian',
      'harmonicMinor',
    ]);
  });

  it('every scale has distinct, ascending intervals starting at the root', () => {
    for (const scale of SCALES) {
      const semis = scale.degrees.map((d) => d.semitones);
      expect(semis[0]).toBe(0);
      expect([...semis].sort((a, b) => a - b)).toEqual(semis);
      expect(new Set(semis).size).toBe(semis.length);
    }
  });

  it('blues is the minor pentatonic plus the b5 blue note', () => {
    const penta = scaleById('minorPentatonic').degrees.map((d) => d.semitones);
    const blues = scaleById('blues').degrees;
    expect(blues.map((d) => d.semitones)).toEqual([...penta, 6].sort((a, b) => a - b));
    const blue = blues.find((d) => d.semitones === 6)!;
    expect(blue.role).toBe('blue');
    expect(blue.label).toBe('b5');
    expect(groupOf(blue.role)).toBe('blue');
  });

  it('C major lands on the white keys with the right labels', () => {
    const table = degreesOf(scaleById('major'), 0);
    const inScale = table.map((d) => d !== null);
    // C D E F G A B: pitch classes 0 2 4 5 7 9 11.
    expect(inScale).toEqual([
      true,
      false,
      true,
      false,
      true,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
    ]);
    expect(table.map((d) => d?.label ?? '.').join(' ')).toBe('R . 2 . 3 4 . 5 . 6 . 7');
  });

  it('A minor pentatonic wraps around the octave and names flat degrees', () => {
    const table = degreesOf(scaleById('minorPentatonic'), 9);
    // A C D E G: 9 0 2 4 7.
    expect(table[9]?.label).toBe('R');
    expect(table[0]?.label).toBe('b3');
    expect(table[2]?.label).toBe('4');
    expect(table[4]?.label).toBe('5');
    expect(table[7]?.label).toBe('b7');
    expect(table[7]?.flat).toBe(true);
    expect(table[1]).toBeNull();
  });

  it('harmonic minor has a flat sixth and a natural seventh, told apart by class', () => {
    const degrees = scaleById('harmonicMinor').degrees;
    const classes = degrees.map(degreeClass);
    expect(classes).toEqual([
      'root',
      'second',
      'third-flat',
      'fourth',
      'fifth',
      'sixth-flat',
      'seventh',
    ]);
    expect(scaleById('dorian').degrees.map(degreeClass)).toContain('sixth');
    expect(scaleById('mixolydian').degrees.map(degreeClass)).toContain('seventh-flat');
  });

  it('maps every role to one of the six color groups', () => {
    const roles = new Set(SCALES.flatMap((s) => s.degrees.map((d) => d.role)));
    for (const role of roles) expect(COLOR_GROUPS).toContain(groupOf(role));
    expect(groupOf('second')).toBe('others');
    expect(groupOf('sixth')).toBe('others');
  });

  it('titles the scale with the root spelled by the accidentals setting', () => {
    expect(scaleTitle(scaleById('blues'), 10, 'flats')).toBe('Bb Blues');
    expect(scaleTitle(scaleById('blues'), 10, 'sharps')).toBe('A# Blues');
  });
});
