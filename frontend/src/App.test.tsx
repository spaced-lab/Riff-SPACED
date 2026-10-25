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

  it('renders the shell with the menu bar, the demo riff on the fretboard, and the panels', () => {
    const { container } = render(<App />);
    expect(screen.getByText('RIFF-SPACED')).toBeInTheDocument();
    expect(screen.getByTestId('menubar')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-note-id]').length).toBeGreaterThan(0);
    expect(screen.getByTestId('tab-lanes')).toBeInTheDocument();
    expect(screen.getByTestId('inspector')).toBeInTheDocument();
    expect(screen.getByTestId('transport')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar')).toHaveTextContent('Bb Standard: 34 39 44 49 53 58');
    expect(screen.getByTestId('riff-name')).toHaveTextContent('Walkdown Turnaround');
  });

  it('menus toggle letters, sharps, range, and tuning (keep shapes)', () => {
    const { container } = render(<App />);
    const click = (menu: string, item: string) => {
      fireEvent.click(screen.getByRole('menuitem', { name: menu }));
      fireEvent.click(container.querySelector(`[data-menu-item="${item}"]`)!);
    };
    click('View', 'view.letters');
    expect(container.querySelectorAll('[data-testid="notes"] text').length).toBeGreaterThan(0);
    click('View', 'view.sharps');
    expect(useStore.getState().accidentals).toBe('sharps');
    fireEvent.click(screen.getByRole('menuitem', { name: 'View' }));
    fireEvent.click(container.querySelector('[data-menu-item="view.range"]')!);
    fireEvent.click(container.querySelector('[data-menu-item="view.range:0-24"]')!);
    expect(container.querySelectorAll('[data-cell][data-string="6"]')).toHaveLength(25);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tuning' }));
    fireEvent.click(container.querySelector('[data-menu-item="tuning.drop"]')!);
    fireEvent.click(container.querySelector('[data-menu-item="tuning:Drop Ab"]')!);
    const riff = useStore.getState().riff;
    expect(riff.tuning.pitches).toEqual([32, 39, 44, 49, 53, 58]);
    expect(riff.notes[0]).toMatchObject({ string: 6, fret: 0 });
    expect(useStore.getState().history.past.at(-1)?.label).toBe('change tuning');
  });

  it('File > Open from library switches riffs and panels can be hidden', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'File' }));
    fireEvent.click(container.querySelector('[data-menu-item="file.openLibrary"]')!);
    fireEvent.click(container.querySelector('[data-menu-item="file.open:demo-riff-tritone"]')!);
    expect(useStore.getState().riff.name).toBe('Tritone Chug');
    act(() => useStore.getState().togglePanel('library'));
    expect(screen.queryByTestId('library-panel')).toBeNull();
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

  it('scale view: own neck above the riff, riff toggle, superimposed outlines (Phase 9)', () => {
    const { container } = render(<App />);
    expect(screen.queryByTestId('scale-board')).toBeNull();
    act(() => useStore.getState().setScaleMode('color'));
    expect(screen.getByTestId('scale-board')).toBeInTheDocument();
    expect(screen.getByTestId('riff-board')).toBeInTheDocument();
    expect(screen.getAllByTestId('fretboard')).toHaveLength(2);
    // The scale neck carries the dots, the riff neck the notes; neither covers the other.
    expect(
      screen.getByTestId('scale-board').querySelectorAll('[data-scale-dot]').length,
    ).toBeGreaterThan(0);
    expect(screen.getByTestId('scale-board').querySelectorAll('[data-note-id]')).toHaveLength(0);
    expect(screen.getByTestId('riff-board').querySelectorAll('[data-scale-dot]')).toHaveLength(0);
    act(() => useStore.getState().setScaleShowRiff(false));
    expect(screen.queryByTestId('riff-board')).toBeNull();
    expect(screen.getAllByTestId('fretboard')).toHaveLength(1);
    act(() => {
      useStore.getState().setScaleShowRiff(true);
      useStore.getState().setScaleLayout('superimpose');
    });
    expect(screen.queryByTestId('scale-board')).toBeNull();
    const riff = screen.getByTestId('riff-board');
    expect(riff.querySelectorAll('[data-scale-dot]').length).toBeGreaterThan(0);
    expect(riff.querySelector('[data-note-id]')!.getAttribute('class')).toContain(
      'fb-note--outline',
    );
    act(() => useStore.getState().setScaleShowRiff(false));
    expect(screen.getByTestId('riff-board').querySelectorAll('[data-note-id]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-scale-dot]').length).toBeGreaterThan(0);
  });
});
