import { nameOf } from '@/music/naming';
import type { Accidentals } from '@/music/naming';
import type { Tuning } from '@/music/tuning';
import { pitchOf } from '@/music/tuning';
import type { Layout } from './geometry';
import { stringStroke } from './geometry';

type Props = { layout: Layout; tuning: Tuning; accidentals: Accidentals };

/** Horizontal strings, thicker toward the low side, with the open-string name in the gutter. */
export function StringLines({ layout, tuning, accidentals }: Props) {
  const n = tuning.pitches.length;
  const lines = [];
  for (let s = 1; s <= n; s++) {
    const y = layout.stringY(s);
    lines.push(
      <g key={s}>
        <line
          className="fb-string"
          data-string-line={s}
          x1={layout.nutX}
          x2={layout.rightX}
          y1={y}
          y2={y}
          strokeWidth={stringStroke(s, n)}
        />
        <text className="fb-string-label" x={layout.nutX - layout.dotRadius * 3} y={y}>
          {nameOf(pitchOf(tuning, s, 0), accidentals, false)}
        </text>
      </g>,
    );
  }
  return <g data-testid="string-lines">{lines}</g>;
}
