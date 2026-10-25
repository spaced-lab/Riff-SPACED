/**
 * The transport (SPEC 5.6): play/stop, loop, BPM with nudges, loop length, grid, count-in,
 * metronome, voice, solo indicator, and the position readout. Space and L are shortcuts.
 */
import { formatPosition, GRID_NAMES, LOOP_LENGTHS } from '@/music/time';
import type { GridName } from '@/music/time';
import { useStore } from '@/store';
import { selectDisplayRiff } from '@/store/derived';
import type { VoiceName } from '@/store/transportSlice';
import './transport.css';

export function TransportBar() {
  const isPlaying = useStore((s) => s.isPlaying);
  const togglePlay = useStore((s) => s.togglePlay);
  const stop = useStore((s) => s.stop);
  const loopEnabled = useStore((s) => s.loopEnabled);
  const setLoopEnabled = useStore((s) => s.setLoopEnabled);
  const display = useStore(selectDisplayRiff);
  const bpm = display.riff.tempo.bpm;
  const editing = useStore((s) => s.editing);
  const currentArrangementId = useStore((s) => s.currentArrangementId);
  const setArrangementTempo = useStore((s) => s.setArrangementTempo);
  const setRiffBpm = useStore((s) => s.setBpm);
  const nudgeRiffBpm = useStore((s) => s.nudgeBpm);
  // Tempo lives in the riff, or in the arrangement when one is open; songs follow their first arrangement.
  const setBpm = (value: number) =>
    editing === 'arrangement' && currentArrangementId
      ? setArrangementTempo(currentArrangementId, value)
      : editing === 'riff'
        ? setRiffBpm(value)
        : undefined;
  const nudgeBpm = (delta: number) =>
    editing === 'arrangement'
      ? setBpm(bpm + delta)
      : editing === 'riff'
        ? nudgeRiffBpm(delta)
        : undefined;
  const lengthBars = display.riff.lengthBars;
  const setLengthBars = useStore((s) => s.setLengthBars);
  const grid = useStore((s) => s.grid);
  const setGrid = useStore((s) => s.setGrid);
  const countIn = useStore((s) => s.countIn);
  const setCountIn = useStore((s) => s.setCountIn);
  const metronome = useStore((s) => s.metronome);
  const setMetronome = useStore((s) => s.setMetronome);
  const voice = useStore((s) => s.voice);
  const setVoice = useStore((s) => s.setVoice);
  const positionTick = useStore((s) => s.positionTick);
  const inCountIn = useStore((s) => s.inCountIn);
  const audioState = useStore((s) => s.audioState);
  const soloSectionId = useStore((s) => s.soloSectionId);
  const setSoloSection = useStore((s) => s.setSoloSection);
  const sections = display.riff.sections;
  const quantize = useStore((s) => s.quantizeSelection);
  const selectedCount = useStore((s) => s.selectedNoteIds.length);

  const solo = sections.find((s) => s.id === soloSectionId);

  return (
    <div className="transport" data-testid="transport">
      <button
        type="button"
        className={isPlaying ? 'transport__play transport__play--on' : 'transport__play'}
        onClick={togglePlay}
        aria-pressed={isPlaying}
        aria-label={isPlaying ? 'stop' : 'play'}
        title="Space"
      >
        {isPlaying ? '■ stop' : '▶ play'}
      </button>
      <button type="button" onClick={stop} aria-label="stop and reset" title="stop">
        ■
      </button>
      <button
        type="button"
        className={loopEnabled ? 'transport__toggle transport__toggle--on' : 'transport__toggle'}
        onClick={() => setLoopEnabled(!loopEnabled)}
        aria-pressed={loopEnabled}
        title="L"
      >
        loop
      </button>

      <label className="transport__bpm">
        bpm
        <button type="button" onClick={() => nudgeBpm(-5)} aria-label="bpm minus 5">
          -5
        </button>
        <button type="button" onClick={() => nudgeBpm(-1)} aria-label="bpm minus 1" title="-">
          -1
        </button>
        <input
          type="number"
          min={30}
          max={300}
          value={bpm}
          aria-label="bpm"
          onChange={(e) => setBpm(Number(e.target.value))}
        />
        <button type="button" onClick={() => nudgeBpm(1)} aria-label="bpm plus 1" title="=">
          +1
        </button>
        <button type="button" onClick={() => nudgeBpm(5)} aria-label="bpm plus 5">
          +5
        </button>
      </label>

      <label>
        loop
        <select
          aria-label="loop length"
          value={lengthBars}
          onChange={(e) => setLengthBars(Number(e.target.value))}
        >
          {LOOP_LENGTHS.map((n) => (
            <option key={n} value={n}>
              {n} bars
            </option>
          ))}
          {!(LOOP_LENGTHS as readonly number[]).includes(lengthBars) ? (
            <option value={lengthBars}>{lengthBars} bars</option>
          ) : null}
        </select>
      </label>
      <label>
        grid
        <select
          aria-label="grid"
          value={grid}
          onChange={(e) => setGrid(e.target.value as GridName)}
        >
          {GRID_NAMES.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </label>
      <label>
        <input type="checkbox" checked={countIn} onChange={(e) => setCountIn(e.target.checked)} />
        count-in
      </label>
      <label>
        <input
          type="checkbox"
          checked={metronome}
          onChange={(e) => setMetronome(e.target.checked)}
        />
        metronome
      </label>
      <label>
        voice
        <select
          aria-label="voice"
          value={voice}
          onChange={(e) => setVoice(e.target.value as VoiceName)}
        >
          <option value="basic">basic</option>
          <option value="heavy">heavy</option>
        </select>
      </label>
      <button
        type="button"
        onClick={quantize}
        disabled={selectedCount === 0}
        title="snap the selected notes to the grid"
      >
        quantize
      </button>

      {solo ? (
        <button
          type="button"
          className="transport__toggle transport__toggle--on"
          onClick={() => setSoloSection(null)}
          title="click to loop the whole riff"
        >
          solo {solo.label}
        </button>
      ) : null}

      <span className="transport__position" data-testid="position" aria-live="off">
        {inCountIn ? 'count-in' : formatPosition(positionTick)}
      </span>
      {audioState === 'suspended' ? (
        <span className="transport__hint" data-testid="audio-hint">
          tap to enable audio
        </span>
      ) : null}
      {audioState === 'unavailable' ? (
        <span className="transport__hint" data-testid="audio-hint">
          audio unavailable in this browser
        </span>
      ) : null}
    </div>
  );
}
