import { describe, expect, it } from 'vitest';
import { clampRange, rangeCenteredOn } from './viewSlice';

describe('rangeCenteredOn', () => {
  it('slides a 0-12 window so the position sits in the middle', () => {
    expect(rangeCenteredOn({ from: 0, to: 12 }, 14, 17)).toEqual({ from: 10, to: 22 });
    expect(rangeCenteredOn({ from: 5, to: 17 }, 7, 10)).toEqual({ from: 3, to: 15 });
  });

  it('never goes below the nut or past fret 24, and keeps the width', () => {
    expect(rangeCenteredOn({ from: 0, to: 12 }, 0, 3)).toEqual({ from: 0, to: 12 });
    expect(rangeCenteredOn({ from: 0, to: 12 }, 20, 24)).toEqual({ from: 12, to: 24 });
    expect(rangeCenteredOn({ from: 0, to: 5 }, 22, 24)).toEqual({ from: 19, to: 24 });
    // The whole neck has nowhere to slide.
    expect(rangeCenteredOn({ from: 0, to: 24 }, 14, 17)).toEqual({ from: 0, to: 24 });
  });

  it('clampRange keeps ranges inside 0..24 and at least one fret wide', () => {
    expect(clampRange({ from: -3, to: 40 })).toEqual({ from: 0, to: 24 });
    expect(clampRange({ from: 7, to: 7 })).toEqual({ from: 7, to: 8 });
  });
});
