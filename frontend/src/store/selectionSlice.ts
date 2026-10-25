import type { StateCreator } from 'zustand';
import type { AppState } from './types';

export type SelectionSlice = {
  selectedNoteIds: string[];
  /** Notes sounding right now during playback; the fretboard flashes these. */
  highlightIds: string[];
  /** Where new notes go and what the fretboard shows while editing (ticks). */
  editCursorTick: number;
  /** The string the keyboard's digit entry targets (guitarist numbering). */
  activeLane: number;
  select: (ids: readonly string[], additive?: boolean) => void;
  clearSelection: () => void;
  setHighlightIds: (ids: readonly string[]) => void;
  setEditCursorTick: (tick: number) => void;
  setActiveLane: (lane: number) => void;
};

export const createSelectionSlice: StateCreator<AppState, [], [], SelectionSlice> = (set) => ({
  selectedNoteIds: [],
  highlightIds: [],
  editCursorTick: 0,
  activeLane: 6,
  select: (ids, additive = false) =>
    set((s) => ({
      selectedNoteIds: additive ? [...new Set([...s.selectedNoteIds, ...ids])] : [...ids],
    })),
  clearSelection: () => set({ selectedNoteIds: [] }),
  setHighlightIds: (ids) =>
    set((s) => (sameIds(s.highlightIds, ids) ? {} : { highlightIds: [...ids] })),
  setEditCursorTick: (editCursorTick) => set({ editCursorTick: Math.max(0, editCursorTick) }),
  setActiveLane: (activeLane) => set({ activeLane }),
});

/** Avoid re-rendering every frame when the highlighted set did not change. */
export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
