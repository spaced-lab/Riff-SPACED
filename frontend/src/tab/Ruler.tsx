import type { Section } from '@/model/types';
import { TICKS_PER_BAR } from '@/music/time';
import { RULER_HEIGHT, tickToX } from './geometry';

type Props = {
  lengthBars: number;
  sections: readonly Section[];
  pxPerBar: number;
  onClickTick?: (tick: number) => void;
};

/** Bar numbers (1-based) and section labels along the top; clicking moves the edit cursor. */
export function Ruler({ lengthBars, sections, pxPerBar, onClickTick }: Props) {
  const bars = [];
  for (let b = 0; b < lengthBars; b++) {
    bars.push(
      <text
        key={b}
        className="tab-ruler__bar"
        x={tickToX(b * TICKS_PER_BAR, pxPerBar) + 4}
        y={RULER_HEIGHT - 8}
        data-bar-number={b + 1}
      >
        {b + 1}
      </text>,
    );
  }
  return (
    <g data-testid="tab-ruler">
      <rect
        className="tab-ruler__hit"
        x={0}
        y={0}
        width={tickToX(lengthBars * TICKS_PER_BAR, pxPerBar)}
        height={RULER_HEIGHT}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const tick = ((e.clientX - rect.left) / pxPerBar) * TICKS_PER_BAR;
          onClickTick?.(tick);
        }}
      />
      {bars}
      {sections.map((s) => (
        <text
          key={s.id}
          className="tab-ruler__section"
          x={tickToX(s.startBar * TICKS_PER_BAR, pxPerBar) + 18}
          y={RULER_HEIGHT - 8}
          data-section-label={s.id}
        >
          {s.label} · {s.kind}
        </text>
      ))}
    </g>
  );
}
