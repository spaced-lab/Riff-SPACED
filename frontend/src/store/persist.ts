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
import type { AppState } from './types';
import { bundleToSave } from './librarySlice';

export const STORAGE_KEY = 'riffspaced.library.v1';
/** Which riff was open, so a reload lands where the owner left off. */
export const CURRENT_KEY = 'riffspaced.current.v1';
/** View preferences that survive a reload: CRT, retune mode, dyad labels (Phase 8). */
export const PREFS_KEY = 'riffspaced.prefs.v1';
export const AUTOSAVE_DELAY_MS = 500;

/** The subset of the Storage interface we use, so tests can pass a plain object. */
export type KeyValueStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export type Prefs = {
  crt: boolean;
  retuneMode: 'keepShapes' | 'keepPitches';
  showDyadLabels: boolean;
};

/** The saved preferences, or nothing; a broken value is ignored rather than quarantined. */
export function loadPrefs(storage: KeyValueStorage | null = defaultStorage()): Partial<Prefs> {
  const raw = storage?.getItem(PREFS_KEY) ?? null;
  if (raw === null) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    const out: Partial<Prefs> = {};
    if (typeof parsed.crt === 'boolean') out.crt = parsed.crt;
    if (parsed.retuneMode === 'keepShapes' || parsed.retuneMode === 'keepPitches')
      out.retuneMode = parsed.retuneMode;
    if (typeof parsed.showDyadLabels === 'boolean') out.showDyadLabels = parsed.showDyadLabels;
    return out;
  } catch {
    return {};
  }
}

/** Write the preferences whenever one changes. Returns a stop function. */
export function startPrefsSave(storage: KeyValueStorage | null = defaultStorage()): () => void {
  if (!storage) return () => undefined;
  const pick = (s: AppState): Prefs => ({
    crt: s.crt,
    retuneMode: s.retuneMode,
    showDyadLabels: s.showDyadLabels,
  });
  return useStore.subscribe((state, previous) => {
    const next = pick(state);
    const before = pick(previous);
    if (
      next.crt === before.crt &&
      next.retuneMode === before.retuneMode &&
      next.showDyadLabels === before.showDyadLabels
    )
      return;
    try {
      storage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // Storage full or blocked: preferences are a convenience, not data.
    }
  });
}

/**
 * `?demo=1` in the URL throws the saved library and preferences away so the app opens on
 * the demo riffs (screenshots, the README's live link). The parameter is removed from the
 * address bar so a reload does not reset again.
 */
export function resetIfDemoRequested(
  storage: KeyValueStorage | null = defaultStorage(),
  location: { search: string; pathname: string; hash: string } = window.location,
  replaceUrl: (url: string) => void = (url) => window.history.replaceState(null, '', url),
): boolean {
  const params = new URLSearchParams(location.search);
  if (params.get('demo') !== '1') return false;
  for (const key of [STORAGE_KEY, CURRENT_KEY, PREFS_KEY]) {
    try {
      storage?.removeItem(key);
    } catch {
      // ignore
    }
  }
  params.delete('demo');
  const search = params.toString();
  replaceUrl(`${location.pathname}${search ? `?${search}` : ''}${location.hash}`);
  return true;
}

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
  /** The riff to open, when it is still in the bundle. */
  currentRiffId: string | null;
};

export function loadInitialLibrary(storage: KeyValueStorage | null = defaultStorage()): LoadResult {
  const raw = storage?.getItem(STORAGE_KEY) ?? null;
  if (raw === null) {
    return { bundle: loadDemoLibrary(), source: 'demo', warning: null, currentRiffId: null };
  }
  try {
    const result = validateLibrary(migrateLibrary(JSON.parse(raw)));
    if (result.ok) {
      const wanted = storage?.getItem(CURRENT_KEY) ?? null;
      const currentRiffId = result.value.riffs.some((r) => r.id === wanted) ? wanted : null;
      return { bundle: result.value, source: 'storage', warning: null, currentRiffId };
    }
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
    currentRiffId: null,
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
      if (state.currentRiffId) storage.setItem(CURRENT_KEY, state.currentRiffId);
      state.setLastSavedAt(new Date().toISOString());
    } catch (error) {
      state.setStorageWarning(
        `autosave failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  const unsubscribe = useStore.subscribe((state, previous) => {
    if (
      state.riff === previous.riff &&
      state.library === previous.library &&
      state.currentRiffId === previous.currentRiffId
    )
      return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  });
  return () => {
    unsubscribe();
    if (timer !== null) clearTimeout(timer);
  };
}
