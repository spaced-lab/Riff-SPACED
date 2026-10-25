import { Placeholder } from '@/components/Placeholder';
import { DevToolbar } from '@/dev/DevToolbar';
import { Fretboard } from '@/fretboard/Fretboard';
import { TabLanes } from '@/tab/TabLanes';
import { useStore } from '@/store';
import './shell.css';

/**
 * The layout from SPEC 5.2. In Phase 2 only the fretboard is real; every other region is
 * a labeled placeholder so the shape of the app is visible from the start.
 *
 *   menu bar
 *   library | fretboard / transport / tab lanes | inspector
 *   status bar
 */
export function Shell() {
  const riff = useStore((s) => s.riff);
  const showLetters = useStore((s) => s.showLetters);
  const accidentals = useStore((s) => s.accidentals);
  const fretRange = useStore((s) => s.fretRange);
  const realisticSpacing = useStore((s) => s.realisticSpacing);
  const selectedNoteIds = useStore((s) => s.selectedNoteIds);
  const highlightIds = useStore((s) => s.highlightIds);
  const panels = useStore((s) => s.panels);
  const select = useStore((s) => s.select);

  return (
    <div className="shell" data-testid="shell">
      <header className="shell__menu">
        <span className="shell__brand">RIFF-SPACED</span>
        <Placeholder name="Menu bar" phase={5} />
      </header>

      {panels.library ? (
        <aside className="shell__library">
          <Placeholder name="Library" phase={5} />
        </aside>
      ) : null}

      <main className="shell__center">
        <DevToolbar />
        <section className="shell__fretboard" aria-label="fretboard area">
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
        <section className="shell__transport">
          <Placeholder name="Transport" phase={4} />
        </section>
        <section className="shell__tab" aria-label="tab lanes">
          <TabLanes />
        </section>
      </main>

      {panels.inspector ? (
        <aside className="shell__inspector">
          <Placeholder name="Inspector" phase={3} />
        </aside>
      ) : null}

      <footer className="shell__status" data-testid="status-bar">
        <span>{riff.tuning.name}</span>
        <span>backend: not checked (phase 6)</span>
        <span>autosave: phase 3</span>
      </footer>
    </div>
  );
}
