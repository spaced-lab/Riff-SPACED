import type { Layout } from './geometry';

/** Vertical fret wires; the leftmost one is the nut when the view starts at fret 0. */
export function FretWires({ layout }: { layout: Layout }) {
  const { range, stringY, stringCount, fretX } = layout;
  const top = stringY(1) - layout.stringGap * 0.45;
  const bottom = stringY(stringCount) + layout.stringGap * 0.45;
  const wires = [];
  for (let f = range.from; f <= range.to; f++) {
    const isNut = f === 0;
    wires.push(
      <line
        key={f}
        className={isNut ? 'fb-wire fb-wire--nut' : 'fb-wire'}
        data-fret-wire={f}
        x1={fretX(f)}
        x2={fretX(f)}
        y1={top}
        y2={bottom}
      />,
    );
  }
  return <g data-testid="fret-wires">{wires}</g>;
}
