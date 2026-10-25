import { describe, expect, it } from 'vitest';
import { cellKey, hasStandardIntervals, positionsOf, skeletonOf } from './positions';
import { degreesOf, scaleById } from './scales';
import { pitchClass } from './pitch';
import { pitchOf, presetByName } from './tuning';
import type { Tuning } from './tuning';

const E_STANDARD = presetByName('E Standard')!;
const A = 9;

/** The frets a position uses on one string, ascending. */
function fretsOn(cells: ReadonlySet<string>, string: number): number[] {
  return [...cells]
    .map((c) => c.split(':').map(Number) as [number, number])
    .filter(([s]) => s === string)
    .map(([, f]) => f)
    .sort((a, b) => a - b);
}

describe('positionsOf', () => {
  it('reproduces the five classic A minor pentatonic boxes in E Standard', () => {
    const positions = positionsOf(scaleById('minorPentatonic'), A, E_STANDARD, 24);
    // Box 1 of A minor pentatonic: frets 5-8, root under the first finger: the E shape.
    const box1 = positions.find((p) => p.fromFret === 5)!;
    expect(box1.name).toBe('E shape');
    expect(box1.toFret).toBe(8);
    expect([6, 5, 4, 3, 2, 1].map((s) => fretsOn(box1.cells, s))).toEqual([
      [5, 8],
      [5, 7],
      [5, 7],
      [5, 7],
      [5, 8],
      [5, 8],
    ]);
    // Box 2: frets 7-10, with the A string and D string reaching back to fret 7.
    const box2 = positions[box1.index + 1]!;
    expect(box2.name).toBe('D shape');
    expect([6, 5, 4, 3, 2, 1].map((s) => fretsOn(box2.cells, s))).toEqual([
      [8, 10],
      [7, 10],
      [7, 10],
      [7, 9],
      [8, 10],
      [8, 10],
    ]);
    // Box 3 duplicates the E (string 4 fret 12, string 3 fret 9), as the classic shape does.
    const box3 = positions[box1.index + 2]!;
    expect(box3.name).toBe('C shape');
    expect(fretsOn(box3.cells, 3)).toEqual([9, 12]);
    expect(fretsOn(box3.cells, 4)).toEqual([10, 12]);
    expect(positions[box1.index + 3]!.name).toBe('A shape');
    expect(positions[box1.index + 4]!.name).toBe('G shape');
    expect(positions[box1.index + 5]!.name).toBe('E shape');
    expect(positions[box1.index + 5]!.fromFret).toBe(17);
    // Below box 1 sits the open G shape (frets 0-3) and the A shape at 2-5.
    expect(positions[0]!.name).toBe('A shape');
    expect(positions[0]!.fromFret).toBe(0);
  });

  it('covers every scale note on the neck across all positions', () => {
    for (const id of ['minorPentatonic', 'blues', 'major', 'harmonicMinor'] as const) {
      const scale = scaleById(id);
      const positions = positionsOf(scale, 3, presetByName('Bb Standard')!, 22);
      const table = degreesOf(scale, 3);
      const union = new Set(positions.flatMap((p) => [...p.cells]));
      for (let s = 1; s <= 6; s++) {
        // Skip the top two frets: the last box may not reach them.
        for (let f = 0; f <= 18; f++) {
          if (table[pitchClass(pitchOf(presetByName('Bb Standard')!, s, f))]) {
            expect(union.has(cellKey(s, f)), `${id} ${s}:${f}`).toBe(true);
          }
        }
      }
      // Each cell in a position really is a scale note.
      for (const p of positions)
        for (const c of p.cells) {
          const [s, f] = c.split(':').map(Number) as [number, number];
          expect(table[pitchClass(pitchOf(presetByName('Bb Standard')!, s, f))]).not.toBeNull();
        }
    }
  });

  it('gives the C major E shape at frets 7-10 with three notes on most strings', () => {
    const positions = positionsOf(scaleById('major'), 0, E_STANDARD, 24);
    const e = positions.find((p) => p.name === 'E shape' && p.fromFret >= 5)!;
    expect([e.fromFret, e.toFret]).toEqual([7, 10]);
    expect([6, 5, 4, 3, 2, 1].map((s) => fretsOn(e.cells, s))).toEqual([
      [7, 8, 10],
      [7, 8, 10],
      [7, 9, 10],
      [7, 9, 10],
      [8, 10],
      [7, 8, 10],
    ]);
    // The G shape sits just below it, 5-8.
    expect(positions[e.index - 1]!.name).toBe('G shape');
    expect(positions[e.index - 1]!.fromFret).toBe(5);
  });

  it('adds the blue note inside the box: A blues box 1 gets string 5 fret 6 and string 3 fret 8', () => {
    const positions = positionsOf(scaleById('blues'), A, E_STANDARD, 24);
    const box1 = positions.find((p) => p.fromFret === 5)!;
    expect(fretsOn(box1.cells, 5)).toEqual([5, 6, 7]);
    expect(fretsOn(box1.cells, 3)).toEqual([5, 7, 8]);
    expect(fretsOn(box1.cells, 6)).toEqual([5, 8]);
  });

  it('picks the skeleton by the third and numbers positions in other tunings', () => {
    expect(skeletonOf(scaleById('mixolydian'))).toEqual([0, 2, 4, 7, 9]);
    expect(skeletonOf(scaleById('dorian'))).toEqual([0, 3, 5, 7, 10]);
    expect(skeletonOf(scaleById('harmonicMinor'))).toEqual([0, 3, 5, 7, 10]);
    const dropD: Tuning = presetByName('Drop D')!;
    expect(hasStandardIntervals(E_STANDARD)).toBe(true);
    expect(hasStandardIntervals(presetByName('Bb Standard')!)).toBe(true);
    expect(hasStandardIntervals(dropD)).toBe(false);
    const positions = positionsOf(scaleById('minorPentatonic'), 2, dropD, 12);
    expect(positions.length).toBeGreaterThan(2);
    expect(positions.map((p) => p.name)).toEqual(positions.map((_, i) => `Position ${i + 1}`));
    expect(positions.every((p, i) => i === 0 || p.fromFret >= positions[i - 1]!.fromFret)).toBe(
      true,
    );
  });
});
