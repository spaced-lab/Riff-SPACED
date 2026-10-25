import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { positionsOf } from '@/music/positions';
import { degreesOf, scaleById } from '@/music/scales';
import { presetByName } from '@/music/tuning';
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

  it('shows the position with step buttons and clears it on click', () => {
    const positions = positionsOf(blues, 10, presetByName('Bb Standard')!, 24);
    const onStep = vi.fn();
    const onClear = vi.fn();
    const { rerender } = render(
      <ScaleLegend
        overlay={overlay}
        degrees={blues.degrees}
        onToggleGroup={() => undefined}
        onMode={() => undefined}
        positions={positions}
        onStepPosition={onStep}
        onClearPosition={onClear}
      />,
    );
    expect(screen.getByTestId('scale-position-name')).toHaveTextContent('whole neck');
    fireEvent.click(screen.getByLabelText('position up'));
    expect(onStep).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByLabelText('position down'));
    expect(onStep).toHaveBeenCalledWith(-1);
    rerender(
      <ScaleLegend
        overlay={{ ...overlay, position: positions[0] }}
        degrees={blues.degrees}
        onToggleGroup={() => undefined}
        onMode={() => undefined}
        positions={positions}
        onStepPosition={onStep}
        onClearPosition={onClear}
      />,
    );
    expect(screen.getByTestId('scale-position-name')).toHaveTextContent(
      `${positions[0]!.name}, frets ${positions[0]!.fromFret}-${positions[0]!.toFret} (1/${positions.length})`,
    );
    fireEvent.click(screen.getByTestId('scale-position-name'));
    expect(onClear).toHaveBeenCalled();
  });

  it('offers layout and riff controls when given handlers', () => {
    const onLayout = vi.fn();
    const onShowRiff = vi.fn();
    render(
      <ScaleLegend
        overlay={overlay}
        degrees={blues.degrees}
        onToggleGroup={() => undefined}
        onMode={() => undefined}
        layout="separate"
        onLayout={onLayout}
        showRiff
        onShowRiff={onShowRiff}
      />,
    );
    expect(document.querySelector('[data-scale-layout="separate"]')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    fireEvent.click(document.querySelector('[data-scale-layout="superimpose"]')!);
    expect(onLayout).toHaveBeenCalledWith('superimpose');
    fireEvent.click(screen.getByTestId('scale-show-riff'));
    expect(onShowRiff).toHaveBeenCalledWith(false);
  });
});
