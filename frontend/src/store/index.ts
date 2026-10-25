/**
 * The application store (DECISIONS 12): one Zustand store built from slices.
 * Components subscribe with `useStore(selector)`; non-React code (the audio engine, the
 * keyboard handler) reads `useStore.getState()` and subscribes with `useStore.subscribe`.
 */
import { create } from 'zustand';
import { createAiSlice } from './aiSlice';
import { createBackendSlice } from './backendSlice';
import { createDialogSlice } from './dialogSlice';
import { createEditorSlice } from './editorSlice';
import { createFileSlice } from './fileSlice';
import { createLibrarySlice } from './librarySlice';
import { createRiffSlice } from './riffSlice';
import { createScaleSlice } from './scaleSlice';
import { createSelectionSlice } from './selectionSlice';
import { createTransportSlice } from './transportSlice';
import type { AppState } from './types';
import { loadInitialLibrary, loadPrefs } from './persist';
import type { KeyValueStorage } from './persist';
import type { ColorGroup } from '@/music/scales';
import { createViewSlice } from './viewSlice';

export type { AppState } from './types';

export const useStore = create<AppState>()((...a) => ({
  ...createRiffSlice(...a),
  ...createViewSlice(...a),
  ...createSelectionSlice(...a),
  ...createLibrarySlice(...a),
  ...createEditorSlice(...a),
  ...createDialogSlice(...a),
  ...createTransportSlice(...a),
  ...createFileSlice(...a),
  ...createBackendSlice(...a),
  ...createAiSlice(...a),
  ...createScaleSlice(...a),
}));

/**
 * Load the startup library once. Called from main.tsx, and by tests that want fresh state.
 * Tests pass `null` storage to always get the demo library.
 */
export function bootstrapStore(storage: KeyValueStorage | null | undefined = null): void {
  const { bundle, warning, currentRiffId } = loadInitialLibrary(
    storage === undefined ? undefined : storage,
  );
  useStore.getState().loadLibrary(bundle);
  if (currentRiffId) useStore.getState().openRiff(currentRiffId);
  useStore.getState().setStorageWarning(warning);
  // View preferences (CRT, retune mode, dyad labels) ride along, with the slice defaults
  // for anything missing.
  const prefs = loadPrefs(storage === undefined ? undefined : storage);
  if (prefs.crt !== undefined) useStore.getState().setCrt(prefs.crt);
  if (prefs.retuneMode) useStore.getState().setRetuneMode(prefs.retuneMode);
  if (prefs.showDyadLabels !== undefined)
    useStore.getState().setShowDyadLabels(prefs.showDyadLabels);
  if (prefs.scaleMode) useStore.getState().setScaleMode(prefs.scaleMode);
  if (prefs.scaleId) useStore.getState().setScaleId(prefs.scaleId);
  if (prefs.scaleRoot !== undefined) useStore.getState().setScaleRoot(prefs.scaleRoot);
  if (prefs.scaleColors)
    for (const [group, on] of Object.entries(prefs.scaleColors))
      useStore.getState().setScaleColor(group as ColorGroup, on);
}
