import { useState } from 'react';
import { analyzeFile } from '@/api/client';
import type { AnalyzeResult } from '@/api/client';
import { ALL_PRESETS } from '@/music/tuning';
import { useStore } from '@/store';
import './import.css';

type FileState = {
  file: File;
  status: 'pending' | 'running' | 'done' | 'failed';
  message: string;
  report?: string;
};

/**
 * File > Import from audio (SPEC 8.4, P6.T9). Pick recordings, choose the tuning the owner
 * was in, optionally force a tempo, limit the search, and import. Each result lands in the
 * library tagged `imported` with low-confidence notes drawn amber; each report is shown in
 * a drawer under the file. Needs the backend; the menu item is disabled when it is down.
 */
export function ImportAudioDialog({ onClose }: { onClose: () => void }) {
  const currentTuning = useStore((s) => s.riff.tuning);
  const backend = useStore((s) => s.backend);
  const importDocument = useStore((s) => s.importDocument);
  const toast = useStore((s) => s.toast);

  const initialTuning =
    ALL_PRESETS.find((t) => t.pitches.join() === currentTuning.pitches.join())?.name ??
    'Bb Standard';
  const [files, setFiles] = useState<FileState[]>([]);
  const [tuning, setTuning] = useState(initialTuning);
  const [bpm, setBpm] = useState('');
  const [maxFret, setMaxFret] = useState(12);
  const [strings, setStrings] = useState('6,5,4,3');
  const [running, setRunning] = useState(false);
  const [openReport, setOpenReport] = useState<number | null>(null);

  const start = async () => {
    setRunning(true);
    const options = {
      tuning,
      bpm: bpm.trim() ? Number(bpm) : null,
      maxFret,
      strings: strings
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    };
    for (let i = 0; i < files.length; i++) {
      const entry = files[i]!;
      if (entry.status === 'done') continue;
      setFiles((prev) =>
        prev.map((f, j) => (j === i ? { ...f, status: 'running', message: 'analyzing...' } : f)),
      );
      try {
        const result: AnalyzeResult = await analyzeFile(entry.file, options, backend.url);
        importDocument({ kind: 'riff', value: result.riff }, entry.file.name);
        const low = result.report.lowConfidenceCount;
        setFiles((prev) =>
          prev.map((f, j) =>
            j === i
              ? {
                  ...f,
                  status: 'done',
                  message: `${result.report.noteCount} notes, ${result.report.bpm.toFixed(1)} bpm, ${low} low confidence`,
                  report: result.reportMarkdown,
                }
              : f,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setFiles((prev) => prev.map((f, j) => (j === i ? { ...f, status: 'failed', message } : f)));
        toast(`${entry.file.name}: ${message}`, 'warn');
      }
    }
    setRunning(false);
  };

  return (
    <div
      className="dialog-backdrop"
      data-testid="import-dialog"
      onClick={running ? undefined : onClose}
    >
      <div
        className="dialog import"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="import-title" className="dialog__title">
          import from audio
        </h2>
        <p className="dialog__message">
          backend{' '}
          {backend.status === 'ok' ? `ok (${backend.url})` : `unreachable at ${backend.url}`}. wav,
          flac, ogg, mp3 (with ffmpeg).
        </p>

        <label className="import__files">
          <span>recordings</span>
          <input
            type="file"
            multiple
            accept=".wav,.flac,.ogg,.aiff,.aif,.mp3,.m4a,audio/*"
            aria-label="recordings"
            data-testid="import-file-input"
            disabled={running}
            onChange={(e) => {
              const picked = [...(e.target.files ?? [])];
              setFiles(picked.map((file) => ({ file, status: 'pending', message: 'ready' })));
            }}
          />
        </label>

        <div className="dialog__form">
          <label className="dialog__field">
            <span>tuning</span>
            <select
              aria-label="import tuning"
              value={tuning}
              disabled={running}
              onChange={(e) => setTuning(e.target.value)}
            >
              {ALL_PRESETS.map((t) => (
                <option key={t.name}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="dialog__field">
            <span>bpm override</span>
            <input
              type="number"
              min={30}
              max={300}
              placeholder="detect"
              aria-label="bpm override"
              value={bpm}
              disabled={running}
              onChange={(e) => setBpm(e.target.value)}
            />
          </label>
          <label className="dialog__field">
            <span>max fret</span>
            <input
              type="number"
              min={5}
              max={24}
              aria-label="max fret"
              value={maxFret}
              disabled={running}
              onChange={(e) => setMaxFret(Number(e.target.value))}
            />
          </label>
          <label className="dialog__field">
            <span>strings</span>
            <input
              type="text"
              aria-label="strings to search"
              value={strings}
              disabled={running}
              onChange={(e) => setStrings(e.target.value)}
            />
          </label>
        </div>

        {files.length ? (
          <ul className="import__list" data-testid="import-list">
            {files.map((f, i) => (
              <li
                key={`${f.file.name}-${i}`}
                className={`import__item import__item--${f.status}`}
                data-import-status={f.status}
              >
                <span className="import__name">{f.file.name}</span>
                <span className="import__message">{f.message}</span>
                {f.report ? (
                  <button
                    type="button"
                    className="import__report-toggle"
                    onClick={() => setOpenReport(openReport === i ? null : i)}
                  >
                    {openReport === i ? 'hide report' : 'report'}
                  </button>
                ) : null}
                {openReport === i && f.report ? (
                  <pre className="import__report" data-testid="import-report">
                    {f.report}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="dialog__buttons">
          <button type="button" onClick={onClose} disabled={running}>
            {files.some((f) => f.status === 'done') ? 'close' : 'cancel'}
          </button>
          <button
            type="button"
            className="dialog__confirm"
            disabled={running || backend.status !== 'ok' || files.length === 0}
            onClick={() => void start()}
          >
            {running ? 'importing...' : 'import'}
          </button>
        </div>
      </div>
    </div>
  );
}
