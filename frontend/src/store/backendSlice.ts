import type { StateCreator } from 'zustand';
import type { AppState } from './types';

export type BackendStatus = 'unknown' | 'ok' | 'unreachable';

/**
 * The analysis backend (SPEC 2.3): optional, polled every 15 s, never required. The URL
 * comes from VITE_BACKEND_URL (default http://localhost:8000) and can be changed in
 * AI > Settings (Phase 7).
 */
export type BackendSlice = {
  backend: {
    url: string;
    status: BackendStatus;
    version: string | null;
    aiConfigured: boolean;
    checkedAt: string | null;
    error: string | null;
  };
  setBackendUrl: (url: string) => void;
  setBackendStatus: (patch: Partial<BackendSlice['backend']>) => void;
};

export const DEFAULT_BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8000';

export const createBackendSlice: StateCreator<AppState, [], [], BackendSlice> = (set) => ({
  backend: {
    url: DEFAULT_BACKEND_URL,
    status: 'unknown',
    version: null,
    aiConfigured: false,
    checkedAt: null,
    error: null,
  },
  setBackendUrl: (url) =>
    set((s) => ({ backend: { ...s.backend, url: url.replace(/\/+$/, ''), status: 'unknown' } })),
  setBackendStatus: (patch) => set((s) => ({ backend: { ...s.backend, ...patch } })),
});
