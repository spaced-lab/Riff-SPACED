import { afterEach, describe, expect, it } from 'vitest';
import { newArrangement, newLibrary, newNote, newRiff, newSong } from './factories';
import { sequentialIds, setIdGenerator } from './ids';
import { validateArrangement, validateLibrary, validateRiff, validateSong } from './validate';

describe('factories', () => {
  let restore = () => {};
  afterEach(() => restore());

  it('new documents validate and use the defaults', () => {
    restore = setIdGenerator(sequentialIds('t'));
    const riff = newRiff();
    expect(validateRiff(riff).ok).toBe(true);
    expect(riff.tuning.name).toBe('Bb Standard');
    expect(riff.lengthBars).toBe(4);
    expect(riff.tempo.bpm).toBe(92);
    expect(riff.sections[0]).toMatchObject({ startBar: 0, lengthBars: 4, kind: 'main' });
    expect(riff.id).toBe('t-1');
    expect(riff.sections[0]?.id).toBe('t-2');
    expect(validateArrangement(newArrangement()).ok).toBe(true);
    expect(validateSong(newSong()).ok).toBe(true);
    expect(validateLibrary(newLibrary()).ok).toBe(true);
  });

  it('newRiff honors lengthBars by sizing the main section', () => {
    const riff = newRiff(undefined, { lengthBars: 8 });
    expect(riff.sections[0]?.lengthBars).toBe(8);
  });

  it('newNote fills velocity and drops empty techniques', () => {
    const note = newNote({ string: 6, fret: 3, start: 0, duration: 240 });
    expect(note.velocity).toBe(100);
    expect(note.techniques).toBeUndefined();
    expect(
      newNote({ string: 6, fret: 3, start: 0, duration: 240, techniques: ['palmMute'] }).techniques,
    ).toEqual(['palmMute']);
  });
});
