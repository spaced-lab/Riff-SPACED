import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Dialog } from '@/components/Dialog';
import { newNote, newRiff } from '@/model/factories';
import { bootstrapStore, useStore } from './index';

describe('loop length through the store and dialog', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
    const r = newRiff();
    r.notes = [
      { ...newNote({ string: 6, fret: 0, start: 0, duration: 120 }), id: 'a' },
      { ...newNote({ string: 6, fret: 0, start: 5 * 1920, duration: 120 }), id: 'b' },
    ];
    useStore
      .getState()
      .setRiff({ ...r, lengthBars: 8, sections: [{ ...r.sections[0]!, lengthBars: 8 }] });
  });

  it('grows without asking and shrinks after confirmation', () => {
    render(<Dialog />);
    act(() => useStore.getState().setLengthBars(12));
    expect(useStore.getState().riff.lengthBars).toBe(12);
    expect(screen.queryByTestId('dialog')).toBeNull();

    act(() => useStore.getState().setLengthBars(4));
    expect(useStore.getState().riff.lengthBars).toBe(12);
    expect(screen.getByRole('dialog')).toHaveTextContent('1 note after bar 4 will be removed.');
    fireEvent.click(screen.getByText('keep'));
    expect(useStore.getState().riff.lengthBars).toBe(12);
    expect(screen.queryByTestId('dialog')).toBeNull();

    act(() => useStore.getState().setLengthBars(4));
    fireEvent.click(screen.getByText('remove and shorten'));
    expect(useStore.getState().riff.lengthBars).toBe(4);
    expect(useStore.getState().riff.notes.map((n) => n.id)).toEqual(['a']);
    expect(useStore.getState().history.past.at(-1)?.label).toBe('loop length');
  });

  it('Enter and Escape answer the dialog; force skips it; the cursor is clamped', () => {
    render(<Dialog />);
    act(() => useStore.getState().setEditCursor(7 * 1920));
    act(() => useStore.getState().setLengthBars(4));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useStore.getState().riff.lengthBars).toBe(8);
    act(() => useStore.getState().setLengthBars(4));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(useStore.getState().riff.lengthBars).toBe(4);
    expect(useStore.getState().editCursorTick).toBe(4 * 1920 - 120);
    act(() => useStore.getState().setLengthBars(16, true));
    expect(useStore.getState().riff.lengthBars).toBe(16);
  });
});
