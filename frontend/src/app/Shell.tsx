import { SuggestionsDrawer } from '@/ai/SuggestionsDrawer';
import { Dialog } from '@/components/Dialog';
import { Toasts } from '@/components/Toast';
import { ImportAudioDialog } from '@/import/ImportAudioDialog';
import { MenuBar } from '@/menu/MenuBar';
import { Inspector } from '@/inspector/Inspector';
import { LibraryPanel } from '@/library/LibraryPanel';
import { ArrangementEditor } from '@/arrangement/ArrangementEditor';
import { SongEditor } from '@/song/SongEditor';
import { selectDisplayRiff } from '@/store/derived';
import { TransportBar } from '@/transport/TransportBar';
import { EasierTuningDialog } from '@/tuning/EasierTuningDialog';
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
  const display = useStore(selectDisplayRiff);
  const riff = display.riff;
  const showLetters = useStore((s) => s.showLetters);
  const accidentals = useStore((s) => s.accidentals);
  const fretRange = useStore((s) => s.fretRange);
  const realisticSpacing = useStore((s) => s.realisticSpacing);
  const selectedNoteIds = useStore((s) => s.selectedNoteIds);
  const highlightIds = useStore((s) => s.highlightIds);
  const panels = useStore((s) => s.panels);
  const splitView = useStore((s) => s.splitView);
  const editing = useStore((s) => s.editing);
  const select = useStore((s) => s.select);
  const editCursorTick = useStore((s) => s.editCursorTick);
  const ghostNotes = useStore((s) => s.ghostNotes);
  const pendingFret = useStore((s) => s.pendingFret);
  const activeLane = useStore((s) => s.activeLane);
  const addNoteAtCursor = useStore((s) => s.addNoteAtCursor);
  const removeNotes = useStore((s) => s.removeNotes);
  const lastSavedAt = useStore((s) => s.lastSavedAt);
  const storageWarning = useStore((s) => s.storageWarning);
  const fileName = useStore((s) => (s.currentRiffId ? s.fileNames[s.currentRiffId] : undefined));
  const backend = useStore((s) => s.backend);
  const importOpen = useStore((s) => s.importDialogOpen);
  const setImportOpen = useStore((s) => s.setImportDialogOpen);
  const isPlaying = useStore((s) => s.isPlaying);
  const positionTick = useStore((s) => s.positionTick);
  const syncJitterMs = useStore((s) => s.syncJitterMs);
  const auditionRiff = useStore((s) => s.auditionRiff);
  const previewRiff = useStore((s) => s.previewRiff);
  const easierOpen = useStore((s) => s.easierTuningOpen);
  const setEasierOpen = useStore((s) => s.setEasierTuningOpen);
  useKeyboard();

  // While editing the fretboard shows what sounds at the edit cursor (rest of the bar as
  // ghosts); while playing it follows the playback position and the engine flashes the
  // sounding notes through highlightIds. While an AI suggestion is auditioned (Phase 7) the
  // fretboard shows that suggestion instead and returns to the riff when it stops.
  const viewTick = isPlaying ? positionTick : editCursorTick;
  const shownRiff = auditionRiff ?? previewRiff ?? riff;
  const { shown, dimmedIds } = useMemo(() => {
    const atTick = notesSoundingAt(shownRiff, viewTick);
    if (!ghostNotes) return { shown: atTick, dimmedIds: [] as string[] };
    const ids = new Set(atTick.map((n) => n.id));
    const ghosts = notesInBarOf(shownRiff, viewTick).filter((n) => !ids.has(n.id));
    return { shown: [...atTick, ...ghosts], dimmedIds: ghosts.map((n) => n.id) };
  }, [shownRiff, viewTick, ghostNotes]);

  return (
    <div className="shell" data-testid="shell">
      <header className="shell__menu">
        <span className="shell__brand">RIFF-SPACED</span>
        <MenuBar />
      </header>

      {panels.library ? (
        <aside className="shell__library">
          <LibraryPanel />
        </aside>
      ) : null}

      <main className="shell__center">
        {editing === 'arrangement' ? <ArrangementEditor /> : null}
        {editing === 'song' ? <SongEditor /> : null}
        <section className="shell__fretboard" aria-label="fretboard area">
          {splitView ? (
            <SplitView />
          ) : (
            <Fretboard
              tuning={shownRiff.tuning}
              notes={shown}
              dimmedIds={dimmedIds}
              selectedIds={selectedNoteIds}
              highlightIds={highlightIds}
              range={fretRange}
              showLetters={showLetters}
              accidentals={accidentals}
              realisticSpacing={realisticSpacing}
              onCellClick={
                display.readOnly
                  ? undefined
                  : ({ string, fret, shiftKey }) =>
                      addNoteAtCursor(string, fret, { chord: shiftKey })
              }
              onNoteClick={(id, e) => select([id], e.shiftKey)}
              onNoteContextMenu={display.readOnly ? undefined : (id) => removeNotes([id])}
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
      <SuggestionsDrawer />
      {importOpen ? <ImportAudioDialog onClose={() => setImportOpen(false)} /> : null}
      {easierOpen ? <EasierTuningDialog onClose={() => setEasierOpen(false)} /> : null}
      <Toasts />
      <footer className="shell__status" data-testid="status-bar">
        <span data-testid="tuning-status">
          {riff.tuning.name}: {riff.tuning.pitches.join(' ')}
        </span>
        <span data-testid="riff-name">{riff.name}</span>
        {auditionRiff ? (
          <span data-testid="status-audition">auditioning: {auditionRiff.name}</span>
        ) : null}
        {!auditionRiff && previewRiff ? (
          <span data-testid="status-preview">previewing: {previewRiff.tuning.name}</span>
        ) : null}
        {fileName ? <span data-testid="file-name">{fileName}</span> : null}
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
        <span
          data-testid="status-backend"
          className={backend.status === 'unreachable' ? 'shell__warning' : undefined}
          title={backend.error ?? backend.url}
        >
          backend:{' '}
          {backend.status === 'ok'
            ? `ok${backend.version ? ` v${backend.version}` : ''}`
            : backend.status}
        </span>
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
