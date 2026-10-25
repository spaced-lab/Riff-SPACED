import type { LibrarySlice } from './librarySlice';
import type { RiffSlice } from './riffSlice';
import type { SelectionSlice } from './selectionSlice';
import type { ViewSlice } from './viewSlice';

/** The whole store: one Zustand state object composed of slices. */
export type AppState = RiffSlice & ViewSlice & SelectionSlice & LibrarySlice;
