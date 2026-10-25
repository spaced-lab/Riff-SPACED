/**
 * Where the library comes from and where it goes (SPEC 7.1, 4.4).
 *
 * Startup: the autosaved bundle in localStorage, validated and migrated; if it is missing,
 * the demo library; if it is corrupt, it is moved aside under a timestamped key and the demo
 * loads with a status-bar warning (never a modal, never a silent overwrite).
 *
 * Autosave: a store subscription debounced at 500 ms writes the bundle, with the current
 * riff's edits folded in, back to the same key. Undo history is separate and not persisted.
 */
import demo from '@shared/fixtures/demo-library.json';
import { migrateLibrary } from '@/model/migrate';
import type { LibraryBundle } from '@/model/types';
import { validateLibrary } from '@/model/validate';
import { useStore } from './index';
import { bundleToSave } from './librarySlice';

export const STORAGE_KEY = 'riffspaced.library.v1';
export const AUTOSAVE_DELAY_MS = 500;

/** The subset of the Storage interface we use, so tests can pass a plain object. */
export type KeyValueStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export function loadDemoLibrary(): LibraryBundle {
  const result = validateLibrary(migrateLibrary(demo));
  if (!result.ok) {
    // The fixture is tested in CI, so this is a build error, not a runtime condition.
    throw new Error(`demo library is invalid:\n${result.errors.join('\n')}`);
  }
  return structuredClone(result.value);
}

export type LoadResult = {
  bundle: LibraryBundle;
  source: 'storage' | 'demo';
  warning: string | null;
};

export function loadInitialLibrary(storage: KeyValueStorage | null = defaultStorage()): LoadResult {
  const raw = storage?.getItem(STORAGE_KEY) ?? null;
  if (raw === null) return { bundle: loadDemoLibrary(), source: 'demo', warning: null };
  try {
    const result = validateLibrary(migrateLibrary(JSON.parse(raw)));
    if (result.ok) return { bundle: result.value, source: 'storage', warning: null };
    return quarantine(storage, raw, result.errors[0] ?? 'invalid library');
  } catch (error) {
    return quarantine(storage, raw, error instanceof Error ? error.message : String(error));
  }
}

function quarantine(storage: KeyValueStorage | null, raw: string, reason: string): LoadResult {
  const asideKey = `${STORAGE_KEY}.corrupt.${Date.now()}`;
  try {
    storage?.setItem(asideKey, raw);
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Storage full or blocked: nothing more we can do; the demo still loads.
  }
  return {
    bundle: loadDemoLibrary(),
    source: 'demo',
    warning: `saved library could not be read (${reason}); it was moved to ${asideKey} and the demo library loaded`,
  };
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Start autosaving. Returns a stop function. Only riff and library changes schedule a
 * write; the write itself updates `lastSavedAt`, which must not schedule another.
 */
export function startAutosave(
  storage: KeyValueStorage | null = defaultStorage(),
  delayMs = AUTOSAVE_DELAY_MS,
): () => void {
  if (!storage) return () => undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    const state = useStore.getState();
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(bundleToSave(state)));
      state.setLastSavedAt(new Date().toISOString());
    } catch (error) {
      state.setStorageWarning(
        `autosave failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  const unsubscribe = useStore.subscribe((state, previous) => {
    if (state.riff === previous.riff && state.library === previous.library) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  });
  return () => {
    unsubscribe();
    if (timer !== null) clearTimeout(timer);
  };
}
