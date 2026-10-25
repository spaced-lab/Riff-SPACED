import type { StateCreator } from 'zustand';
import type { ScaleOverlay } from '@/fretboard/ScaleDots';
import type { Accidentals } from '@/music/naming';
import type { ColorGroup, ScaleId } from '@/music/scales';
import { COLOR_GROUPS, DEFAULT_SCALE, degreesOf, scaleById, scaleTitle } from '@/music/scales';
import { pitchClass } from '@/music/pitch';
import type { AppState } from './types';

/** Off: no overlay. Color: each degree in its own color. Mono: every scale note the same. */
export type ScaleMode = 'off' | 'color' | 'mono';

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
  setScaleMode: (mode: ScaleMode) => void;
  setScaleId: (id: ScaleId) => void;
  setScaleRoot: (root: number | null) => void;
  setScaleColor: (group: ColorGroup, on: boolean) => void;
  toggleScaleColor: (group: ColorGroup) => void;
};

export const allColorsOn = (): Record<ColorGroup, boolean> =>
  Object.fromEntries(COLOR_GROUPS.map((g) => [g, true])) as Record<ColorGroup, boolean>;

export const createScaleSlice: StateCreator<AppState, [], [], ScaleSlice> = (set) => ({
  scaleMode: 'off',
  scaleId: DEFAULT_SCALE,
  scaleRoot: null,
  scaleColors: allColorsOn(),
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

type OverlayInputs = Pick<
  AppState,
  'scaleMode' | 'scaleId' | 'scaleRoot' | 'scaleColors' | 'riff' | 'accidentals'
>;

let overlayKey: [ScaleMode, ScaleId, number, Record<ColorGroup, boolean>, Accidentals] | null =
  null;
let overlayValue: ScaleOverlay | null = null;

/**
 * The overlay the fretboard draws, or null when the mode is off. Memoized on its inputs so
 * the Fretboard's props stay stable between unrelated store updates (playback ticks).
 */
export function selectScaleOverlay(s: OverlayInputs): ScaleOverlay | null {
  if (s.scaleMode === 'off') return null;
  const root = selectScaleRoot(s);
  const key: NonNullable<typeof overlayKey> = [
    s.scaleMode,
    s.scaleId,
    root,
    s.scaleColors,
    s.accidentals,
  ];
  if (overlayKey && overlayValue && key.every((v, i) => v === overlayKey![i])) return overlayValue;
  const scale = scaleById(s.scaleId);
  overlayKey = key;
  overlayValue = {
    table: degreesOf(scale, root),
    mode: s.scaleMode,
    colored: s.scaleColors,
    title: scaleTitle(scale, root, s.accidentals),
  };
  return overlayValue;
}
