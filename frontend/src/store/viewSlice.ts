import type { StateCreator } from 'zustand';
import type { Accidentals } from '@/music/naming';
import type { GridName } from '@/music/time';
import type { AppState } from './types';

export type FretRange = { from: number; to: number };

export const FRET_RANGE_PRESETS: readonly { label: string; range: FretRange }[] = [
  { label: '0-12', range: { from: 0, to: 12 } },
  { label: '0-24', range: { from: 0, to: 24 } },
  { label: '0-5', range: { from: 0, to: 5 } },
  { label: '5-17', range: { from: 5, to: 17 } },
];

export type ViewSlice = {
  /** Note letters inside dots (DECISIONS 6). */
  showLetters: boolean;
  accidentals: Accidentals;
  fretRange: FretRange;
  /** Each fret 0.944 of the previous, like a real neck. Off so riffs read evenly. */
  realisticSpacing: boolean;
  /** 2x2 mini fretboards, one per quarter of the loop (SPEC 5.5). */
  splitView: boolean;
  /** Dim all other notes of the current bar behind the ones at the cursor (Phase 3). */
  ghostNotes: boolean;
  /** Auto-scroll the tab lanes to keep the playhead within the middle of the view. */
  followPlayhead: boolean;
  setFollowPlayhead: (on: boolean) => void;
  panels: { library: boolean; inspector: boolean };
  /** Editor grid resolution: note entry duration and snapping (SPEC 3.4). */
  grid: GridName;
  /** Tab lane zoom in pixels per bar, 120..1200. */
  pxPerBar: number;
  setGrid: (grid: GridName) => void;
  setPxPerBar: (px: number) => void;
  setShowLetters: (on: boolean) => void;
  setAccidentals: (a: Accidentals) => void;
  setFretRange: (range: FretRange) => void;
  setRealisticSpacing: (on: boolean) => void;
  setSplitView: (on: boolean) => void;
  setGhostNotes: (on: boolean) => void;
  togglePanel: (panel: 'library' | 'inspector') => void;
};

export const createViewSlice: StateCreator<AppState, [], [], ViewSlice> = (set) => ({
  showLetters: false,
  accidentals: 'flats',
  fretRange: { from: 0, to: 12 },
  realisticSpacing: false,
  splitView: false,
  ghostNotes: true,
  followPlayhead: true,
  setFollowPlayhead: (followPlayhead) => set({ followPlayhead }),
  panels: { library: true, inspector: true },
  grid: '1/16',
  pxPerBar: 320,
  setGrid: (grid) => set({ grid }),
  setPxPerBar: (px) => set({ pxPerBar: clampZoom(px) }),
  setShowLetters: (showLetters) => set({ showLetters }),
  setAccidentals: (accidentals) => set({ accidentals }),
  setFretRange: (fretRange) => set({ fretRange: clampRange(fretRange) }),
  setRealisticSpacing: (realisticSpacing) => set({ realisticSpacing }),
  setSplitView: (splitView) => set({ splitView }),
  setGhostNotes: (ghostNotes) => set({ ghostNotes }),
  togglePanel: (panel) => set((s) => ({ panels: { ...s.panels, [panel]: !s.panels[panel] } })),
});

/** Keep the range sane: 0..24, at least one fret wide. */
export function clampRange(range: FretRange): FretRange {
  const from = Math.max(0, Math.min(23, Math.floor(range.from)));
  const to = Math.max(from + 1, Math.min(24, Math.floor(range.to)));
  return { from, to };
}

export const MIN_PX_PER_BAR = 120;
export const MAX_PX_PER_BAR = 1200;

export function clampZoom(px: number): number {
  return Math.max(MIN_PX_PER_BAR, Math.min(MAX_PX_PER_BAR, Math.round(px)));
}
