import { useEffect } from 'react';
import { useStore } from '@/store';
import { handleKey, isTypingTarget } from './keyboard';

/** Installs the global keydown listener once, at the app root. */
export function useKeyboard(): void {
  useEffect(() => {
    const deps = {
      getState: useStore.getState,
      setTimeout: (fn: () => void, ms: number) => window.setTimeout(fn, ms),
      clearTimeout: (id: number) => window.clearTimeout(id),
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (handleKey(e, deps)) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
