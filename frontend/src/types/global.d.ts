import type { useStore } from '@/store';

/**
 * A small hook for the Playwright suite: read the store and the audio state from tests.
 * Installed by main.tsx; declared here so both the app and the e2e type checks see it.
 */
declare global {
  interface Window {
    riffspaced?: { store: typeof useStore; audioState: () => string };
  }
}

export {};
