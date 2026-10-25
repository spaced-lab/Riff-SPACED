import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Dialog } from '@/components/Dialog';
import { bootstrapStore, useStore } from '@/store';
import { MenuBar } from './MenuBar';
import { buildMenus } from './menuModel';

describe('MenuBar', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('renders every top-level menu from SPEC 5.7', () => {
    render(<MenuBar />);
    for (const name of ['File', 'Edit', 'View', 'Tuning', 'Playback', 'AI', 'Help']) {
      expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens a menu, shows disabled items with their reason as a tooltip, and closes on Escape', () => {
    const { container } = render(<MenuBar />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'AI' }));
    expect(screen.getByTestId('menu-ai')).toBeInTheDocument();
    const analyze = container.querySelector('[data-menu-item="ai.analyze"]')!;
    // With no backend reachable the AI items say so (SPEC 5.7, 9).
    expect(analyze).toHaveAttribute('title', 'backend unreachable at http://localhost:8000');
    expect(analyze).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(analyze);
    expect(screen.getByTestId('menu-ai')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('menu-ai')).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'File' }));
    expect(container.querySelector('[data-menu-item="file.importAudio"]')).toHaveAttribute(
      'title',
      expect.stringContaining('backend unreachable at'),
    );
    expect(container.querySelector('[data-menu-item="file.export.musicxml"]')).toBeNull();
    fireEvent.click(container.querySelector('[data-menu-item="file.export"]')!);
    expect(container.querySelector('[data-menu-item="file.export.musicxml"]')).toHaveAttribute(
      'title',
      'Phase 8',
    );
  });

  it('reflects state in checkmarks and labels, and runs actions', () => {
    const { container } = render(<MenuBar />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'View' }));
    const letters = container.querySelector('[data-menu-item="view.letters"]')!;
    expect(letters).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(letters);
    expect(useStore.getState().showLetters).toBe(true);
    expect(screen.queryByTestId('menu-view')).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(container.querySelector('[data-menu-item="edit.undo"]')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    useStore.getState().setBpm(100);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(container.querySelector('[data-menu-item="edit.undo"]')).toHaveTextContent('Undo tempo');
    fireEvent.click(container.querySelector('[data-menu-item="edit.undo"]')!);
    expect(useStore.getState().riff.tempo.bpm).toBe(92);
  });

  it('Help > Keyboard shortcuts opens the info dialog with the table', () => {
    const { container } = render(
      <>
        <MenuBar />
        <Dialog />
      </>,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Help' }));
    fireEvent.click(container.querySelector('[data-menu-item="help.shortcuts"]')!);
    expect(screen.getByRole('dialog')).toHaveTextContent('keyboard shortcuts');
    expect(screen.getByRole('dialog')).toHaveTextContent('play / stop');
    fireEvent.click(screen.getByText('close'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the model lists every tuning preset and the current one is checked', () => {
    const menus = buildMenus(useStore.getState());
    const tuning = menus.find((m) => m.id === 'tuning')!;
    const standard = tuning.items.find((i) => i.type === 'item' && i.id === 'tuning.standard');
    expect(standard && standard.type === 'item' ? standard.submenu?.length : 0).toBe(8);
    const bb =
      standard && standard.type === 'item'
        ? standard.submenu?.find((i) => i.type === 'item' && i.id === 'tuning:Bb Standard')
        : undefined;
    expect(bb && bb.type === 'item' ? bb.checked : false).toBe(true);
  });
});
