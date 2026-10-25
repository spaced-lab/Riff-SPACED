import type { ColorGroup, Degree } from '@/music/scales';
import { degreeClass, groupOf } from '@/music/scales';
import { cellKey } from '@/music/positions';
import type { Position } from '@/music/positions';
import { pitchClass } from '@/music/pitch';
import { pitchOf } from '@/music/tuning';
import type { Tuning } from '@/music/tuning';
import type { Layout } from './geometry';

/**
 * What the fretboard needs to draw a scale (Phase 9): the pitch-class table from
 * `degreesOf`, the mode, and which degree groups are colored. Built by `selectScaleOverlay`
 * so the component stays presentational.
 */
export type ScaleOverlay = {
  /** Index: pitch class 0..11. Value: the degree at that pitch class, or null. */
  table: readonly (Degree | null)[];
  mode: 'color' | 'mono';
  colored: Readonly<Record<ColorGroup, boolean>>;
  /** `Bb Minor Pentatonic`, for the legend and the tooltip. */
  title: string;
  /** The hand position to highlight (P9.T5); dots outside it are dimmed. Null: whole neck. */
  position?: Position | null;
};

type Props = {
  layout: Layout;
  tuning: Tuning;
  overlay: ScaleOverlay;
  /** Note name for a cell, drawn inside the dot when the board is tall enough to read it. */
  letterOf?: (string: number, fret: number) => string;
};

/** Below this dot radius a letter would be unreadable, so none is drawn. */
export const MIN_LETTER_RADIUS = 8;

/**
 * One small dot on every (string, fret) whose pitch is in the scale, drawn under the riff
 * notes. A degree gets its color only in color mode with its group switched on; otherwise it
 * is the plain ring, so a player can switch everything off but roots and see only where the
 * roots sit. Roots are drawn a little larger whatever the mode: they anchor the shape.
 */
export function ScaleDots({ layout, tuning, overlay, letterOf }: Props) {
  const dots = [];
  for (let s = 1; s <= layout.stringCount; s++) {
    for (let f = layout.range.from; f <= layout.range.to; f++) {
      const degree = overlay.table[pitchClass(pitchOf(tuning, s, f))];
      if (!degree) continue;
      const colored = overlay.mode === 'color' && overlay.colored[groupOf(degree.role)];
      const classes = [
        'fb-scale',
        colored ? `fb-scale--${degreeClass(degree)}` : 'fb-scale--plain',
      ];
      if (degree.role === 'root') classes.push('fb-scale--is-root');
      const inPosition = !overlay.position || overlay.position.cells.has(cellKey(s, f));
      if (!inPosition) classes.push('fb-scale--dimmed');
      const r = layout.dotRadius * (degree.role === 'root' ? 0.62 : 0.5);
      const x = layout.noteX(f);
      const y = layout.stringY(s);
      const letter = letterOf && r >= MIN_LETTER_RADIUS ? letterOf(s, f) : null;
      dots.push(
        <g
          key={`${s}-${f}`}
          className={classes.join(' ')}
          data-scale-dot
          data-string={s}
          data-fret={f}
          data-degree={degree.label}
          data-in-position={inPosition ? 'true' : 'false'}
        >
          <circle cx={x} cy={y} r={r} />
          {letter ? (
            <text x={x} y={y} fontSize={r * 1.05}>
              {letter}
            </text>
          ) : null}
        </g>,
      );
    }
  }
  return (
    <g data-testid="scale-dots" aria-label={`${overlay.title} scale`}>
      {dots}
    </g>
  );
}
