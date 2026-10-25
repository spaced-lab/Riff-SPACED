/**
 * Fretboard layout: pure functions from a pixel box to fret and string coordinates.
 * No React, no DOM. The component only draws what this returns, which keeps the
 * component thin and lets the layout be unit tested with plain numbers.
 */
import type { FretRange } from '@/store/viewSlice';

/** A real neck: each fret is 1 / 2^(1/12) = 0.944 of the previous one. */
export const REALISTIC_RATIO = 2 ** (-1 / 12);

export const PADDING = { top: 26, bottom: 10, left: 40, right: 14 } as const;

/** Position markers as on most necks: single dots, double at the octaves. */
export const SINGLE_MARKERS = [3, 5, 7, 9, 15, 17, 19, 21] as const;
export const DOUBLE_MARKERS = [12, 24] as const;

export type Marker = { fret: number; x: number; double: boolean };

export type Layout = {
  width: number;
  height: number;
  range: FretRange;
  stringCount: number;
  /** x of the leftmost wire: the nut when range.from is 0. */
  nutX: number;
  rightX: number;
  stringGap: number;
  dotRadius: number;
  /** x of fret wire `fret`, for range.from <= fret <= range.to. */
  fretX: (fret: number) => number;
  /** Width of the space ending at wire `fret` (fret > range.from). */
  fretWidth: (fret: number) => number;
  /** x where a note dot at `fret` sits: between wires, or left of the nut for the open string. */
  noteX: (fret: number) => number;
  /** y of a string line; string 1 (highest pitch) on top, string N at the bottom. */
  stringY: (string: number) => number;
  /** Vertical center of the cell for (string, fret): same as stringY. */
  markers: Marker[];
};

/** Distance along a real neck from the nut to wire `fret`, in units of scale length. */
function realDistance(fret: number): number {
  return 1 - REALISTIC_RATIO ** fret;
}

export function layout(
  width: number,
  height: number,
  range: FretRange,
  stringCount: number,
  realistic = false,
): Layout {
  const nutX = PADDING.left;
  const rightX = Math.max(nutX + 1, width - PADDING.right);
  const neckWidth = rightX - nutX;
  const fretCount = Math.max(1, range.to - range.from);

  // Even spacing by default so riffs read evenly; realistic spacing is normalized so
  // the requested range still fills the available width exactly.
  const d0 = realDistance(range.from);
  const dSpan = realDistance(range.to) - d0;
  const fretX = (fret: number): number => {
    const f = Math.min(range.to, Math.max(range.from, fret));
    if (!realistic) return nutX + ((f - range.from) / fretCount) * neckWidth;
    return nutX + ((realDistance(f) - d0) / dSpan) * neckWidth;
  };
  const fretWidth = (fret: number): number => fretX(fret) - fretX(fret - 1);

  const stringGap = (height - PADDING.top - PADDING.bottom) / stringCount;
  const narrowest = realistic ? fretWidth(range.to) : neckWidth / fretCount;
  const dotRadius = Math.max(3, Math.min(stringGap * 0.42, narrowest * 0.38));

  const noteX = (fret: number): number =>
    fret <= range.from ? nutX - dotRadius * 1.4 : (fretX(fret - 1) + fretX(fret)) / 2;

  const stringY = (string: number): number => PADDING.top + stringGap * (string - 0.5);

  const markers: Marker[] = [];
  for (const fret of [...SINGLE_MARKERS, ...DOUBLE_MARKERS].sort((a, b) => a - b)) {
    if (fret > range.from && fret <= range.to) {
      markers.push({
        fret,
        x: noteX(fret),
        double: (DOUBLE_MARKERS as readonly number[]).includes(fret),
      });
    }
  }

  return {
    width,
    height,
    range,
    stringCount,
    nutX,
    rightX,
    stringGap,
    dotRadius,
    fretX,
    fretWidth,
    noteX,
    stringY,
    markers,
  };
}

/** Stroke width of a string line: thicker toward the low side (string N). */
export function stringStroke(string: number, stringCount: number): number {
  if (stringCount <= 1) return 1.8;
  return 1.2 + ((string - 1) / (stringCount - 1)) * 1.4;
}
