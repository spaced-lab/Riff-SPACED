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
};

/**
 * The strip above the fretboard while a scale is shown: the scale title, one swatch per
 * degree, and the mode switch. Each swatch is a button that toggles its degree group, so the
 * legend is also the control panel (the menu has the same switches). The swatches reuse the
 * fretboard's `fb-scale--*` classes, so legend and neck can never disagree on a color.
 */
export function ScaleLegend({ overlay, degrees, onToggleGroup, onMode }: Props) {
  return (
    <div className="scale-legend" data-testid="scale-legend" role="toolbar" aria-label="scale">
      <span className="scale-legend__title" data-testid="scale-title">
        {overlay.title}
      </span>
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
    </div>
  );
}
