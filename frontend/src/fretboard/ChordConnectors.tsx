import type { Note } from '@/model/types';
import type { Layout } from './geometry';

type Props = { layout: Layout; notes: readonly Note[]; soundingIds: ReadonlySet<string> };

/** A thin line joining notes that share a chordId: the fingering hint for a dyad or chord. */
export function ChordConnectors({ layout, notes, soundingIds }: Props) {
  const groups = new Map<string, Note[]>();
  for (const n of notes) {
    if (!n.chordId) continue;
    const g = groups.get(n.chordId) ?? [];
    g.push(n);
    groups.set(n.chordId, g);
  }
  const lines = [];
  for (const [chordId, members] of groups) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) => a.string - b.string);
    const sounding = sorted.some((n) => soundingIds.has(n.id));
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1]!;
      const b = sorted[i]!;
      lines.push(
        <line
          key={`${chordId}-${a.id}-${b.id}`}
          className={sounding ? 'fb-connector fb-connector--sounding' : 'fb-connector'}
          data-connector={chordId}
          x1={layout.noteX(a.fret)}
          y1={layout.stringY(a.string)}
          x2={layout.noteX(b.fret)}
          y2={layout.stringY(b.string)}
        />,
      );
    }
  }
  return <g data-testid="chord-connectors">{lines}</g>;
}
