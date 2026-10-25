import './App.css';

/**
 * Application root. In Phase 0 it only proves the toolchain works end to end:
 * a themed page, a unit test, an e2e test, and a deploy. The real layout
 * (SPEC 5.2) replaces this in Phase 2.
 */
export function App() {
  return (
    <main className="app-shell">
      <h1 className="app-title">RIFF-SPACED</h1>
      <p className="app-subtitle">phase 0: bootstrap</p>
    </main>
  );
}
