import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { readHashPath } from './hooks/useHashRoute';
import { bootstrapStore, useStore } from './store';

describe('App', () => {
  beforeEach(() => {
    window.location.hash = '';
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('renders the shell with the demo riff on the fretboard and placeholders for later phases', () => {
    const { container } = render(<App />);
    expect(screen.getByText('RIFF-SPACED')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-note-id]').length).toBeGreaterThan(0);
    expect(screen.getByTestId('tab-lanes')).toBeInTheDocument();
    expect(screen.getByTestId('placeholder-inspector')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar')).toHaveTextContent('Bb Standard');
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

  it('dev toolbar switches riffs and panels can be hidden', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('riff'), { target: { value: 'demo-riff-tritone' } });
    expect(useStore.getState().riff.name).toBe('Tritone Chug');
    act(() => useStore.getState().togglePanel('library'));
    expect(screen.queryByTestId('placeholder-library')).toBeNull();
  });

  it('routes /#/dev/fretboard to the harness with four boards', () => {
    window.location.hash = '#/dev/fretboard';
    const { container } = render(<App />);
    expect(screen.getByTestId('fretboard-harness')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="fretboard"]')).toHaveLength(4);
    expect(
      container.querySelectorAll('[data-testid="harness-board-3"] [data-string-line]'),
    ).toHaveLength(7);
    expect(readHashPath('#/dev/fretboard')).toBe('/dev/fretboard');
    expect(readHashPath('')).toBe('/');
    expect(readHashPath('#junk')).toBe('/');
  });
});
