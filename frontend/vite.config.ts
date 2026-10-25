/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `base` is the URL prefix the built app is served from. GitHub Pages serves a
// project site at /<repo>/, so the Pages workflow sets VITE_BASE_PATH=/Riff-SPACED/.
// Local dev and Docker serve from the root, so the default is '/'.
const base = process.env.VITE_BASE_PATH ?? '/';

const src = fileURLToPath(new URL('./src', import.meta.url));
const shared = fileURLToPath(new URL('../shared', import.meta.url));

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': src,
      // shared/ holds the JSON schemas and fixtures both frontend and backend use.
      '@shared': shared,
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Vite refuses to serve files outside the project root unless told otherwise.
    fs: { allow: ['.', shared] },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
