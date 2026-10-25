/**
 * The application store (DECISIONS 12): one Zustand store built from slices.
 * Components subscribe with `useStore(selector)`; non-React code (the audio engine, the
 * keyboard handler) reads `useStore.getState()` and subscribes with `useStore.subscribe`.
 */
import { create } from 'zustand';
import { createDialogSlice } from './dialogSlice';
import { createEditorSlice } from './editorSlice';
import { createLibrarySlice } from './librarySlice';
import { createRiffSlice } from './riffSlice';
import { createSelectionSlice } from './selectionSlice';
import type { AppState } from './types';
import { loadInitialLibrary } from './persist';
import type { KeyValueStorage } from './persist';
import { createViewSlice } from './viewSlice';

export type { AppState } from './types';

export const useStore = create<AppState>()((...a) => ({
  ...createRiffSlice(...a),
  ...createViewSlice(...a),
  ...createSelectionSlice(...a),
  ...createLibrarySlice(...a),
  ...createEditorSlice(...a),
  ...createDialogSlice(...a),
}));

/**
 * Load the startup library once. Called from main.tsx, and by tests that want fresh state.
 * Tests pass `null` storage to always get the demo library.
 */
export function bootstrapStore(storage: KeyValueStorage | null | undefined = null): void {
  const { bundle, warning } = loadInitialLibrary(storage === undefined ? undefined : storage);
  useStore.getState().loadLibrary(bundle);
  useStore.getState().setStorageWarning(warning);
}
