import type { Note } from '@/model/types';
import { LANE_HEIGHT, laneY, tickToX } from './geometry';

/** A thin vertical bracket just left of notes that share a chordId. */
export function ChordBrackets({ notes, pxPerBar }: { notes: readonly Note[]; pxPerBar: number }) {
  const groups = new Map<string, Note[]>();
  for (const n of notes) {
    if (!n.chordId) continue;
    const g = groups.get(n.chordId) ?? [];
    g.push(n);
    groups.set(n.chordId, g);
  }
  const brackets = [];
  for (const [id, members] of groups) {
    if (members.length < 2) continue;
    const strings = members.map((m) => m.string);
    const x = tickToX(members[0]!.start, pxPerBar) - 3;
    const y1 = laneY(Math.min(...strings)) - LANE_HEIGHT * 0.39;
    const y2 = laneY(Math.max(...strings)) + LANE_HEIGHT * 0.39;
    brackets.push(
      <path
        key={id}
        className="tab-chord"
        data-chord-bracket={id}
        d={`M ${x + 3} ${y1} L ${x} ${y1} L ${x} ${y2} L ${x + 3} ${y2}`}
      />,
    );
  }
  return <g data-testid="chord-brackets">{brackets}</g>;
}
