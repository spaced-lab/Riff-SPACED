import { Dialog } from '@/components/Dialog';
import { Placeholder } from '@/components/Placeholder';
import { Inspector } from '@/inspector/Inspector';
import { TransportBar } from '@/transport/TransportBar';
import { DevToolbar } from '@/dev/DevToolbar';
import { Fretboard } from '@/fretboard/Fretboard';
import { SplitView } from '@/fretboard/SplitView';
import { TabLanes } from '@/tab/TabLanes';
import { useKeyboard } from '@/hooks/useKeyboard';
import { useStore } from '@/store';
import { notesInBarOf, notesSoundingAt } from '@/store/riffOps';
import { useMemo } from 'react';
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
  const splitView = useStore((s) => s.splitView);
  const select = useStore((s) => s.select);
  const editCursorTick = useStore((s) => s.editCursorTick);
  const ghostNotes = useStore((s) => s.ghostNotes);
  const pendingFret = useStore((s) => s.pendingFret);
  const activeLane = useStore((s) => s.activeLane);
  const addNoteAtCursor = useStore((s) => s.addNoteAtCursor);
  const removeNotes = useStore((s) => s.removeNotes);
  const lastSavedAt = useStore((s) => s.lastSavedAt);
  const storageWarning = useStore((s) => s.storageWarning);
  const isPlaying = useStore((s) => s.isPlaying);
  const positionTick = useStore((s) => s.positionTick);
  const syncJitterMs = useStore((s) => s.syncJitterMs);
  useKeyboard();

  // While editing the fretboard shows what sounds at the edit cursor (rest of the bar as
  // ghosts); while playing it follows the playback position and the engine flashes the
  // sounding notes through highlightIds.
  const viewTick = isPlaying ? positionTick : editCursorTick;
  const { shown, dimmedIds } = useMemo(() => {
    const atTick = notesSoundingAt(riff, viewTick);
    if (!ghostNotes) return { shown: atTick, dimmedIds: [] as string[] };
    const ids = new Set(atTick.map((n) => n.id));
    const ghosts = notesInBarOf(riff, viewTick).filter((n) => !ids.has(n.id));
    return { shown: [...atTick, ...ghosts], dimmedIds: ghosts.map((n) => n.id) };
  }, [riff, viewTick, ghostNotes]);

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
          {splitView ? (
            <SplitView />
          ) : (
            <Fretboard
              tuning={riff.tuning}
              notes={shown}
              dimmedIds={dimmedIds}
              selectedIds={selectedNoteIds}
              highlightIds={highlightIds}
              range={fretRange}
              showLetters={showLetters}
              accidentals={accidentals}
              realisticSpacing={realisticSpacing}
              onCellClick={({ string, fret, shiftKey }) =>
                addNoteAtCursor(string, fret, { chord: shiftKey })
              }
              onNoteClick={(id, e) => select([id], e.shiftKey)}
              onNoteContextMenu={(id) => removeNotes([id])}
            />
          )}
        </section>
        <section className="shell__transport" aria-label="transport">
          <TransportBar />
        </section>
        <section className="shell__tab" aria-label="tab lanes">
          <TabLanes />
        </section>
      </main>

      {panels.inspector ? (
        <aside className="shell__inspector">
          <Inspector />
        </aside>
      ) : null}

      <Dialog />
      <footer className="shell__status" data-testid="status-bar">
        <span>{riff.tuning.name}</span>
        <span data-testid="status-lane">lane {activeLane}</span>
        {syncJitterMs !== null ? (
          <span
            data-testid="status-sync"
            title="max gap between scheduled audio time and the frame that drew it, last second"
          >
            sync ±{syncJitterMs} ms
          </span>
        ) : null}
        {pendingFret !== null ? (
          <span data-testid="status-pending">fret: {pendingFret}_</span>
        ) : null}
        <span>backend: not checked (phase 6)</span>
        <span data-testid="status-saved">
          {lastSavedAt
            ? `saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour12: false })}`
            : 'not saved yet'}
        </span>
        {storageWarning ? (
          <span className="shell__warning" data-testid="status-warning">
            {storageWarning}
          </span>
        ) : null}
      </footer>
    </div>
  );
}
