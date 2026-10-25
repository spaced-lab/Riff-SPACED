import { laneY, tickToX } from './geometry';

/** The dim dashed line where new notes go; moved by ruler clicks and arrow keys. */
export function EditCursor({
  tick,
  stringCount,
  pxPerBar,
}: {
  tick: number;
  stringCount: number;
  pxPerBar: number;
}) {
  const x = tickToX(tick, pxPerBar);
  return (
    <line
      className="tab-cursor"
      data-testid="edit-cursor"
      data-tick={tick}
      x1={x}
      x2={x}
      y1={0}
      y2={laneY(stringCount) + 14}
    />
  );
}
