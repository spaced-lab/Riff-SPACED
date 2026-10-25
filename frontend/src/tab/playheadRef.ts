/**
 * The playhead moves every animation frame. Re-rendering React 60 times a second for one
 * line is wasteful, so the audio engine writes the x attribute straight onto the SVG line
 * through this tiny registry (SPEC 5.4, DECISIONS 13).
 */
import { tickToX } from './geometry';

type Target = { line: SVGLineElement; pxPerBar: number };

let target: Target | null = null;
let lastTick = 0;

export const playhead = {
  register(line: SVGLineElement | null, pxPerBar: number): void {
    target = line ? { line, pxPerBar } : null;
    playhead.setTick(lastTick);
  },
  setTick(tick: number): void {
    lastTick = tick;
    if (!target) return;
    const x = tickToX(tick, target.pxPerBar);
    target.line.setAttribute('x1', String(x));
    target.line.setAttribute('x2', String(x));
  },
  currentTick(): number {
    return lastTick;
  },
};
