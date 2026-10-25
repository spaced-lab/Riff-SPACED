/**
 * Musical time in integer ticks (SPEC 3.4, DECISIONS 24).
 * 480 ticks per quarter note, 4/4 only in v1, so a bar is 1920 ticks and a sixteenth is 120.
 * Seconds appear only at the audio boundary; stored data never holds floating seconds.
 */

export const PPQ = 480;
export const BEATS_PER_BAR = 4;
export const TICKS_PER_BEAT = PPQ;
export const TICKS_PER_BAR = PPQ * BEATS_PER_BAR;

export type GridName = '1/4' | '1/8' | '1/16' | '1/8T' | '1/16T';

/** Grid resolution in ticks. Triplets divide the beat in three (480 / 3 = 160, 240 / 3 = 80). */
export const GRID: Readonly<Record<GridName, number>> = {
  '1/4': 480,
  '1/8': 240,
  '1/16': 120,
  '1/8T': 160,
  '1/16T': 80,
};

export const GRID_NAMES: readonly GridName[] = ['1/4', '1/8', '1/16', '1/8T', '1/16T'];

export const LOOP_LENGTHS = [4, 8, 12, 16] as const;
export type LoopLength = (typeof LOOP_LENGTHS)[number];

/** `t / ppq` is quarter notes; `60 / bpm` is seconds per quarter note. */
export function ticksToSeconds(ticks: number, bpm: number): number {
  return (ticks / PPQ) * (60 / bpm);
}

export function secondsToTicks(seconds: number, bpm: number): number {
  return (seconds * bpm * PPQ) / 60;
}

export type BarBeatTick = { bar: number; beat: number; tick: number };

/** Position readout, 1-based bar and beat, tick within the beat. Tick 2520 is bar 2, beat 2, tick 120. */
export function barBeatTick(ticks: number): BarBeatTick {
  const t = Math.max(0, Math.floor(ticks));
  return {
    bar: Math.floor(t / TICKS_PER_BAR) + 1,
    beat: Math.floor((t % TICKS_PER_BAR) / TICKS_PER_BEAT) + 1,
    tick: t % TICKS_PER_BEAT,
  };
}

export function formatPosition(ticks: number): string {
  const { bar, beat, tick } = barBeatTick(ticks);
  return `${String(bar).padStart(2, '0')}.${beat}.${String(tick).padStart(3, '0')}`;
}

/** Nearest grid point; exact halves round up, matching Math.round. */
export function snapToGrid(ticks: number, grid: GridName | number): number {
  const step = typeof grid === 'number' ? grid : GRID[grid];
  return Math.round(ticks / step) * step;
}

export function barsToTicks(bars: number): number {
  return bars * TICKS_PER_BAR;
}
