import type { StateCreator } from 'zustand';
import type { LibraryBundle, Riff } from '@/model/types';
import type { AppState } from './types';

/**
 * Phase 2 keeps just enough of the library to open demo riffs: the bundle and which riff
 * is current. Phase 5 grows this into full three-tier CRUD, search, and tags.
 */
export type LibrarySlice = {
  library: LibraryBundle;
  currentRiffId: string | null;
  loadLibrary: (bundle: LibraryBundle) => void;
  openRiff: (id: string) => void;
  /** Write the edited riff back into the bundle so the library reflects edits. */
  syncCurrentRiff: () => void;
};

export const createLibrarySlice: StateCreator<AppState, [], [], LibrarySlice> = (set, get) => ({
  library: {
    format: 'riff-spaced/library',
    version: 1,
    exportedAt: '',
    riffs: [],
    arrangements: [],
    songs: [],
  },
  currentRiffId: null,

  loadLibrary: (bundle) => {
    set({ library: bundle });
    const first = bundle.riffs[0];
    if (first) get().openRiff(first.id);
  },

  openRiff: (id) => {
    const state = get();
    state.syncCurrentRiff();
    const riff = get().library.riffs.find((r) => r.id === id);
    if (!riff) return;
    set({ currentRiffId: id });
    state.setRiff(structuredClone(riff));
  },

  syncCurrentRiff: () => {
    const { currentRiffId, riff, library } = get();
    if (!currentRiffId) return;
    const riffs = library.riffs.map((r) => (r.id === currentRiffId ? riff : r));
    set({ library: { ...library, riffs } });
  },
});

export const selectCurrentRiffs = (s: AppState): Riff[] => s.library.riffs;
