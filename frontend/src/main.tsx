import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './theme.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('index.html must contain <div id="root">');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
