/**
 * Tab lane layout (SPEC 5.4): time flows left to right, one lane per string, string 1 on
 * top. Pure functions; `pxPerBar` is the zoom level. The x axis starts at 0 inside the
 * scrolling area; the fixed gutter with string labels lives outside it.
 */
import { TICKS_PER_BAR } from '@/music/time';

export const RULER_HEIGHT = 22;
export const LANE_HEIGHT = 28;
export const BOTTOM_PAD = 8;
export const RIGHT_PAD = 24;
export const GUTTER_WIDTH = 44;

export function tickToX(tick: number, pxPerBar: number): number {
  return (tick / TICKS_PER_BAR) * pxPerBar;
}

export function xToTick(x: number, pxPerBar: number): number {
  return (x / pxPerBar) * TICKS_PER_BAR;
}

/** Vertical center of a string's lane; string 1 at the top. */
export function laneY(string: number): number {
  return RULER_HEIGHT + (string - 1) * LANE_HEIGHT + LANE_HEIGHT / 2;
}

/** Which lane (string number) a y coordinate falls in, clamped to 1..stringCount. */
export function yToLane(y: number, stringCount: number): number {
  const lane = Math.floor((y - RULER_HEIGHT) / LANE_HEIGHT) + 1;
  return Math.max(1, Math.min(stringCount, lane));
}

export function tabHeight(stringCount: number): number {
  return RULER_HEIGHT + stringCount * LANE_HEIGHT + BOTTOM_PAD;
}

export function tabWidth(lengthBars: number, pxPerBar: number): number {
  return lengthBars * pxPerBar + RIGHT_PAD;
}

export type NoteBox = { x: number; y: number; width: number; height: number };

/** Rectangle for a note from `start` for `duration` ticks on `string`. */
export function noteBox(
  string: number,
  start: number,
  duration: number,
  pxPerBar: number,
): NoteBox {
  const x = tickToX(start, pxPerBar);
  const width = Math.max(3, tickToX(duration, pxPerBar) - 1);
  const height = LANE_HEIGHT * 0.78;
  return { x, y: laneY(string) - height / 2, width, height };
}
