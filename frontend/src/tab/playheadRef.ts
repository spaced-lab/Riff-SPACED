/**
 * The playhead moves every animation frame. Re-rendering React 60 times a second for one
 * line is wasteful, so the audio engine writes the x attribute straight onto the SVG line
 * through this tiny registry (SPEC 5.4, DECISIONS 13).
 */
import { tickToX } from './geometry';

type Target = { line: SVGLineElement; pxPerBar: number };

let target: Target | null = null;
let lastTick = 0;
let scroller: HTMLElement | null = null;
let follow = true;

/** Keep the playhead inside the middle 60 percent of the scroll viewport (SPEC 5.4). */
function followIfNeeded(x: number): void {
  if (!follow || !scroller) return;
  const width = scroller.clientWidth;
  if (width <= 0) return;
  const left = scroller.scrollLeft;
  if (x < left + width * 0.2 || x > left + width * 0.8) {
    scroller.scrollLeft = Math.max(0, x - width * 0.5);
  }
}

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
    followIfNeeded(x);
  },
  /** The horizontally scrolling container the lanes live in, for follow mode. */
  setScroller(el: HTMLElement | null): void {
    scroller = el;
  },
  setFollow(on: boolean): void {
    follow = on;
  },
  currentTick(): number {
    return lastTick;
  },
};
