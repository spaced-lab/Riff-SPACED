/**
 * Transport bar. Phase 3 ships the editing controls (loop length, grid, quantize);
 * Phase 4 adds play/stop, BPM, loop, count-in, metronome, and the position readout.
 */
import { GRID_NAMES, LOOP_LENGTHS } from '@/music/time';
import type { GridName } from '@/music/time';
import { useStore } from '@/store';
import './transport.css';

export function TransportBar() {
  const lengthBars = useStore((s) => s.riff.lengthBars);
  const setLengthBars = useStore((s) => s.setLengthBars);
  const grid = useStore((s) => s.grid);
  const setGrid = useStore((s) => s.setGrid);
  const quantize = useStore((s) => s.quantizeSelection);
  const selectedCount = useStore((s) => s.selectedNoteIds.length);

  return (
    <div className="transport" data-testid="transport">
      <span className="transport__placeholder">play / stop / bpm: phase 4</span>
      <label>
        loop
        <select value={lengthBars} onChange={(e) => setLengthBars(Number(e.target.value))}>
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
        <select value={grid} onChange={(e) => setGrid(e.target.value as GridName)}>
          {GRID_NAMES.map((g) => (
            <option key={g}>{g}</option>
          ))}
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
    </div>
  );
}
