import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { bootstrapStore, useStore } from '@/store';
import { notesInBars, quadrantRanges, SplitView } from './SplitView';

describe('SplitView', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('splits 4, 8, 12, 16 bars into four quadrants', () => {
    expect(quadrantRanges(4).map((r) => [r.fromBar, r.toBar])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ]);
    expect(quadrantRanges(8).map((r) => [r.fromBar, r.toBar])).toEqual([
      [0, 2],
      [2, 4],
      [4, 6],
      [6, 8],
    ]);
    expect(quadrantRanges(12)[3]).toEqual({ fromBar: 9, toBar: 12 });
    expect(quadrantRanges(16)[3]).toEqual({ fromBar: 12, toBar: 16 });
    expect(quadrantRanges(2)[3]).toEqual({ fromBar: 3, toBar: 3 });
  });

  it('shows each quadrant the notes of its bars and marks the active one while playing', () => {
    const { container } = render(<SplitView />);
    const riff = useStore.getState().riff;
    expect(container.querySelectorAll('[data-testid="fretboard"]')).toHaveLength(4);
    expect(notesInBars(riff.notes, 3, 4)).toHaveLength(9);
    expect(container.querySelectorAll('[data-testid="quadrant-3"] [data-note-id]')).toHaveLength(9);
    expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(0);
    act(() => {
      useStore.getState().play();
      useStore.getState().setPositionTick(3 * 1920 + 100);
    });
    expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="quadrant-3"]')!.getAttribute('data-active')).toBe(
      'true',
    );
    act(() => useStore.getState().setHighlightIds(['wd-n48']));
    expect(
      container.querySelectorAll('[data-testid="quadrant-3"] .fb-note--sounding'),
    ).toHaveLength(1);
    act(() => useStore.getState().stop());
    expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(0);
  });
});
