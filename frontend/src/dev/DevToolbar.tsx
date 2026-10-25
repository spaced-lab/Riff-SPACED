/**
 * TEMPORARY. A plain toolbar for exercising the fretboard before the real menu bar exists.
 * Replaced by menu/MenuBar.tsx in P5.T1; its controls move into View, Tuning, and Transport.
 */
import { ALL_PRESETS, DROP_PRESETS, STANDARD_PRESETS, SEVEN_STRING_PRESETS } from '@/music/tuning';
import { useStore } from '@/store';
import { FRET_RANGE_PRESETS } from '@/store/viewSlice';
import './devToolbar.css';

export function DevToolbar() {
  const riff = useStore((s) => s.riff);
  const library = useStore((s) => s.library);
  const currentRiffId = useStore((s) => s.currentRiffId);
  const openRiff = useStore((s) => s.openRiff);
  const createRiff = useStore((s) => s.createRiff);
  const setTuning = useStore((s) => s.setTuning);
  const showLetters = useStore((s) => s.showLetters);
  const setShowLetters = useStore((s) => s.setShowLetters);
  const accidentals = useStore((s) => s.accidentals);
  const setAccidentals = useStore((s) => s.setAccidentals);
  const fretRange = useStore((s) => s.fretRange);
  const setFretRange = useStore((s) => s.setFretRange);
  const realistic = useStore((s) => s.realisticSpacing);
  const setRealistic = useStore((s) => s.setRealisticSpacing);
  const ghostNotes = useStore((s) => s.ghostNotes);
  const setGhostNotes = useStore((s) => s.setGhostNotes);
  const followPlayhead = useStore((s) => s.followPlayhead);
  const setFollowPlayhead = useStore((s) => s.setFollowPlayhead);

  const rangeLabel = `${fretRange.from}-${fretRange.to}`;
  const presetName =
    ALL_PRESETS.find((t) => t.pitches.join() === riff.tuning.pitches.join())?.name ?? 'Custom';

  return (
    <div className="dev-toolbar" data-testid="dev-toolbar">
      <label>
        riff
        <select value={currentRiffId ?? ''} onChange={(e) => openRiff(e.target.value)}>
          {library.riffs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={() => createRiff()}
        title="new empty riff in the current tuning"
      >
        new riff
      </button>

      <label>
        tuning
        <select
          value={presetName}
          onChange={(e) => {
            const preset = ALL_PRESETS.find((t) => t.name === e.target.value);
            if (preset) setTuning(preset);
          }}
        >
          <optgroup label="Standard">
            {STANDARD_PRESETS.map((t) => (
              <option key={t.name}>{t.name}</option>
            ))}
          </optgroup>
          <optgroup label="Drop">
            {DROP_PRESETS.map((t) => (
              <option key={t.name}>{t.name}</option>
            ))}
          </optgroup>
          <optgroup label="Seven string">
            {SEVEN_STRING_PRESETS.map((t) => (
              <option key={t.name}>{t.name}</option>
            ))}
          </optgroup>
          {presetName === 'Custom' ? <option>Custom</option> : null}
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={showLetters}
          onChange={(e) => setShowLetters(e.target.checked)}
        />
        Note letters
      </label>

      <label>
        <input
          type="checkbox"
          checked={accidentals === 'sharps'}
          onChange={(e) => setAccidentals(e.target.checked ? 'sharps' : 'flats')}
        />
        Sharps
      </label>

      <label>
        fret range
        <select
          value={rangeLabel}
          onChange={(e) => {
            const preset = FRET_RANGE_PRESETS.find((p) => p.label === e.target.value);
            if (preset) setFretRange(preset.range);
          }}
        >
          {FRET_RANGE_PRESETS.map((p) => (
            <option key={p.label}>{p.label}</option>
          ))}
          {!FRET_RANGE_PRESETS.some((p) => p.label === rangeLabel) ? (
            <option>{rangeLabel}</option>
          ) : null}
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={realistic}
          onChange={(e) => setRealistic(e.target.checked)}
        />
        Realistic spacing
      </label>

      <label>
        <input
          type="checkbox"
          checked={ghostNotes}
          onChange={(e) => setGhostNotes(e.target.checked)}
        />
        Ghost notes
      </label>

      <label>
        <input
          type="checkbox"
          checked={followPlayhead}
          onChange={(e) => setFollowPlayhead(e.target.checked)}
        />
        Follow playhead
      </label>

      <span className="dev-toolbar__status" data-testid="tuning-status">
        {riff.tuning.name}: {riff.tuning.pitches.join(' ')}
      </span>
    </div>
  );
}
