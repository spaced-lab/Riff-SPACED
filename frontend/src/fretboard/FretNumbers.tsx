import type { Layout } from './geometry';

/** Fret numbers above the neck; marker frets are brighter so the eye finds 3, 5, 7, 12. */
export function FretNumbers({ layout }: { layout: Layout }) {
  const markerFrets = new Set(layout.markers.map((m) => m.fret));
  const numbers = [];
  for (let f = Math.max(1, layout.range.from + 1); f <= layout.range.to; f++) {
    numbers.push(
      <text
        key={f}
        className={markerFrets.has(f) ? 'fb-fret-number fb-fret-number--marker' : 'fb-fret-number'}
        x={layout.noteX(f)}
        y={layout.stringY(1) - layout.stringGap * 0.75}
      >
        {f}
      </text>,
    );
  }
  return <g data-testid="fret-numbers">{numbers}</g>;
}
