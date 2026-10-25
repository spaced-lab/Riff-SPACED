import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newNote } from '@/model/factories';
import { bootstrapStore, useStore } from './index';
import {
  CURRENT_KEY,
  PREFS_KEY,
  STORAGE_KEY,
  loadInitialLibrary,
  loadPrefs,
  resetIfDemoRequested,
  startAutosave,
  startPrefsSave,
} from './persist';
import type { KeyValueStorage } from './persist';

function memoryStorage(
  initial: Record<string, string> = {},
): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

describe('loadInitialLibrary', () => {
  it('loads the demo when storage is empty', () => {
    const r = loadInitialLibrary(memoryStorage());
    expect(r.source).toBe('demo');
    expect(r.bundle.riffs).toHaveLength(2);
    expect(r.warning).toBeNull();
  });

  it('loads a valid saved bundle and remembers the open riff when it still exists', () => {
    const saved = loadInitialLibrary(memoryStorage()).bundle;
    saved.riffs[0]!.name = 'Edited';
    const r = loadInitialLibrary(
      memoryStorage({ [STORAGE_KEY]: JSON.stringify(saved), [CURRENT_KEY]: 'demo-riff-tritone' }),
    );
    expect(r.source).toBe('storage');
    expect(r.bundle.riffs[0]!.name).toBe('Edited');
    expect(r.currentRiffId).toBe('demo-riff-tritone');
    const gone = loadInitialLibrary(
      memoryStorage({ [STORAGE_KEY]: JSON.stringify(saved), [CURRENT_KEY]: 'deleted' }),
    );
    expect(gone.currentRiffId).toBeNull();
  });

  it('quarantines corrupt storage and loads the demo with a warning', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{not json' });
    const r = loadInitialLibrary(storage);
    expect(r.source).toBe('demo');
    expect(r.warning).toMatch(/could not be read/);
    expect(storage.data[STORAGE_KEY]).toBeUndefined();
    const aside = Object.keys(storage.data).find((k) => k.startsWith(`${STORAGE_KEY}.corrupt.`));
    expect(aside).toBeDefined();
    expect(storage.data[aside!]).toBe('{not json');

    const invalid = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        format: 'riff-spaced/library',
        version: 1,
        exportedAt: '2026-01-01T00:00:00Z',
        // Migration tolerates a missing list, so the failure has to be inside a riff.
        riffs: [{ format: 'riff-spaced/riff', version: 1, name: 'broken' }],
        arrangements: [],
        songs: [],
      }),
    });
    expect(loadInitialLibrary(invalid).warning).toMatch(/riffs\[0\]: riff\.id is required/);
  });
});

describe('autosave', () => {
  let stop = () => {};
  beforeEach(() => {
    vi.useFakeTimers();
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });
  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it('debounces writes to 500 ms and records the save time', () => {
    const storage = memoryStorage();
    stop = startAutosave(storage, 500);
    const s = useStore.getState();
    s.addNote(newNote({ string: 6, fret: 1, start: 0, duration: 120 }));
    vi.advanceTimersByTime(300);
    s.addNote(newNote({ string: 6, fret: 2, start: 120, duration: 120 }));
    vi.advanceTimersByTime(300);
    expect(storage.data[STORAGE_KEY]).toBeUndefined();
    vi.advanceTimersByTime(200);
    const saved = JSON.parse(storage.data[STORAGE_KEY]!);
    expect(saved.riffs[0].notes).toHaveLength(58);
    expect(storage.data[CURRENT_KEY]).toBe('demo-riff-walkdown');
    expect(useStore.getState().lastSavedAt).not.toBeNull();
    const writes = Object.keys(storage.data).length;
    vi.advanceTimersByTime(2000);
    expect(Object.keys(storage.data).length).toBe(writes);
  });

  it('reports a failing storage in the status warning instead of throwing', () => {
    const broken: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => undefined,
    };
    stop = startAutosave(broken, 10);
    useStore.getState().addNote(newNote({ string: 6, fret: 1, start: 0, duration: 120 }));
    vi.advanceTimersByTime(20);
    expect(useStore.getState().storageWarning).toMatch(/quota exceeded/);
  });

  it('bootstrapStore reopens the saved current riff', () => {
    const storage = memoryStorage();
    stop = startAutosave(storage, 10);
    useStore.getState().openRiff('demo-riff-tritone');
    vi.advanceTimersByTime(20);
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore(storage);
    expect(useStore.getState().riff.name).toBe('Tritone Chug');
  });

  it('bootstrapStore surfaces the corruption warning', () => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore(memoryStorage({ [STORAGE_KEY]: 'garbage' }));
    expect(useStore.getState().storageWarning).toMatch(/moved to/);
    expect(useStore.getState().riff.name).toBe('Walkdown Turnaround');
  });
});

describe('preferences and the demo reset', () => {
  it('round-trips CRT, retune mode and dyad labels and ignores junk', () => {
    const storage = memoryStorage();
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore(storage);
    const stop = startPrefsSave(storage);
    useStore.getState().setCrt(true);
    useStore.getState().setRetuneMode('keepPitches');
    useStore.getState().setScaleMode('color');
    useStore.getState().setScaleId('blues');
    useStore.getState().toggleScaleColor('others');
    const expected = {
      crt: true,
      retuneMode: 'keepPitches',
      showDyadLabels: true,
      scaleMode: 'color',
      scaleId: 'blues',
      scaleRoot: null,
      scaleColors: {
        roots: true,
        thirds: true,
        fifths: true,
        sevenths: true,
        blue: true,
        others: false,
      },
      scaleNeck: 'follow',
    };
    expect(JSON.parse(storage.getItem(PREFS_KEY)!)).toEqual(expected);
    stop();
    expect(loadPrefs(storage)).toEqual(expected);
    storage.setItem(
      PREFS_KEY,
      '{"crt": "yes", "retuneMode": "sideways", "showDyadLabels": false, "scaleMode": "neon", "scaleId": "lydian", "scaleRoot": 1.5, "scaleColors": {"roots": false, "blue": "no"}}',
    );
    expect(loadPrefs(storage)).toEqual({
      showDyadLabels: false,
      scaleColors: {
        roots: false,
        thirds: true,
        fifths: true,
        sevenths: true,
        blue: true,
        others: true,
      },
    });
    storage.setItem(PREFS_KEY, 'not json');
    expect(loadPrefs(storage)).toEqual({});
    useStore.setState(useStore.getInitialState(), true);
    storage.setItem(PREFS_KEY, '{"crt": true}');
    bootstrapStore(storage);
    expect(useStore.getState().crt).toBe(true);
  });

  it('?demo=1 clears the saved library and preferences and strips the parameter', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, '{}');
    storage.setItem(CURRENT_KEY, 'x');
    storage.setItem(PREFS_KEY, '{"crt":true}');
    const urls: string[] = [];
    const reset = resetIfDemoRequested(
      storage,
      { search: '?demo=1&other=2', pathname: '/app/', hash: '#/dev' },
      (url) => urls.push(url),
    );
    expect(reset).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem(CURRENT_KEY)).toBeNull();
    expect(storage.getItem(PREFS_KEY)).toBeNull();
    expect(urls).toEqual(['/app/?other=2#/dev']);
    expect(resetIfDemoRequested(storage, { search: '', pathname: '/', hash: '' }, () => {})).toBe(
      false,
    );
  });
});
