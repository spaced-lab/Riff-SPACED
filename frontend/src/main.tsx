import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { bootstrapStore } from './store';
import { startAutosave } from './store/persist';
import './theme.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('index.html must contain <div id="root">');
}

// Load the autosaved library (or the demo on first run) before the first render, then
// keep saving it as the riff changes.
bootstrapStore(window.localStorage);
startAutosave();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
