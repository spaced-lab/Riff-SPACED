import type { Layout } from './geometry';

/** Position markers between the wires: dim circles, two at the octave frets. */
export function Markers({ layout }: { layout: Layout }) {
  const mid = (layout.stringY(1) + layout.stringY(layout.stringCount)) / 2;
  const r = Math.max(2, layout.dotRadius * 0.45);
  return (
    <g data-testid="markers">
      {layout.markers.map((m) =>
        m.double ? (
          <g key={m.fret} data-marker={m.fret}>
            <circle className="fb-marker" cx={m.x} cy={mid - layout.stringGap} r={r} />
            <circle className="fb-marker" cx={m.x} cy={mid + layout.stringGap} r={r} />
          </g>
        ) : (
          <circle key={m.fret} data-marker={m.fret} className="fb-marker" cx={m.x} cy={mid} r={r} />
        ),
      )}
    </g>
  );
}
