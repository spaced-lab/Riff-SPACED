import { useMemo } from 'react';
import type { ArrangementEntry } from '@/model/types';
import { useStore } from '@/store';
import { moveIndex } from '@/store/libraryOps';
import { arrangementLengthBars, arrangementTuning } from './flatten';
import './arrangement.css';

/**
 * Arrangement editor (SPEC 4.2, P5.T3): an ordered list of riff entries with repeats,
 * transpose, and a label; reorder with the arrows, add from the library, remove. Every
 * riff must share the arrangement's tuning; on a mismatch the store offers to retune it.
 * The tab lanes below show the flattened result read-only.
 */
export function ArrangementEditor() {
  const library = useStore((s) => s.library);
  const id = useStore((s) => s.currentArrangementId);
  const setEntries = useStore((s) => s.setArrangementEntries);
  const toast = useStore((s) => s.toast);
  const renameItem = useStore((s) => s.renameItem);
  const openRiff = useStore((s) => s.openRiff);
  const arrangement = library.arrangements.find((a) => a.id === id);
  const tuning = useMemo(
    () => (arrangement ? arrangementTuning(arrangement, library) : null),
    [arrangement, library],
  );
  const riffsById = useMemo(() => new Map(library.riffs.map((r) => [r.id, r])), [library.riffs]);
  const appendRiff = useStore((s) => s.appendRiffOrOfferRetune);

  if (!arrangement) return null;
  const totalBars = arrangementLengthBars(arrangement, library);
  // Every riff is offered; one in another tuning triggers the retune offer (P8.T1).
  const candidates = library.riffs;

  const apply = (entries: ArrangementEntry[]) => {
    const error = setEntries(arrangement.id, entries);
    if (error) toast(error, 'warn');
  };
  const patch = (i: number, p: Partial<ArrangementEntry>) =>
    apply(arrangement.entries.map((e, j) => (j === i ? { ...e, ...p } : e)));

  return (
    <section className="arr" data-testid="arrangement-editor" aria-label="arrangement editor">
      <header className="arr__header">
        <input
          className="arr__name"
          aria-label="arrangement name"
          value={arrangement.name}
          onChange={(e) => renameItem('arrangements', arrangement.id, e.target.value)}
        />
        <span className="arr__meta" data-testid="arrangement-meta">
          {arrangement.entries.length} entries · {totalBars} bars · {arrangement.tempo.bpm} bpm ·{' '}
          {tuning ? tuning.name : 'no tuning yet'}
        </span>
      </header>
      <ol className="arr__entries">
        {arrangement.entries.length === 0 ? (
          <li className="arr__empty">
            no entries yet. add a riff below or drag one from the library.
          </li>
        ) : null}
        {arrangement.entries.map((e, i) => {
          const riff = riffsById.get(e.riffId);
          return (
            <li key={`${e.riffId}-${i}`} className="arr__entry" data-arrangement-entry={i}>
              <span className="arr__index">{i + 1}</span>
              <button
                type="button"
                className="arr__riff"
                title="open this riff"
                onClick={() => openRiff(e.riffId)}
              >
                {riff?.name ?? 'missing riff'}
              </button>
              <label>
                x
                <input
                  type="number"
                  min={1}
                  max={64}
                  aria-label={`repeats of entry ${i + 1}`}
                  value={e.repeats}
                  onChange={(ev) => patch(i, { repeats: Number(ev.target.value) })}
                />
              </label>
              <label>
                transpose
                <input
                  type="number"
                  min={-24}
                  max={24}
                  aria-label={`transpose of entry ${i + 1}`}
                  value={e.transpose ?? 0}
                  onChange={(ev) => patch(i, { transpose: Number(ev.target.value) })}
                />
              </label>
              <input
                className="arr__label"
                aria-label={`label of entry ${i + 1}`}
                placeholder="label"
                value={e.label ?? ''}
                onChange={(ev) => patch(i, { label: ev.target.value })}
              />
              <button
                type="button"
                aria-label={`move entry ${i + 1} up`}
                disabled={i === 0}
                onClick={() => apply(moveIndex(arrangement.entries, i, i - 1))}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`move entry ${i + 1} down`}
                disabled={i === arrangement.entries.length - 1}
                onClick={() => apply(moveIndex(arrangement.entries, i, i + 1))}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`remove entry ${i + 1}`}
                onClick={() => apply(arrangement.entries.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </li>
          );
        })}
      </ol>
      <div className="arr__add">
        <label>
          add riff
          <select
            aria-label="add riff to arrangement"
            value=""
            onChange={(ev) => {
              // Through the store's append so a riff in another tuning gets the retune offer.
              if (riffsById.has(ev.target.value)) appendRiff(arrangement.id, ev.target.value);
            }}
          >
            <option value="">choose a riff</option>
            {candidates.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
