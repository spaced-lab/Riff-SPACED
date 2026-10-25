import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { bootstrapStore, useStore } from '@/store';
import { TabLanes } from './TabLanes';
import { noteBox } from './geometry';
import { playhead } from './playheadRef';

describe('TabLanes', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
  });

  it('renders a 4-bar riff with five bar lines, six lanes, and every note placed by time', () => {
    const { container } = render(<TabLanes />);
    expect(container.querySelectorAll('[data-grid-line="bar"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-lane]')).toHaveLength(6);
    expect(container.querySelectorAll('[data-lane-label]')).toHaveLength(6);
    expect(container.querySelectorAll('[data-tab-note]')).toHaveLength(56);
    const px = useStore.getState().pxPerBar;
    const held = container.querySelector(
      '[data-tab-note][data-string="5"][data-duration="1920"] rect',
    )!;
    const box = noteBox(5, 3 * 1920, 1920, px);
    expect(Number(held.getAttribute('x'))).toBeCloseTo(box.x);
    expect(Number(held.getAttribute('width'))).toBeCloseTo(box.width);
    expect(container.querySelectorAll('.tab-note--palm-mute').length).toBeGreaterThan(40);
    expect(container.querySelectorAll('[data-chord-bracket]').length).toBe(23);
    expect(container.querySelector('[data-bar-number="4"]')).not.toBeNull();
    expect(container.querySelector('[data-section-label]')!.textContent).toContain('A');
  });

  it('selects on click, removes on context menu, and shows selected and sounding states', () => {
    const { container } = render(<TabLanes />);
    const first = container.querySelector('[data-tab-note]')!;
    const id = first.getAttribute('data-tab-note')!;
    fireEvent.click(first);
    expect(useStore.getState().selectedNoteIds).toEqual([id]);
    expect(
      container.querySelector(`[data-tab-note="${id}"]`)!.classList.contains('tab-note--selected'),
    ).toBe(true);
    act(() => useStore.getState().setHighlightIds([id]));
    expect(
      container.querySelector(`[data-tab-note="${id}"]`)!.classList.contains('tab-note--sounding'),
    ).toBe(true);
    fireEvent.contextMenu(first);
    expect(useStore.getState().riff.notes.find((n) => n.id === id)).toBeUndefined();
  });

  it('moves the edit cursor with the zoom and drives the playhead line through the ref', () => {
    const { container } = render(<TabLanes />);
    act(() => useStore.getState().setEditCursorTick(1920));
    const cursor = container.querySelector('[data-testid="edit-cursor"]')!;
    expect(Number(cursor.getAttribute('x1'))).toBe(useStore.getState().pxPerBar);
    act(() => useStore.getState().setPxPerBar(640));
    expect(Number(container.querySelector('[data-testid="edit-cursor"]')!.getAttribute('x1'))).toBe(
      640,
    );
    playhead.setTick(960);
    expect(Number(container.querySelector('[data-testid="playhead"]')!.getAttribute('x1'))).toBe(
      320,
    );
  });
});
