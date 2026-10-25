import type { StateCreator } from 'zustand';
import type {
  Arrangement,
  ArrangementEntry,
  LibraryBundle,
  Riff,
  Song,
  SongPart,
} from '@/model/types';
import * as ops from './libraryOps';
import type { Tier } from './libraryOps';
import type { AppState } from './types';

/**
 * The library (SPEC 4.4, P5.T2): the bundle of riffs, arrangements and songs, which item of
 * each tier is current, and CRUD for all three. The bundle arrays are the source of truth
 * (they are what autosave writes); lookups by id are helpers over them.
 */
export type LibrarySlice = {
  library: LibraryBundle;
  currentRiffId: string | null;
  currentArrangementId: string | null;
  currentSongId: string | null;
  /** What the center of the app is editing: a riff, or an arrangement / song (Phase 5 T3). */
  editing: 'riff' | 'arrangement' | 'song';
  /** Riffs edited since their last file save (the `modified` dot). */
  dirtyRiffIds: string[];
  loadLibrary: (bundle: LibraryBundle) => void;
  openRiff: (id: string) => void;
  openArrangement: (id: string) => void;
  openSong: (id: string) => void;
  /** Create an empty riff in the current tuning, add it to the library, and open it. */
  createRiff: (name?: string) => Riff;
  duplicateRiff: (id: string) => void;
  renameItem: (tier: Tier, id: string, name: string) => void;
  deleteItem: (tier: Tier, id: string) => void;
  addTag: (tier: Tier, id: string, tag: string) => void;
  removeTag: (tier: Tier, id: string, tag: string) => void;
  createArrangement: (name?: string) => Arrangement;
  createSong: (title?: string) => Song;
  /** Returns an error message on tuning mismatch, else null. */
  appendRiffToArrangement: (arrangementId: string, riffId: string) => string | null;
  markRiffClean: (id: string) => void;
  /** Returns an error message when the entries would mix tunings, else null. */
  setArrangementEntries: (arrangementId: string, entries: ArrangementEntry[]) => string | null;
  setArrangementTempo: (arrangementId: string, bpm: number) => void;
  setSongParts: (songId: string, parts: SongPart[]) => void;
  setSongNotes: (songId: string, notes: string) => void;
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
  currentArrangementId: null,
  currentSongId: null,
  editing: 'riff',
  dirtyRiffIds: [],

  loadLibrary: (bundle) => {
    set({ library: bundle });
    const first = bundle.riffs[0];
    if (first) get().openRiff(first.id);
  },

  createRiff: (name = 'Untitled riff') => {
    const state = get();
    state.syncCurrentRiff();
    const result = ops.createRiffIn(get().library, state.riff.tuning, name);
    set({ library: result.library });
    get().openRiff(result.riff.id);
    return result.riff;
  },

  openRiff: (id) => {
    const state = get();
    state.syncCurrentRiff();
    const riff = get().library.riffs.find((r) => r.id === id);
    if (!riff) return;
    set({ currentRiffId: id, editing: 'riff' });
    state.setRiff(structuredClone(riff));
  },

  openArrangement: (id) => {
    get().syncCurrentRiff();
    if (!get().library.arrangements.some((a) => a.id === id)) return;
    set({ currentArrangementId: id, editing: 'arrangement' });
  },

  openSong: (id) => {
    get().syncCurrentRiff();
    if (!get().library.songs.some((s) => s.id === id)) return;
    set({ currentSongId: id, editing: 'song' });
  },

  duplicateRiff: (id) => {
    get().syncCurrentRiff();
    const result = ops.duplicateRiff(get().library, id);
    if (!result) return;
    set({ library: result.library });
    get().openRiff(result.riff.id);
  },

  renameItem: (tier, id, name) => {
    get().syncCurrentRiff();
    set({ library: ops.renameItem(get().library, tier, id, name) });
    if (tier === 'riffs' && id === get().currentRiffId) {
      const renamed = get().library.riffs.find((r) => r.id === id);
      if (renamed)
        set({ riff: { ...get().riff, name: renamed.name, updatedAt: renamed.updatedAt } });
    }
  },

  deleteItem: (tier, id) => {
    get().syncCurrentRiff();
    const library = ops.deleteItem(get().library, tier, id);
    set({ library, dirtyRiffIds: get().dirtyRiffIds.filter((d) => d !== id) });
    if (tier === 'riffs' && id === get().currentRiffId) {
      const next = library.riffs[0];
      if (next) {
        set({ currentRiffId: null });
        get().openRiff(next.id);
      } else {
        set({ currentRiffId: null });
        get().createRiff();
      }
    }
    if (tier === 'arrangements' && id === get().currentArrangementId)
      set({ currentArrangementId: null, editing: 'riff' });
    if (tier === 'songs' && id === get().currentSongId)
      set({ currentSongId: null, editing: 'riff' });
  },

  addTag: (tier, id, tag) => {
    get().syncCurrentRiff();
    set({ library: ops.addTag(get().library, tier, id, tag) });
    if (tier === 'riffs' && id === get().currentRiffId) {
      const r = get().library.riffs.find((x) => x.id === id);
      if (r) set({ riff: { ...get().riff, tags: r.tags, updatedAt: r.updatedAt } });
    }
  },

  removeTag: (tier, id, tag) => {
    get().syncCurrentRiff();
    set({ library: ops.removeTag(get().library, tier, id, tag) });
    if (tier === 'riffs' && id === get().currentRiffId) {
      const r = get().library.riffs.find((x) => x.id === id);
      if (r) set({ riff: { ...get().riff, tags: r.tags, updatedAt: r.updatedAt } });
    }
  },

  createArrangement: (name = 'Untitled arrangement') => {
    get().syncCurrentRiff();
    const result = ops.createArrangementIn(get().library, name, get().riff.tempo.bpm);
    set({ library: result.library });
    get().openArrangement(result.arrangement.id);
    return result.arrangement;
  },

  createSong: (title = 'Untitled song') => {
    get().syncCurrentRiff();
    const result = ops.createSongIn(get().library, title, get().riff.tuning);
    set({ library: result.library });
    get().openSong(result.song.id);
    return result.song;
  },

  appendRiffToArrangement: (arrangementId, riffId) => {
    get().syncCurrentRiff();
    const result = ops.appendRiffToArrangement(get().library, arrangementId, riffId);
    if ('error' in result) return result.error;
    set({ library: result.library });
    return null;
  },

  markRiffClean: (id) => set((s) => ({ dirtyRiffIds: s.dirtyRiffIds.filter((d) => d !== id) })),

  setArrangementEntries: (arrangementId, entries) => {
    get().syncCurrentRiff();
    const result = ops.setArrangementEntries(get().library, arrangementId, entries);
    if ('error' in result) return result.error;
    set({ library: result.library });
    return null;
  },
  setArrangementTempo: (arrangementId, bpm) =>
    set({ library: ops.setArrangementTempo(get().library, arrangementId, bpm) }),
  setSongParts: (songId, parts) => set({ library: ops.setSongParts(get().library, songId, parts) }),
  setSongNotes: (songId, notes) => set({ library: ops.setSongNotes(get().library, songId, notes) }),

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
