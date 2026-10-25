import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapStore, useStore } from '@/store';
import { EasierTuningDialog } from './EasierTuningDialog';

describe('EasierTuningDialog', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('lists scored candidates, previews one on the fretboard, and applies as one undo step', () => {
    const onClose = vi.fn();
    render(<EasierTuningDialog onClose={onClose} />);
    const rows = screen.getAllByTestId('easier-row');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Bb Standard \(current\)/)).toBeInTheDocument();
    const dropAb = rows.find((r) => r.textContent?.startsWith('Drop Ab'))!;
    expect(dropAb).toBeDefined();
    fireEvent.click(dropAb.querySelector('button')!);
    expect(useStore.getState().previewRiff?.tuning.name).toBe('Drop Ab');
    expect(useStore.getState().riff.tuning.name).toBe('Bb Standard');
    fireEvent.click(dropAb.querySelectorAll('button')[1]!);
    expect(useStore.getState().riff.tuning.name).toBe('Drop Ab');
    expect(useStore.getState().previewRiff).toBeNull();
    expect(useStore.getState().history.past.map((h) => h.label)).toEqual(['retune (keep pitches)']);
    expect(onClose).toHaveBeenCalled();
    useStore.getState().undo();
    expect(useStore.getState().riff.tuning.name).toBe('Bb Standard');
  });
});
