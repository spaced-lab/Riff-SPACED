import type { AiSlice } from './aiSlice';
import type { BackendSlice } from './backendSlice';
import type { DialogSlice } from './dialogSlice';
import type { EditorSlice } from './editorSlice';
import type { FileSlice } from './fileSlice';
import type { LibrarySlice } from './librarySlice';
import type { RiffSlice } from './riffSlice';
import type { ScaleSlice } from './scaleSlice';
import type { SelectionSlice } from './selectionSlice';
import type { TransportSlice } from './transportSlice';
import type { ViewSlice } from './viewSlice';

/** The whole store: one Zustand state object composed of slices. */
export type AppState = RiffSlice &
  ViewSlice &
  SelectionSlice &
  LibrarySlice &
  EditorSlice &
  DialogSlice &
  TransportSlice &
  FileSlice &
  BackendSlice &
  AiSlice &
  ScaleSlice;
