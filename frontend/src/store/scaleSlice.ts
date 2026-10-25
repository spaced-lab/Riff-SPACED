import type { StateCreator } from 'zustand';
import type { ScaleOverlay } from '@/fretboard/ScaleDots';
import { positionsOf } from '@/music/positions';
import type { Position } from '@/music/positions';
import { DEFAULT_FRET_COUNT } from '@/music/tuning';
import type { Accidentals } from '@/music/naming';
import type { ColorGroup, ScaleId } from '@/music/scales';
import { COLOR_GROUPS, DEFAULT_SCALE, degreesOf, scaleById, scaleTitle } from '@/music/scales';
import { pitchClass } from '@/music/pitch';
import type { AppState } from './types';
import { MAX_FRET, rangeCenteredOn } from './viewSlice';
import type { FretRange } from './viewSlice';

/** Off: no overlay. Color: each degree in its own color. Mono: every scale note the same. */
export type ScaleMode = 'off' | 'color' | 'mono';

/**
 * How much neck the scale view shows. `follow`: a window of the chosen width that slides to
 * keep the hand position in the middle. `all`: every fret from the nut to 24, with the dots
 * shrunk to fit, so the whole run of shapes is visible at once.
 */
export type ScaleNeck = 'follow' | 'all';

/** The window used when returning from "all 24 frets" to following the position. */
export const FOLLOW_WIDTH = 12;

/**
 * Where the scale is drawn. `separate`: its own neck above the riff neck, so the two never
 * cover each other. `superimpose`: one neck, scale dots under the riff notes, which are drawn
 * as outlines so the scale colors stay visible inside them.
 */
export type ScaleLayout = 'separate' | 'superimpose';

export type ScaleSlice = {
  scaleMode: ScaleMode;
  scaleId: ScaleId;
  /**
   * Root pitch class 0..11, or null to follow the lowest open string of the current tuning
   * (Bb in Bb Standard). Following the tuning is the default because a riff writer in a
   * drop or low standard tuning almost always thinks from the low string.
   */
  scaleRoot: number | null;
  /** Which degree groups are drawn in color. All on by default; off means the plain ring. */
  scaleColors: Record<ColorGroup, boolean>;
  /**
   * CAGED position (P9.T5): the index of the hand position to highlight, counted from the
   * nut, or null for the whole neck. Scale notes outside the position are dimmed.
   */
  scalePosition: number | null;
  setScalePosition: (index: number | null) => void;
  scaleNeck: ScaleNeck;
  setScaleNeck: (neck: ScaleNeck) => void;
  scaleLayout: ScaleLayout;
  setScaleLayout: (layout: ScaleLayout) => void;
  /** Show the riff while the scale is shown: the riff neck (separate) or the notes (superimpose). */
  scaleShowRiff: boolean;
  setScaleShowRiff: (on: boolean) => void;
  /** Move one position up (+1) or down (-1) the neck; from the whole neck, +1 is the first. */
  stepScalePosition: (delta: 1 | -1) => void;
  setScaleMode: (mode: ScaleMode) => void;
  setScaleId: (id: ScaleId) => void;
  setScaleRoot: (root: number | null) => void;
  setScaleColor: (group: ColorGroup, on: boolean) => void;
  toggleScaleColor: (group: ColorGroup) => void;
};

/**
 * The new position, plus the fret range slid to keep it in the middle of the board (the
 * range keeps its width and never leaves 0..24). A range that already shows the whole neck
 * does not move.
 */
function followPosition(
  s: Pick<AppState, 'scaleId' | 'scaleRoot' | 'riff' | 'fretRange'>,
  index: number,
): { scalePosition: number; fretRange: FretRange } {
  const position = selectScalePositions(s)[index];
  const fretRange = position
    ? rangeCenteredOn(s.fretRange, position.fromFret, position.toFret)
    : s.fretRange;
  return { scalePosition: index, fretRange };
}

export const allColorsOn = (): Record<ColorGroup, boolean> =>
  Object.fromEntries(COLOR_GROUPS.map((g) => [g, true])) as Record<ColorGroup, boolean>;

export const createScaleSlice: StateCreator<AppState, [], [], ScaleSlice> = (set) => ({
  scaleMode: 'off',
  scaleId: DEFAULT_SCALE,
  scaleRoot: null,
  scaleColors: allColorsOn(),
  scalePosition: null,
  scaleLayout: 'separate',
  setScaleLayout: (scaleLayout) => set({ scaleLayout }),
  scaleShowRiff: true,
  setScaleShowRiff: (scaleShowRiff) => set({ scaleShowRiff }),
  scaleNeck: 'follow',
  setScaleNeck: (neck) =>
    set((s) => {
      if (neck === 'all') return { scaleNeck: neck, fretRange: { from: 0, to: MAX_FRET } };
      // Back to following: a 12-fret window centered on the position, or from the nut.
      const base = { from: 0, to: FOLLOW_WIDTH };
      const position = selectScalePosition(s);
      return {
        scaleNeck: neck,
        fretRange: position ? rangeCenteredOn(base, position.fromFret, position.toFret) : base,
      };
    }),
  setScalePosition: (index) =>
    set((s) => {
      if (index === null) return { scalePosition: null };
      const count = selectScalePositions(s).length;
      if (count === 0) return { scalePosition: null };
      return followPosition(s, Math.max(0, Math.min(count - 1, Math.floor(index))));
    }),
  stepScalePosition: (delta) =>
    set((s) => {
      const count = selectScalePositions(s).length;
      if (count === 0) return {};
      const current = s.scalePosition;
      if (current === null) return followPosition(s, delta > 0 ? 0 : count - 1);
      const next = current + delta;
      // Past either end the view returns to the whole neck, so stepping cycles through.
      return next < 0 || next >= count ? { scalePosition: null } : followPosition(s, next);
    }),
  setScaleMode: (scaleMode) => set({ scaleMode }),
  setScaleId: (scaleId) => set({ scaleId }),
  setScaleRoot: (root) => set({ scaleRoot: root === null ? null : pitchClass(root) }),
  setScaleColor: (group, on) => set((s) => ({ scaleColors: { ...s.scaleColors, [group]: on } })),
  toggleScaleColor: (group) =>
    set((s) => ({ scaleColors: { ...s.scaleColors, [group]: !s.scaleColors[group] } })),
});

/** The root in effect: the chosen one, or the lowest open string's pitch class. */
export function selectScaleRoot(s: Pick<AppState, 'scaleRoot' | 'riff'>): number {
  if (s.scaleRoot !== null) return s.scaleRoot;
  return pitchClass(s.riff.tuning.pitches[0] ?? 0);
}

type PositionInputs = Pick<AppState, 'scaleId' | 'scaleRoot' | 'riff'>;

let positionsKey: [ScaleId, number, string] | null = null;
let positionsValue: Position[] = [];

/** The hand positions of the current scale in the current tuning, from the nut up. */
export function selectScalePositions(s: PositionInputs): Position[] {
  const root = selectScaleRoot(s);
  const key: NonNullable<typeof positionsKey> = [s.scaleId, root, s.riff.tuning.pitches.join()];
  if (positionsKey && key.every((v, i) => v === positionsKey![i])) return positionsValue;
  positionsKey = key;
  positionsValue = positionsOf(scaleById(s.scaleId), root, s.riff.tuning, DEFAULT_FRET_COUNT);
  return positionsValue;
}

/** The highlighted position, clamped to what the current scale and tuning offer. */
export function selectScalePosition(
  s: PositionInputs & Pick<AppState, 'scalePosition'>,
): Position | null {
  if (s.scalePosition === null) return null;
  const positions = selectScalePositions(s);
  return positions[Math.min(s.scalePosition, positions.length - 1)] ?? null;
}

type OverlayInputs = Pick<
  AppState,
  'scaleMode' | 'scaleId' | 'scaleRoot' | 'scaleColors' | 'scalePosition' | 'riff' | 'accidentals'
>;

let overlayKey:
  [ScaleMode, ScaleId, number, Record<ColorGroup, boolean>, Accidentals, Position | null] | null =
  null;
let overlayValue: ScaleOverlay | null = null;

/**
 * The overlay the fretboard draws, or null when the mode is off. Memoized on its inputs so
 * the Fretboard's props stay stable between unrelated store updates (playback ticks).
 */
export function selectScaleOverlay(s: OverlayInputs): ScaleOverlay | null {
  if (s.scaleMode === 'off') return null;
  const root = selectScaleRoot(s);
  const position = selectScalePosition(s);
  const key: NonNullable<typeof overlayKey> = [
    s.scaleMode,
    s.scaleId,
    root,
    s.scaleColors,
    s.accidentals,
    position,
  ];
  if (overlayKey && overlayValue && key.every((v, i) => v === overlayKey![i])) return overlayValue;
  const scale = scaleById(s.scaleId);
  overlayKey = key;
  overlayValue = {
    table: degreesOf(scale, root),
    mode: s.scaleMode,
    colored: s.scaleColors,
    title: scaleTitle(scale, root, s.accidentals),
    position,
  };
  return overlayValue;
}
