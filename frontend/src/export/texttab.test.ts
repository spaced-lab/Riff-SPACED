import { describe, expect, it } from 'vitest';
import demo from '@shared/fixtures/demo-library.json';
import tritoneGolden from '@shared/fixtures/golden/tritone.tab.txt?raw';
import walkdownGolden from '@shared/fixtures/golden/walkdown.tab.txt?raw';
import { newNote, newRiff } from '@/model/factories';
import type { LibraryBundle } from '@/model/types';
import { riffToTextTab } from './texttab';

const lib = demo as unknown as LibraryBundle;

describe('text tab export', () => {
  it('matches the hand-written golden for the walkdown turnaround', () => {
    expect(riffToTextTab(lib.riffs[0]!)).toBe(walkdownGolden);
  });

  it('matches the hand-written golden for the tritone chug', () => {
    expect(riffToTextTab(lib.riffs[1]!)).toBe(tritoneGolden);
  });

  it('right-aligns two-digit frets, spilling right when the left column is taken', () => {
    const riff = newRiff();
    riff.name = 'Wide';
    riff.notes = [
      newNote({ string: 6, fret: 12, start: 240, duration: 120 }),
      newNote({ string: 5, fret: 7, start: 0, duration: 120 }),
      newNote({ string: 5, fret: 10, start: 120, duration: 120 }),
    ];
    const lines = riffToTextTab(riff).split('\n');
    expect(lines[8]).toBe(
      'Bb|-12-------------|----------------|----------------|----------------|',
    );
    expect(lines[7]).toBe(
      'Eb|710-------------|----------------|----------------|----------------|',
    );
  });

  it('breaks an 8-bar riff into two systems and honors sharps', () => {
    const riff = { ...newRiff(), lengthBars: 8, namingPrefs: { accidentals: 'sharps' as const } };
    riff.sections = [{ ...riff.sections[0]!, lengthBars: 8 }];
    const text = riffToTextTab(riff);
    expect(text).toContain('Bb Standard (A#1 D#2 G#2 C#3 F3 A#3), 92 bpm, 8 bars');
    expect(text.split('\n\n')).toHaveLength(3);
    expect(text.split('\n').filter((l) => l.startsWith('A#|'))).toHaveLength(4);
  });
});
