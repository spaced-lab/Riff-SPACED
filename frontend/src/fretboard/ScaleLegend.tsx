import type { Position } from '@/music/positions';
import type { ColorGroup, Degree } from '@/music/scales';
import { degreeClass, groupOf } from '@/music/scales';
import type { ScaleOverlay } from './ScaleDots';
import './scaleLegend.css';

type Props = {
  overlay: ScaleOverlay;
  /** The degrees of the scale in ascending order, for the swatch row. */
  degrees: readonly Degree[];
  onToggleGroup: (group: ColorGroup) => void;
  onMode: (mode: 'off' | 'color' | 'mono') => void;
  /** CAGED positions of the scale in this tuning (P9.T5), and the one highlighted. */
  positions?: readonly Position[];
  onStepPosition?: (delta: 1 | -1) => void;
  onClearPosition?: () => void;
  /** Wide fretboard toggle (hide the side panels); omitted in tests and previews. */
  wide?: boolean;
  onWide?: (on: boolean) => void;
  /** How much neck to show: follow the position, or all 24 frets. */
  neck?: 'follow' | 'all';
  onNeck?: (neck: 'follow' | 'all') => void;
};

/**
 * The strip above the fretboard while a scale is shown: the scale title, one swatch per
 * degree, and the mode switch. Each swatch is a button that toggles its degree group, so the
 * legend is also the control panel (the menu has the same switches). The swatches reuse the
 * fretboard's `fb-scale--*` classes, so legend and neck can never disagree on a color.
 */
export function ScaleLegend({
  overlay,
  degrees,
  onToggleGroup,
  onMode,
  positions = [],
  onStepPosition,
  onClearPosition,
  wide = false,
  onWide,
  neck = 'follow',
  onNeck,
}: Props) {
  const position = overlay.position ?? null;
  return (
    <div className="scale-legend" data-testid="scale-legend" role="toolbar" aria-label="scale">
      <span className="scale-legend__title" data-testid="scale-title">
        {overlay.title}
      </span>
      {positions.length > 0 && onStepPosition ? (
        <span className="scale-legend__position" data-testid="scale-position">
          <button
            type="button"
            className="scale-legend__step"
            aria-label="position down"
            title="previous hand position (shortcut: <)"
            onClick={() => onStepPosition(-1)}
          >
            ◂
          </button>
          <button
            type="button"
            className="scale-legend__position-name"
            data-testid="scale-position-name"
            title={
              position
                ? 'back to the whole neck'
                : 'step with the arrows to highlight one hand position'
            }
            onClick={onClearPosition}
          >
            {position
              ? `${position.name}, frets ${position.fromFret}-${position.toFret} (${position.index + 1}/${positions.length})`
              : 'whole neck'}
          </button>
          <button
            type="button"
            className="scale-legend__step"
            aria-label="position up"
            title="next hand position (shortcut: >)"
            onClick={() => onStepPosition(1)}
          >
            ▸
          </button>
        </span>
      ) : null}
      <span className="scale-legend__swatches">
        {degrees.map((d) => {
          const group = groupOf(d.role);
          const on = overlay.mode === 'color' && overlay.colored[group];
          return (
            <button
              key={d.label}
              type="button"
              className="scale-legend__swatch"
              aria-pressed={on}
              disabled={overlay.mode !== 'color'}
              title={
                overlay.mode === 'color' ? `toggle color for ${group}` : 'full color mode only'
              }
              data-legend-degree={d.label}
              onClick={() => onToggleGroup(group)}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <circle
                  className={`fb-scale ${on ? `fb-scale--${degreeClass(d)}` : 'fb-scale--plain'}`}
                  cx="8"
                  cy="8"
                  r="6"
                />
              </svg>
              <span>{d.label}</span>
            </button>
          );
        })}
      </span>
      <span className="scale-legend__modes" role="radiogroup" aria-label="scale mode">
        {(['color', 'mono', 'off'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={mode === overlay.mode}
            className="scale-legend__mode"
            data-scale-mode={mode}
            onClick={() => onMode(mode)}
          >
            {mode === 'color' ? 'full color' : mode}
          </button>
        ))}
      </span>
      {onNeck ? (
        <span className="scale-legend__modes" role="radiogroup" aria-label="neck">
          <button
            type="button"
            role="radio"
            aria-checked={neck === 'follow'}
            className="scale-legend__mode"
            data-scale-neck="follow"
            title="a 12-fret window that slides to keep the position in the middle"
            onClick={() => onNeck('follow')}
          >
            follow
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={neck === 'all'}
            className="scale-legend__mode"
            data-scale-neck="all"
            title="all 24 frets at once"
            onClick={() => onNeck('all')}
          >
            all 24
          </button>
        </span>
      ) : null}
      {onWide ? (
        <button
          type="button"
          className="scale-legend__mode"
          aria-pressed={wide}
          data-testid="scale-wide"
          title="hide the side panels so more frets fit (shortcut: F)"
          onClick={() => onWide(!wide)}
        >
          {wide ? 'show panels' : 'wide'}
        </button>
      ) : null}
    </div>
  );
}
