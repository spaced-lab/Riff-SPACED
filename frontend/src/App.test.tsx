import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { bootstrapStore, useStore } from './store';

describe('App', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('renders the heading and the demo riff on the fretboard', () => {
    const { container } = render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('RIFF-SPACED');
    expect(container.querySelectorAll('[data-note-id]').length).toBeGreaterThan(0);
    expect(screen.getByTestId('tuning-status')).toHaveTextContent('Bb Standard: 34 39 44 49 53 58');
  });

  it('dev toolbar toggles letters, sharps, range, and tuning (keep shapes)', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByLabelText('Note letters'));
    expect(container.querySelectorAll('[data-testid="notes"] text').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('Sharps'));
    expect(useStore.getState().accidentals).toBe('sharps');
    fireEvent.change(screen.getByLabelText('fret range'), { target: { value: '0-24' } });
    expect(container.querySelectorAll('[data-cell][data-string="6"]')).toHaveLength(25);
    fireEvent.change(screen.getByLabelText('tuning'), { target: { value: 'Drop Ab' } });
    const riff = useStore.getState().riff;
    expect(riff.tuning.pitches).toEqual([32, 39, 44, 49, 53, 58]);
    expect(riff.notes[0]).toMatchObject({ string: 6, fret: 0 });
    expect(useStore.getState().history.past.at(-1)?.label).toBe('change tuning');
  });

  it('dev toolbar switches riffs', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('riff'), { target: { value: 'demo-riff-tritone' } });
    expect(useStore.getState().riff.name).toBe('Tritone Chug');
  });
});
