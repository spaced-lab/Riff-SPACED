import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { bootstrapStore } from './store';
import './theme.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('index.html must contain <div id="root">');
}

// Load the demo library (later: the autosaved library) before the first render.
bootstrapStore();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
