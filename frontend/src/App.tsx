import { DevToolbar } from './dev/DevToolbar';
import { Fretboard } from './fretboard/Fretboard';
import { useStore } from './store';
import './App.css';

/**
 * Application root. Phase 2 shows the live fretboard for the current riff under a temporary
 * toolbar. P2.T5 replaces this with the full layout shell from SPEC 5.2.
 */
export function App() {
  const riff = useStore((s) => s.riff);
  // One selector per field: a selector returning a fresh object would re-render forever
  // under Zustand v5's strict equality (use `useShallow` if an object is ever needed).
  const showLetters = useStore((s) => s.showLetters);
  const accidentals = useStore((s) => s.accidentals);
  const fretRange = useStore((s) => s.fretRange);
  const realisticSpacing = useStore((s) => s.realisticSpacing);
  const selectedNoteIds = useStore((s) => s.selectedNoteIds);
  const highlightIds = useStore((s) => s.highlightIds);
  const select = useStore((s) => s.select);

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1 className="app-title">RIFF-SPACED</h1>
        <span className="app-subtitle">phase 2: fretboard</span>
      </header>
      <DevToolbar />
      <section className="app-fretboard">
        <Fretboard
          tuning={riff.tuning}
          notes={riff.notes}
          selectedIds={selectedNoteIds}
          highlightIds={highlightIds}
          range={fretRange}
          showLetters={showLetters}
          accidentals={accidentals}
          realisticSpacing={realisticSpacing}
          onNoteClick={(id, e) => select([id], e.shiftKey)}
        />
      </section>
    </main>
  );
}
