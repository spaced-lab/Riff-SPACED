import { describe, expect, it } from 'vitest';
import {
  LANE_HEIGHT,
  RULER_HEIGHT,
  laneY,
  noteBox,
  tabHeight,
  tabWidth,
  tickToX,
  xToTick,
  yToLane,
} from './geometry';

describe('tab geometry', () => {
  it.each([120, 320, 777, 1200])('tick/x round-trips at %d px per bar', (px) => {
    for (const tick of [0, 120, 480, 1919, 1920, 7680]) {
      expect(xToTick(tickToX(tick, px), px)).toBeCloseTo(tick, 6);
    }
    expect(tickToX(1920, px)).toBe(px);
  });

  it('lays lanes out with string 1 on top', () => {
    expect(laneY(1)).toBe(RULER_HEIGHT + LANE_HEIGHT / 2);
    expect(laneY(6)).toBe(RULER_HEIGHT + 5 * LANE_HEIGHT + LANE_HEIGHT / 2);
    expect(yToLane(laneY(3), 6)).toBe(3);
    expect(yToLane(-100, 6)).toBe(1);
    expect(yToLane(10_000, 6)).toBe(6);
    expect(tabHeight(6)).toBeGreaterThan(laneY(6));
  });

  it('sizes notes by start and duration with a minimum width', () => {
    const box = noteBox(6, 1920, 240, 320);
    expect(box.x).toBe(320);
    expect(box.width).toBeCloseTo(320 / 8 - 1);
    expect(box.y + box.height / 2).toBeCloseTo(laneY(6));
    expect(noteBox(1, 0, 1, 120).width).toBe(3);
    expect(tabWidth(4, 320)).toBeGreaterThan(1280);
  });
});
