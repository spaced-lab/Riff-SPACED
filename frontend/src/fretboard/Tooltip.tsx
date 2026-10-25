export type TooltipState = { x: number; y: number; text: string } | null;

/** Hover text such as `string 6 fret 3 = Db2`, positioned above the pointer target. */
export function Tooltip({ state }: { state: TooltipState }) {
  if (!state) return null;
  return (
    <div className="fb-tooltip" role="tooltip" style={{ left: state.x, top: state.y - 10 }}>
      {state.text}
    </div>
  );
}
