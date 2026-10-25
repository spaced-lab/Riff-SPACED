import type { StateCreator } from 'zustand';
import type { Accidentals } from '@/music/naming';
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
  panels: { library: boolean; inspector: boolean };
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
  panels: { library: true, inspector: true },
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
