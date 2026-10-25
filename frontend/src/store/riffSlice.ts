import type { StateCreator } from 'zustand';
import { newRiff } from '@/model/factories';
import type { Note, Riff } from '@/model/types';
import { retuneRiff, transposeRiff } from '@/music/transpose';
import type { RetuneMode } from '@/music/transpose';
import type { Tuning } from '@/music/tuning';
import { emptyHistory, pushHistory, redo as redoHistory, undo as undoHistory } from './history';
import type { History } from './history';
import * as ops from './riffOps';
import type { AppState } from './types';

export type RiffSlice = {
  /** The riff being edited and played. */
  riff: Riff;
  history: History;
  /**
   * The one door every riff mutation walks through: snapshot the current riff for undo,
   * apply `change`, stamp `updatedAt`. Phase 3's undo/redo and autosave both hang off this.
   * A `change` that returns the same object is a no-op and records nothing.
   */
  commit: (label: string, change: (riff: Riff) => Riff) => void;
  /** Replace the current riff outright (opening a different one). Clears history and selection. */
  setRiff: (riff: Riff) => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, patch: Partial<Omit<Note, 'id'>>) => void;
  removeNotes: (ids: readonly string[]) => void;
  /**
   * Change tuning (SPEC 3.7) in the store's retune mode, or the given one: keepShapes keeps
   * every (string, fret) and the pitches move; keepPitches refingers the same notes on the
   * new tuning and flags what cannot be reached. One undo step; returns the flagged count.
   */
  setTuning: (tuning: Tuning, mode?: RetuneMode) => number;
  /** Shift every pitch and refinger (SPEC 3.7). One undo step; returns the flagged count. */
  transpose: (semitones: number) => number;
  undo: () => void;
  redo: () => void;
};

/** Labels for the Edit menu: `undo add note`, or null when there is nothing to undo. */
export const selectUndoLabel = (s: { history: History }): string | null =>
  s.history.past[s.history.past.length - 1]?.label ?? null;
export const selectRedoLabel = (s: { history: History }): string | null =>
  s.history.future[s.history.future.length - 1]?.label ?? null;

export const createRiffSlice: StateCreator<AppState, [], [], RiffSlice> = (set, get) => ({
  riff: newRiff(),
  history: emptyHistory(),

  commit: (label, change) =>
    set((state) => {
      const next = change(state.riff);
      if (next === state.riff) return {};
      const id = state.currentRiffId;
      return {
        riff: { ...next, updatedAt: new Date().toISOString() },
        history: pushHistory(state.history, label, state.riff),
        dirtyRiffIds:
          id && !state.dirtyRiffIds.includes(id) ? [...state.dirtyRiffIds, id] : state.dirtyRiffIds,
      };
    }),

  setRiff: (riff) =>
    set({
      riff,
      history: emptyHistory(),
      selectedNoteIds: [],
      highlightIds: [],
      editCursorTick: 0,
    }),

  addNote: (note) => get().commit('add note', (riff) => ops.addNote(riff, note)),
  updateNote: (id, patch) => get().commit('edit note', (riff) => ops.updateNote(riff, id, patch)),
  setTuning: (tuning, mode = get().retuneMode) => {
    const current = get().riff.tuning;
    if (current.name === tuning.name && current.pitches.join() === tuning.pitches.join()) return 0;
    const result = retuneRiff(get().riff, tuning, mode);
    const label = mode === 'keepPitches' ? 'retune (keep pitches)' : 'change tuning';
    get().commit(label, () => result.riff);
    return result.unplayable;
  },
  transpose: (semitones) => {
    const result = transposeRiff(get().riff, semitones);
    if (result.riff === get().riff) return 0;
    const sign = semitones > 0 ? '+' : '';
    get().commit(`transpose ${sign}${semitones}`, () => result.riff);
    return result.unplayable;
  },

  undo: () =>
    set((state) => {
      const result = undoHistory(state.history, state.riff);
      return result ? { ...result, selectedNoteIds: [] } : {};
    }),
  redo: () =>
    set((state) => {
      const result = redoHistory(state.history, state.riff);
      return result ? { ...result, selectedNoteIds: [] } : {};
    }),

  removeNotes: (ids) => {
    get().commit('remove notes', (riff) => ops.removeNotes(riff, ids));
    const drop = new Set(ids);
    set((s) => ({ selectedNoteIds: s.selectedNoteIds.filter((id) => !drop.has(id)) }));
  },
});
