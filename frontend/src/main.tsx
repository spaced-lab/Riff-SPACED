import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { bootstrapStore } from './store';
import { startAutosave } from './store/persist';
import { startEngine } from './audio/engine';
import { getAudioContext, hasAudioContext } from './audio/context';
import { useStore } from './store';
import './theme.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('index.html must contain <div id="root">');
}

// Load the autosaved library (or the demo on first run) before the first render, then
// keep saving it as the riff changes.
bootstrapStore(window.localStorage);
startAutosave();
startEngine();

// A small hook for the Playwright suite: read the store and the audio state from tests.
declare global {
  interface Window {
    riffspaced?: { store: typeof useStore; audioState: () => string };
  }
}
window.riffspaced = {
  store: useStore,
  audioState: () => (hasAudioContext() ? getAudioContext().state : 'none'),
};

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
