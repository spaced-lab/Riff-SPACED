import { useMemo } from 'react';
import { arrangementLengthBars } from '@/arrangement/flatten';
import { TICKS_PER_BAR, ticksToSeconds } from '@/music/time';
import { useStore } from '@/store';
import { moveIndex } from '@/store/libraryOps';
import '@/arrangement/arrangement.css';

/** Song editor (SPEC 4.3, P5.T3): ordered arrangement parts with labels, notes, total length. */
export function SongEditor() {
  const library = useStore((s) => s.library);
  const id = useStore((s) => s.currentSongId);
  const setParts = useStore((s) => s.setSongParts);
  const setNotes = useStore((s) => s.setSongNotes);
  const renameItem = useStore((s) => s.renameItem);
  const openArrangement = useStore((s) => s.openArrangement);
  const song = library.songs.find((s) => s.id === id);
  const arrangementsById = useMemo(
    () => new Map(library.arrangements.map((a) => [a.id, a])),
    [library.arrangements],
  );

  if (!song) return null;
  const parts = song.parts;
  const totalBars = parts.reduce((sum, p) => {
    const a = arrangementsById.get(p.arrangementId);
    return sum + (a ? arrangementLengthBars(a, library) : 0);
  }, 0);
  const bpm = arrangementsById.get(parts[0]?.arrangementId ?? '')?.tempo.bpm ?? 92;
  const seconds = ticksToSeconds(totalBars * TICKS_PER_BAR, bpm);
  const mmss = `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

  return (
    <section className="song" data-testid="song-editor" aria-label="song editor">
      <header className="song__header">
        <input
          className="song__title"
          aria-label="song title"
          value={song.title}
          onChange={(e) => renameItem('songs', song.id, e.target.value)}
        />
        <span className="song__meta" data-testid="song-meta">
          {parts.length} parts · {totalBars} bars · about {mmss} at {bpm} bpm · {song.tuning.name}
        </span>
      </header>
      <ol className="song__parts">
        {parts.length === 0 ? (
          <li className="song__empty">no parts yet. add an arrangement below.</li>
        ) : null}
        {parts.map((p, i) => {
          const a = arrangementsById.get(p.arrangementId);
          return (
            <li key={`${p.arrangementId}-${i}`} className="song__part" data-song-part={i}>
              <span className="arr__index">{i + 1}</span>
              <button
                type="button"
                className="arr__riff"
                title="open this arrangement"
                onClick={() => openArrangement(p.arrangementId)}
              >
                {a?.name ?? 'missing arrangement'}
              </button>
              <input
                className="song__label"
                aria-label={`label of part ${i + 1}`}
                placeholder="label"
                value={p.label ?? ''}
                onChange={(ev) =>
                  setParts(
                    song.id,
                    parts.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)),
                  )
                }
              />
              <span className="song__meta">
                {a ? `${arrangementLengthBars(a, library)} bars` : ''}
              </span>
              <button
                type="button"
                aria-label={`move part ${i + 1} up`}
                disabled={i === 0}
                onClick={() => setParts(song.id, moveIndex(parts, i, i - 1))}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`move part ${i + 1} down`}
                disabled={i === parts.length - 1}
                onClick={() => setParts(song.id, moveIndex(parts, i, i + 1))}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`remove part ${i + 1}`}
                onClick={() =>
                  setParts(
                    song.id,
                    parts.filter((_, j) => j !== i),
                  )
                }
              >
                ×
              </button>
            </li>
          );
        })}
      </ol>
      <div className="song__add">
        <label>
          add arrangement
          <select
            aria-label="add arrangement to song"
            value=""
            onChange={(ev) => {
              const a = arrangementsById.get(ev.target.value);
              if (a) setParts(song.id, [...parts, { arrangementId: a.id, label: a.name }]);
            }}
          >
            <option value="">choose an arrangement</option>
            {library.arrangements.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <textarea
        className="song__notes"
        aria-label="song notes"
        placeholder="notes"
        value={song.notes ?? ''}
        onChange={(e) => setNotes(song.id, e.target.value)}
      />
    </section>
  );
}
