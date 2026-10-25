import type { StateCreator } from 'zustand';
import { newRiff } from '@/model/factories';
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
  /** Create an empty riff in the current tuning, add it to the library, and open it. */
  createRiff: (name?: string) => Riff;
  /** Write the edited riff back into the bundle so the library reflects edits. */
  syncCurrentRiff: () => void;
  /** ISO time of the last autosave, for the status bar. */
  lastSavedAt: string | null;
  setLastSavedAt: (iso: string) => void;
  /** A non-blocking warning for the status bar (never a modal), e.g. corrupted storage. */
  storageWarning: string | null;
  setStorageWarning: (message: string | null) => void;
};

/** The bundle as it should be saved: the library with the current riff's edits folded in. */
export function bundleToSave(
  s: Pick<AppState, 'library' | 'riff' | 'currentRiffId'>,
): LibraryBundle {
  const riffs = s.currentRiffId
    ? s.library.riffs.map((r) => (r.id === s.currentRiffId ? s.riff : r))
    : s.library.riffs;
  return { ...s.library, riffs, exportedAt: new Date().toISOString() };
}

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

  createRiff: (name = 'Untitled riff') => {
    const state = get();
    state.syncCurrentRiff();
    const riff = newRiff(state.riff.tuning, { name });
    const library = get().library;
    set({ library: { ...library, riffs: [...library.riffs, riff] } });
    get().openRiff(riff.id);
    return riff;
  },

  openRiff: (id) => {
    const state = get();
    state.syncCurrentRiff();
    const riff = get().library.riffs.find((r) => r.id === id);
    if (!riff) return;
    set({ currentRiffId: id });
    state.setRiff(structuredClone(riff));
  },

  lastSavedAt: null,
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),
  storageWarning: null,
  setStorageWarning: (storageWarning) => set({ storageWarning }),

  syncCurrentRiff: () => {
    const { currentRiffId, riff, library } = get();
    if (!currentRiffId) return;
    const riffs = library.riffs.map((r) => (r.id === currentRiffId ? riff : r));
    set({ library: { ...library, riffs } });
  },
});

export const selectCurrentRiffs = (s: AppState): Riff[] => s.library.riffs;
