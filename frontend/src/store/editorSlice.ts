import type { StateCreator } from 'zustand';
import { newNote } from '@/model/factories';
import { uuid } from '@/model/ids';
import type { Note, Riff } from '@/model/types';
import { GRID, GRID_NAMES, TICKS_PER_BAR, snapToGrid } from '@/music/time';
import type { GridName } from '@/music/time';
import * as ops from './riffOps';
import type { AppState } from './types';

export type EditorSlice = {
  /** Digits typed for the active lane, shown in the status bar as `fret: 1_` until committed. */
  pendingFret: string | null;
  setPendingFret: (digits: string | null) => void;
  /** Snap to the grid and clamp to the loop, then move the edit cursor. */
  setEditCursor: (tick: number) => void;
  moveCursor: (steps: number) => void;
  moveCursorBars: (bars: number) => void;
  /**
   * Add a note at the edit cursor with the current grid duration. With `chord`, join the
   * chord that already starts at the cursor (creating a chordId if needed). A note already
   * on that string at the cursor is replaced instead of doubled.
   */
  addNoteAtCursor: (string: number, fret: number, options?: { chord?: boolean }) => void;
  cycleGrid: (direction: 1 | -1) => void;
  selectAll: () => void;
  /** Internal clipboard (not the system clipboard): notes with relative starts. */
  clipboard: Note[];
  moveSelection: (deltaTicks: number, deltaStrings: number, options?: ops.MoveOptions) => void;
  resizeSelection: (deltaTicks: number) => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteAtCursor: () => void;
  duplicateSelection: () => void;
};

export function loopEndTick(riff: Riff): number {
  return riff.lengthBars * TICKS_PER_BAR;
}

export function clampCursor(tick: number, riff: Riff, grid: GridName): number {
  const snapped = snapToGrid(tick, grid);
  const last = loopEndTick(riff) - GRID[grid];
  return Math.max(0, Math.min(last, snapped));
}

/** Pure form of addNoteAtCursor, so it can be tested without the store. */
export function addNoteAt(
  riff: Riff,
  cursor: number,
  string: number,
  fret: number,
  grid: GridName,
  chord: boolean,
): Riff {
  const duration = Math.max(1, Math.min(GRID[grid], loopEndTick(riff) - cursor));
  const existingHere = riff.notes.find((n) => n.string === string && n.start === cursor);
  if (existingHere) {
    return {
      ...riff,
      notes: riff.notes.map((n) => (n.id === existingHere.id ? { ...n, fret } : n)),
    };
  }
  const note = newNote({ string, fret, start: cursor, duration });
  if (!chord) return { ...riff, notes: [...riff.notes, note] };

  const atCursor = riff.notes.filter((n) => n.start === cursor);
  const anchor = atCursor[0];
  if (!anchor) return { ...riff, notes: [...riff.notes, note] };
  const chordId = anchor.chordId ?? uuid();
  const notes: Note[] = riff.notes.map((n) =>
    n.start === cursor && !n.chordId ? { ...n, chordId } : n,
  );
  return { ...riff, notes: [...notes, { ...note, chordId, duration: anchor.duration }] };
}

export const createEditorSlice: StateCreator<AppState, [], [], EditorSlice> = (set, get) => ({
  pendingFret: null,
  setPendingFret: (pendingFret) => set({ pendingFret }),

  setEditCursor: (tick) => {
    const { riff, grid } = get();
    set({ editCursorTick: clampCursor(tick, riff, grid) });
  },
  moveCursor: (steps) => {
    const { editCursorTick, grid } = get();
    get().setEditCursor(editCursorTick + steps * GRID[grid]);
  },
  moveCursorBars: (bars) => {
    get().setEditCursor(get().editCursorTick + bars * TICKS_PER_BAR);
  },

  addNoteAtCursor: (string, fret, options = {}) => {
    const { editCursorTick, grid } = get();
    get().commit(options.chord ? 'add chord note' : 'add note', (riff) =>
      addNoteAt(riff, editCursorTick, string, fret, grid, options.chord ?? false),
    );
  },

  cycleGrid: (direction) => {
    const { grid } = get();
    const i = GRID_NAMES.indexOf(grid);
    const next = GRID_NAMES[(i + direction + GRID_NAMES.length) % GRID_NAMES.length];
    if (next) set({ grid: next });
  },

  selectAll: () => set({ selectedNoteIds: get().riff.notes.map((n) => n.id) }),

  clipboard: [],

  moveSelection: (deltaTicks, deltaStrings, options) => {
    const { selectedNoteIds, riff } = get();
    const ids = ops.expandToChords(riff, selectedNoteIds);
    if (!ids.length) return;
    get().commit('move notes', (r) => ops.moveNotes(r, ids, deltaTicks, deltaStrings, options));
    set({ selectedNoteIds: ids });
  },

  resizeSelection: (deltaTicks) => {
    const { selectedNoteIds, grid } = get();
    if (!selectedNoteIds.length) return;
    get().commit('resize notes', (r) =>
      ops.resizeNotes(r, selectedNoteIds, deltaTicks, GRID[grid]),
    );
  },

  copySelection: () => {
    const { riff, selectedNoteIds } = get();
    const clip = ops.copyNotes(riff, selectedNoteIds);
    if (clip.length) set({ clipboard: clip });
  },

  cutSelection: () => {
    get().copySelection();
    const ids = ops.expandToChords(get().riff, get().selectedNoteIds);
    if (ids.length) get().removeNotes(ids);
  },

  pasteAtCursor: () => {
    const { clipboard, editCursorTick } = get();
    if (!clipboard.length) return;
    let pastedIds: string[] = [];
    get().commit('paste', (r) => {
      const result = ops.pasteNotes(r, clipboard, editCursorTick, uuid);
      pastedIds = result.pastedIds;
      return result.riff;
    });
    if (pastedIds.length) set({ selectedNoteIds: pastedIds });
  },

  duplicateSelection: () => {
    const { selectedNoteIds, grid } = get();
    if (!selectedNoteIds.length) return;
    let pastedIds: string[] = [];
    get().commit('duplicate', (r) => {
      const result = ops.duplicateNotes(r, selectedNoteIds, GRID[grid], uuid);
      pastedIds = result.pastedIds;
      return result.riff;
    });
    if (pastedIds.length) set({ selectedNoteIds: pastedIds });
  },
});
