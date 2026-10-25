import { describe, expect, it } from 'vitest';
import { fixture } from './fixture';
import {
  ALL_PRESETS,
  DEFAULT_TUNING,
  DROP_PRESETS,
  dropOf,
  isValidTuning,
  pitchOf,
  presetByName,
  retuneString,
  SEVEN_STRING_PRESETS,
  STANDARD_PRESETS,
} from './tuning';

describe('tuning presets', () => {
  it.each(fixture.tunings.standard)('$name is a standard preset', ({ name, pitches }) => {
    expect(STANDARD_PRESETS.find((t) => t.name === name)?.pitches).toEqual(pitches);
  });

  it.each(fixture.tunings.drop)('$name is generated from $from', ({ name, from, pitches }) => {
    const standard = presetByName(from);
    expect(standard).toBeDefined();
    expect(dropOf(standard!)).toEqual({ name, pitches });
    expect(DROP_PRESETS.find((t) => t.name === name)?.pitches).toEqual(pitches);
  });

  it.each(fixture.tunings.sevenString)('$name has seven strings', ({ name, pitches }) => {
    expect(SEVEN_STRING_PRESETS.find((t) => t.name === name)?.pitches).toEqual(pitches);
  });

  it('defaults to Bb Standard and every preset is valid and unique', () => {
    expect(DEFAULT_TUNING.name).toBe(fixture.tunings.default);
    expect(ALL_PRESETS.every(isValidTuning)).toBe(true);
    expect(new Set(ALL_PRESETS.map((t) => t.name)).size).toBe(ALL_PRESETS.length);
  });
});

describe('pitchOf', () => {
  it.each(fixture.pitchOf)('$tuning string $string fret $fret is $midi', (c) => {
    expect(pitchOf(presetByName(c.tuning)!, c.string, c.fret)).toBe(c.midi);
  });

  it('rejects strings out of range and negative frets', () => {
    expect(() => pitchOf(DEFAULT_TUNING, 0, 0)).toThrow(RangeError);
    expect(() => pitchOf(DEFAULT_TUNING, 7, 0)).toThrow(RangeError);
    expect(() => pitchOf(DEFAULT_TUNING, 6, -1)).toThrow(RangeError);
    expect(() => pitchOf(DEFAULT_TUNING, 6, 1.5)).toThrow(RangeError);
  });
});

describe('isValidTuning', () => {
  it.each(fixture.tunings.validity)('$pitches valid=$valid ($why)', ({ pitches, valid }) => {
    expect(isValidTuning({ pitches })).toBe(valid);
  });
});

describe('retuneString', () => {
  it('moves one string and renames the tuning Custom', () => {
    const dropped = retuneString(DEFAULT_TUNING, 6, -2);
    expect(dropped).toEqual({ name: 'Custom', pitches: [32, 39, 44, 49, 53, 58] });
    expect(DEFAULT_TUNING.pitches[0]).toBe(34);
  });
});
