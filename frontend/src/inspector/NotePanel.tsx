import type { Note, Technique } from '@/model/types';
import { TECHNIQUES } from '@/model/types';
import { describeDyad, INTERVAL_MEANING } from '@/music/dyad';
import { FLAT_NAMES, SHARP_NAMES, nameOf } from '@/music/naming';
import { formatPosition } from '@/music/time';
import { pitchOf } from '@/music/tuning';
import { useStore } from '@/store';
import { selectDisplayRiff } from '@/store/derived';

/**
 * Selected note(s): position, pitch, timing, velocity, techniques, confidence. With exactly
 * two notes starting together it also names the dyad (SPEC 3.5), which is the owner's
 * main vocabulary: P5 power chord, P4 inverted with the root on top, m3, TT.
 */
export function NotePanel() {
  const display = useStore(selectDisplayRiff);
  const riff = display.riff;
  const readOnly = display.readOnly;
  const selectedNoteIds = useStore((s) => s.selectedNoteIds);
  const accidentals = useStore((s) => s.accidentals);
  const updateNote = useStore((s) => s.updateNote);

  const selected = riff.notes.filter((n) => selectedNoteIds.includes(n.id));
  if (selected.length === 0) {
    return (
      <div data-testid="note-panel">
        <h3>selection</h3>
        <p className="inspector__empty">no note selected. click a dot or a tab note.</p>
      </div>
    );
  }

  const names = accidentals === 'flats' ? FLAT_NAMES : SHARP_NAMES;
  const pitch = (n: Note) => pitchOf(riff.tuning, n.string, n.fret);
  const dyad =
    selected.length === 2 && selected[0]!.start === selected[1]!.start
      ? describeDyad(pitch(selected[0]!), pitch(selected[1]!))
      : null;

  const toggleTechnique = (note: Note, technique: Technique) => {
    if (readOnly) return;
    const current = note.techniques ?? [];
    const next = current.includes(technique)
      ? current.filter((t) => t !== technique)
      : [...current, technique];
    updateNote(note.id, { techniques: next });
  };

  return (
    <div data-testid="note-panel">
      <h3>
        selection: {selected.length} note{selected.length === 1 ? '' : 's'}
      </h3>
      {dyad ? (
        <div className="inspector__dyad" data-testid="dyad-info">
          <strong>{dyad.interval}</strong> {INTERVAL_MEANING[dyad.interval]}
          <div>
            root <strong>{names[dyad.rootPitchClass]}</strong>
            {dyad.lowerIsRoot ? '' : ', inverted (root on top)'}
          </div>
        </div>
      ) : null}
      {selected.slice(0, 4).map((n) => (
        <div key={n.id} className="inspector__note" data-testid={`note-fields-${n.id}`}>
          <div className="inspector__field">
            <span>where</span>
            <span>
              string {n.string} fret {n.fret} = {nameOf(pitch(n), accidentals, true)}
            </span>
          </div>
          <div className="inspector__field">
            <span>start</span>
            <span>{formatPosition(n.start)}</span>
          </div>
          <div className="inspector__field">
            <span>duration</span>
            <span>{n.duration} ticks</span>
          </div>
          <label className="inspector__field">
            <span>velocity</span>
            <input
              type="range"
              min={1}
              max={127}
              value={n.velocity ?? 100}
              aria-label={`velocity of ${n.id}`}
              disabled={readOnly}
              onChange={(e) => updateNote(n.id, { velocity: Number(e.target.value) })}
            />
          </label>
          <div className="inspector__field">
            <span>confidence</span>
            <span>
              {(n.confidence ?? 1).toFixed(2)}
              {n.unplayable ? ', unplayable' : ''}
            </span>
          </div>
          <div className="inspector__techniques">
            {TECHNIQUES.map((t) => (
              <label key={t}>
                <input
                  type="checkbox"
                  checked={n.techniques?.includes(t) ?? false}
                  disabled={readOnly}
                  onChange={() => toggleTechnique(n, t)}
                />
                {t}
              </label>
            ))}
          </div>
        </div>
      ))}
      {selected.length > 4 ? (
        <p className="inspector__empty">and {selected.length - 4} more</p>
      ) : null}
    </div>
  );
}
