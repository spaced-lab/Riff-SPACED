import type { AiDyad } from '@/api/ai';
import type { Note } from '@/model/types';
import { LANE_HEIGHT, laneY, tickToX } from './geometry';

/** Small interval labels above chord brackets, from the AI analysis (View > Dyad labels). */
export function DyadLabels({
  notes,
  dyads,
  pxPerBar,
}: {
  notes: readonly Note[];
  dyads: readonly AiDyad[];
  pxPerBar: number;
}) {
  const firstOf = new Map<string, Note>();
  for (const n of notes) {
    if (!n.chordId) continue;
    const seen = firstOf.get(n.chordId);
    if (!seen || n.string < seen.string) firstOf.set(n.chordId, n);
  }
  return (
    <g data-testid="dyad-labels">
      {dyads.map((d) => {
        const top = firstOf.get(d.chordId);
        if (!top) return null;
        return (
          <text
            key={d.chordId}
            className={
              d.source === 'computed' ? 'tab-dyad-label tab-dyad-label--computed' : 'tab-dyad-label'
            }
            x={tickToX(top.start, pxPerBar) + 2}
            y={laneY(top.string) - LANE_HEIGHT * 0.62}
            data-dyad-label={d.chordId}
          >
            {d.label}
            {d.inverted ? ' (inv)' : ''}
          </text>
        );
      })}
    </g>
  );
}
