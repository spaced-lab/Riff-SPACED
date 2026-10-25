import { useEffect, useMemo, useState } from 'react';
import { findEasierTunings } from '@/music/tuningSearch';
import { useStore } from '@/store';
import './tuning.css';

/**
 * Tuning > Find easier tuning (SPEC 3.7, P8.T2). Lists the best candidates with the score
 * breakdown; Preview shows the refingered riff on the fretboard without changing anything,
 * Apply retunes keeping pitches (one undo step). Closing clears the preview.
 */
export function EasierTuningDialog({ onClose }: { onClose: () => void }) {
  const riff = useStore((s) => s.riff);
  const setTuning = useStore((s) => s.setTuning);
  const setPreviewRiff = useStore((s) => s.setPreviewRiff);
  const toast = useStore((s) => s.toast);
  const candidates = useMemo(() => findEasierTunings(riff, 5), [riff]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => () => setPreviewRiff(null), [setPreviewRiff]);

  const preview = (i: number) => {
    const next = previewIndex === i ? null : i;
    setPreviewIndex(next);
    setPreviewRiff(next === null ? null : candidates[next]!.riff);
  };
  const apply = (i: number) => {
    const c = candidates[i]!;
    setPreviewRiff(null);
    const flagged = setTuning(c.tuning, 'keepPitches');
    toast(
      flagged
        ? `retuned to ${c.tuning.name}: ${flagged} notes flagged unplayable`
        : `retuned to ${c.tuning.name}, pitches kept`,
      flagged ? 'warn' : 'info',
    );
    onClose();
  };

  return (
    <div className="dialog-backdrop" data-testid="easier-tuning-dialog" onClick={onClose}>
      <div
        className="dialog easier"
        role="dialog"
        aria-modal="true"
        aria-labelledby="easier-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="easier-title" className="dialog__title">
          find easier tuning
        </h2>
        <p className="dialog__message">
          every preset with {riff.tuning.pitches.length} strings and every one-string change of up
          to two semitones, refingered with the pitches kept. lower score is easier: 2 per
          unreachable note, 0.5 per fret of span, 0.2 per fret the hand moves.
        </p>
        <table className="dialog__table easier__table">
          <thead>
            <tr>
              <th>tuning</th>
              <th>open strings</th>
              <th>unreachable</th>
              <th>span</th>
              <th>moves</th>
              <th>score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c, i) => (
              <tr
                key={c.tuning.pitches.join()}
                data-testid="easier-row"
                data-current={c.current ? 'true' : undefined}
                className={previewIndex === i ? 'easier__row--preview' : undefined}
              >
                <td>
                  {c.tuning.name}
                  {c.current ? ' (current)' : ''}
                </td>
                <td>{c.tuning.pitches.join(' ')}</td>
                <td>{c.unplayable}</td>
                <td>{c.totalSpan}</td>
                <td>{c.handMovement}</td>
                <td>{c.score.toFixed(1)}</td>
                <td className="easier__actions">
                  <button type="button" onClick={() => preview(i)} disabled={c.current}>
                    {previewIndex === i ? 'unpreview' : 'preview'}
                  </button>
                  <button type="button" onClick={() => apply(i)} disabled={c.current}>
                    apply
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="dialog__buttons">
          <button type="button" onClick={onClose}>
            close
          </button>
        </div>
      </div>
    </div>
  );
}
