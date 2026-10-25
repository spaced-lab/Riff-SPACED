import { describe, expect, it } from 'vitest';
import { fixture } from './fixture';
import {
  barBeatTick,
  formatPosition,
  GRID,
  PPQ,
  secondsToTicks,
  snapToGrid,
  TICKS_PER_BAR,
  ticksToSeconds,
} from './time';
import type { GridName } from './time';

describe('time', () => {
  it('uses the fixture constants', () => {
    expect(PPQ).toBe(fixture.ticks.ppq);
    expect(TICKS_PER_BAR).toBe(fixture.ticks.bar);
  });

  it.each(Object.entries(fixture.ticks.grid))('grid %s is %d ticks', (name, ticks) => {
    expect(GRID[name as GridName]).toBe(ticks);
  });

  it.each(fixture.ticks.ticksToSeconds)('$ticks ticks at $bpm bpm is $seconds s', (c) => {
    expect(ticksToSeconds(c.ticks, c.bpm)).toBeCloseTo(c.seconds, 6);
    expect(secondsToTicks(c.seconds, c.bpm)).toBeCloseTo(c.ticks, 3);
  });

  it.each(fixture.ticks.barBeatTick)('tick $ticks reads $bar.$beat.$tick', (c) => {
    expect(barBeatTick(c.ticks)).toEqual({ bar: c.bar, beat: c.beat, tick: c.tick });
  });

  it.each(fixture.ticks.snapToGrid)('$ticks snaps to $snapped on $grid', (c) => {
    expect(snapToGrid(c.ticks, c.grid as GridName)).toBe(c.snapped);
  });

  it('formats the position readout 1-based with padding', () => {
    expect(formatPosition(2520)).toBe('02.2.120');
    expect(formatPosition(0)).toBe('01.1.000');
  });
});
