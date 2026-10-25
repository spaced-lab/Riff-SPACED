import type { GridName } from '@/music/time';
import { GRID, TICKS_PER_BAR, TICKS_PER_BEAT } from '@/music/time';
import { RULER_HEIGHT, laneY, tickToX } from './geometry';

type Props = { lengthBars: number; stringCount: number; grid: GridName; pxPerBar: number };

/** Bar, beat, and grid-step lines in three stroke weights, plus a faint line per lane. */
export function GridLines({ lengthBars, stringCount, grid, pxPerBar }: Props) {
  const top = RULER_HEIGHT;
  const bottom = laneY(stringCount) + 14;
  const total = lengthBars * TICKS_PER_BAR;
  const step = GRID[grid];
  const lines = [];
  for (let t = 0; t <= total; t += step) {
    const isBar = t % TICKS_PER_BAR === 0;
    const isBeat = t % TICKS_PER_BEAT === 0;
    const cls = isBar ? 'tab-grid__bar' : isBeat ? 'tab-grid__beat' : 'tab-grid__step';
    const x = tickToX(t, pxPerBar);
    lines.push(
      <line
        key={t}
        className={cls}
        data-grid-line={isBar ? 'bar' : isBeat ? 'beat' : 'step'}
        x1={x}
        x2={x}
        y1={isBar ? 0 : top}
        y2={bottom}
      />,
    );
  }
  const lanes = [];
  for (let s = 1; s <= stringCount; s++) {
    const y = laneY(s);
    lanes.push(
      <line
        key={s}
        className="tab-lane__line"
        data-lane={s}
        x1={0}
        x2={tickToX(total, pxPerBar)}
        y1={y}
        y2={y}
      />,
    );
  }
  return (
    <g data-testid="tab-grid">
      {lanes}
      {lines}
    </g>
  );
}
