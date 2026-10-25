import type { StateCreator } from 'zustand';
import { newRiff } from '@/model/factories';
import type { Note, Riff } from '@/model/types';
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
   * Change tuning keeping shapes (SPEC 3.7): every (string, fret) stays, pitches move.
   * Pitch-preserving retune arrives in Phase 8.
   */
  setTuning: (tuning: Tuning) => void;
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
  setTuning: (tuning) =>
    get().commit('change tuning', (riff) =>
      riff.tuning.name === tuning.name && riff.tuning.pitches.join() === tuning.pitches.join()
        ? riff
        : { ...riff, tuning: { name: tuning.name, pitches: [...tuning.pitches] } },
    ),

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
