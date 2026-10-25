import { describe, expect, it } from 'vitest';
import { layout, PADDING, stringStroke } from './geometry';

describe('fretboard geometry', () => {
  const even = layout(1000, 200, { from: 0, to: 12 }, 6, false);

  it('spaces frets evenly across the neck width', () => {
    // The gutter is at least the padding and grows with the dots (Phase 9, full screen).
    expect(even.nutX).toBeGreaterThanOrEqual(PADDING.left);
    const neck = 1000 - PADDING.right - even.nutX;
    expect(even.fretX(0)).toBe(even.nutX);
    expect(even.fretX(12)).toBe(1000 - PADDING.right);
    expect(even.fretX(6)).toBeCloseTo(even.nutX + neck / 2);
    expect(even.fretWidth(1)).toBeCloseTo(neck / 12);
    expect(even.noteX(1)).toBeCloseTo(even.nutX + neck / 24);
  });

  it('puts the open-string dot left of the nut', () => {
    expect(even.noteX(0)).toBeLessThan(even.nutX);
    expect(even.noteX(0)).toBeCloseTo(even.nutX - even.dotRadius * 1.4);
  });

  it('puts string 1 on top and string 6 at the bottom with equal gaps', () => {
    const y1 = even.stringY(1);
    const y6 = even.stringY(6);
    expect(y1).toBeLessThan(y6);
    expect(y6 - y1).toBeCloseTo(even.stringGap * 5);
    expect(y1).toBeGreaterThan(PADDING.top);
    expect(y6).toBeLessThan(200 - PADDING.bottom);
  });

  it('lists markers within the range only, double at 12 and 24', () => {
    expect(even.markers.map((m) => m.fret)).toEqual([3, 5, 7, 9, 12]);
    expect(even.markers.find((m) => m.fret === 12)?.double).toBe(true);
    expect(even.markers.find((m) => m.fret === 3)?.double).toBe(false);
    const high = layout(1000, 200, { from: 5, to: 17 }, 6);
    expect(high.markers.map((m) => m.fret)).toEqual([7, 9, 12, 15, 17]);
    const full = layout(1000, 200, { from: 0, to: 24 }, 6);
    expect(full.markers.filter((m) => m.double).map((m) => m.fret)).toEqual([12, 24]);
  });

  it('realistic spacing narrows toward the bridge, stays monotonic, and fits the width', () => {
    const real = layout(1000, 200, { from: 0, to: 12 }, 6, true);
    expect(real.fretX(0)).toBe(real.nutX);
    expect(real.fretX(12)).toBeCloseTo(1000 - PADDING.right);
    for (let f = 2; f <= 12; f++) {
      expect(real.fretWidth(f)).toBeLessThan(real.fretWidth(f - 1));
      expect(real.fretWidth(f) / real.fretWidth(f - 1)).toBeCloseTo(2 ** (-1 / 12), 6);
    }
    expect(real.fretWidth(1)).toBeGreaterThan(even.fretWidth(1));
  });

  it('sizes dots from the string gap and the narrowest fret', () => {
    expect(even.dotRadius).toBeCloseTo(Math.min(even.stringGap * 0.42, even.fretWidth(1) * 0.38));
    const tiny = layout(60, 30, { from: 0, to: 24 }, 8);
    expect(tiny.dotRadius).toBe(3);
  });

  it('thickens strings toward the low side', () => {
    expect(stringStroke(1, 6)).toBeCloseTo(1.2);
    expect(stringStroke(6, 6)).toBeCloseTo(2.6);
    expect(stringStroke(4, 7)).toBeGreaterThan(stringStroke(3, 7));
  });

  it('widens the gutter on a tall board so the open dot and label stay inside', () => {
    const small = layout(1000, 200, { from: 0, to: 12 }, 6, false);
    const tall = layout(1246, 610, { from: 12, to: 24 }, 6, false);
    expect(tall.dotRadius).toBeGreaterThan(small.dotRadius * 1.5);
    expect(tall.nutX).toBeGreaterThan(small.nutX);
    // Open dot's left edge and the label's right edge are at or past x = 0.
    expect(tall.noteX(12) - tall.dotRadius).toBeGreaterThanOrEqual(0);
    expect(tall.nutX - tall.dotRadius * 3).toBeGreaterThanOrEqual(tall.labelSize * 1.3);
    expect(tall.labelSize).toBeGreaterThan(small.labelSize);
  });
});
