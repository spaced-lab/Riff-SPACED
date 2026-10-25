import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { bootstrapStore } from './store';
import { resetIfDemoRequested, startAutosave, startPrefsSave } from './store/persist';
import { startEngine } from './audio/engine';
import { startHealthPolling } from './api/client';
import { getAudioContext, hasAudioContext } from './audio/context';
import { useStore } from './store';
import './theme.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('index.html must contain <div id="root">');
}

// Load the autosaved library (or the demo on first run) before the first render, then
// keep saving it as the riff changes.
resetIfDemoRequested(window.localStorage);
bootstrapStore(window.localStorage);
startAutosave();
startPrefsSave();
startEngine();
useStore.getState().loadRecent();
startHealthPolling();

// A small hook for the Playwright suite (declared in src/types/global.d.ts).
window.riffspaced = {
  store: useStore,
  audioState: () => (hasAudioContext() ? getAudioContext().state : 'none'),
};

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
