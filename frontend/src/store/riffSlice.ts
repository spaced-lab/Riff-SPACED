import type { StateCreator } from 'zustand';
import { newRiff } from '@/model/factories';
import type { Note, Riff } from '@/model/types';
import { emptyHistory, pushHistory } from './history';
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
};

export const createRiffSlice: StateCreator<AppState, [], [], RiffSlice> = (set, get) => ({
  riff: newRiff(),
  history: emptyHistory(),

  commit: (label, change) =>
    set((state) => {
      const next = change(state.riff);
      if (next === state.riff) return {};
      return {
        riff: { ...next, updatedAt: new Date().toISOString() },
        history: pushHistory(state.history, label, state.riff),
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
  removeNotes: (ids) => {
    get().commit('remove notes', (riff) => ops.removeNotes(riff, ids));
    const drop = new Set(ids);
    set((s) => ({ selectedNoteIds: s.selectedNoteIds.filter((id) => !drop.has(id)) }));
  },
});
