import { useEffect, useRef } from 'react';
import { RULER_HEIGHT, laneY } from './geometry';
import { playhead } from './playheadRef';

/** The bright playback line. Its x is written by the engine through `playhead.setTick`. */
export function Playhead({ stringCount, pxPerBar }: { stringCount: number; pxPerBar: number }) {
  const ref = useRef<SVGLineElement>(null);
  useEffect(() => {
    playhead.register(ref.current, pxPerBar);
    return () => playhead.register(null, pxPerBar);
  }, [pxPerBar]);
  return (
    <line
      ref={ref}
      className="tab-playhead"
      data-testid="playhead"
      x1={0}
      x2={0}
      y1={RULER_HEIGHT}
      y2={laneY(stringCount) + 14}
    />
  );
}
