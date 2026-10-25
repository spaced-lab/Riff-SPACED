import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { degreesOf, scaleById } from '@/music/scales';
import { ScaleLegend } from './ScaleLegend';
import type { ScaleOverlay } from './ScaleDots';

const blues = scaleById('blues');
const overlay: ScaleOverlay = {
  table: degreesOf(blues, 10),
  mode: 'color',
  colored: { roots: true, thirds: false, fifths: true, sevenths: true, blue: true, others: true },
  title: 'Bb Blues',
};

describe('ScaleLegend', () => {
  it('shows the title, one swatch per degree, and toggles a group on click', () => {
    const onToggle = vi.fn();
    const onMode = vi.fn();
    render(
      <ScaleLegend
        overlay={overlay}
        degrees={blues.degrees}
        onToggleGroup={onToggle}
        onMode={onMode}
      />,
    );
    expect(screen.getByTestId('scale-title')).toHaveTextContent('Bb Blues');
    const labels = [...document.querySelectorAll('[data-legend-degree]')].map((b) =>
      b.getAttribute('data-legend-degree'),
    );
    expect(labels).toEqual(['R', 'b3', '4', 'b5', '5', 'b7']);
    expect(document.querySelector('[data-legend-degree="b3"]')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(document.querySelector('[data-legend-degree="b5"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(document.querySelector('[data-legend-degree="b5"]')!);
    expect(onToggle).toHaveBeenCalledWith('blue');
    fireEvent.click(document.querySelector('[data-scale-mode="mono"]')!);
    expect(onMode).toHaveBeenCalledWith('mono');
  });

  it('disables the swatches in mono mode', () => {
    render(
      <ScaleLegend
        overlay={{ ...overlay, mode: 'mono' }}
        degrees={blues.degrees}
        onToggleGroup={() => undefined}
        onMode={() => undefined}
      />,
    );
    expect(document.querySelector('[data-legend-degree="R"]')).toBeDisabled();
    expect(document.querySelector('[data-scale-mode="mono"]')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
