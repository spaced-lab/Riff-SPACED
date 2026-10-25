import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { newNote, newRiff } from '@/model/factories';
import { bootstrapStore, useStore } from '@/store';
import { TabLanes } from './TabLanes';
import { LANE_HEIGHT, laneY } from './geometry';

/**
 * jsdom reports every bounding rect as 0,0, so clientX/clientY are already SVG-local.
 * pxPerBar is 320 in the default view, so one bar is 320 px and a sixteenth is 20 px.
 */
describe('tab pointer state machine', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
    const r = newRiff();
    r.notes = [
      { ...newNote({ string: 6, fret: 3, start: 0, duration: 480, chordId: 'c1' }), id: 'a' },
      { ...newNote({ string: 5, fret: 5, start: 0, duration: 480, chordId: 'c1' }), id: 'b' },
      { ...newNote({ string: 6, fret: 5, start: 1920, duration: 240 }), id: 'c' },
    ];
    useStore.getState().setRiff(r);
  });

  it('drags a note one bar right and one lane up in a single undo step', () => {
    const { container } = render(<TabLanes />);
    const svg = container.querySelector('[data-testid="tab-svg"]')!;
    const note = container.querySelector('[data-tab-note="c"]')!;
    fireEvent.pointerDown(note, { button: 0, clientX: 330, clientY: laneY(6), pointerId: 1 });
    expect(svg.getAttribute('data-pointer-phase')).toBe('dragging');
    fireEvent.pointerMove(svg, {
      clientX: 330 + 320,
      clientY: laneY(6) - LANE_HEIGHT,
      pointerId: 1,
    });
    // Preview: the store is untouched while dragging.
    expect(useStore.getState().riff.notes.find((n) => n.id === 'c')!.start).toBe(1920);
    expect(
      container.querySelector('[data-tab-note="c"]')!.parentElement!.getAttribute('transform'),
    ).toContain('translate(320');
    fireEvent.pointerUp(svg, { pointerId: 1 });
    const moved = useStore.getState().riff.notes.find((n) => n.id === 'c')!;
    expect(moved).toMatchObject({ start: 3840, string: 5, fret: 5 });
    expect(useStore.getState().history.past.map((h) => h.label)).toEqual(['move notes']);
    expect(svg.getAttribute('data-pointer-phase')).toBe('idle');
  });

  it('resizes from the right edge, chord members together', () => {
    const { container } = render(<TabLanes />);
    const svg = container.querySelector('[data-testid="tab-svg"]')!;
    const handle = container.querySelector('[data-resize-handle="a"]')!;
    fireEvent.pointerDown(handle, { button: 0, clientX: 78, clientY: laneY(6), pointerId: 2 });
    expect(svg.getAttribute('data-pointer-phase')).toBe('resizing');
    fireEvent.pointerMove(svg, { clientX: 78 + 80, clientY: laneY(6), pointerId: 2 });
    fireEvent.pointerUp(svg, { pointerId: 2 });
    expect(useStore.getState().riff.notes.find((n) => n.id === 'a')!.duration).toBe(960);
    expect(useStore.getState().riff.notes.find((n) => n.id === 'b')!.duration).toBe(960);
  });

  it('marquee-selects the notes it touches and a plain click on empty space clears', () => {
    const { container } = render(<TabLanes />);
    const svg = container.querySelector('[data-testid="tab-svg"]')!;
    fireEvent.pointerDown(svg, { button: 0, clientX: 2, clientY: laneY(5) - 10, pointerId: 3 });
    fireEvent.pointerMove(svg, { clientX: 60, clientY: laneY(6) + 10, pointerId: 3 });
    expect(container.querySelector('[data-testid="marquee"]')).not.toBeNull();
    fireEvent.pointerUp(svg, { pointerId: 3 });
    expect(useStore.getState().selectedNoteIds.sort()).toEqual(['a', 'b']);
    fireEvent.pointerDown(svg, { button: 0, clientX: 600, clientY: 100, pointerId: 4 });
    fireEvent.pointerUp(svg, { pointerId: 4 });
    expect(useStore.getState().selectedNoteIds).toEqual([]);
  });

  it('clipboard: copy, paste at the cursor, cut, duplicate', () => {
    const s = useStore.getState();
    s.select(['a']);
    s.copySelection();
    expect(useStore.getState().clipboard.map((n) => n.id)).toEqual(['a', 'b']);
    s.setEditCursor(960);
    s.pasteAtCursor();
    expect(useStore.getState().riff.notes).toHaveLength(5);
    expect(useStore.getState().selectedNoteIds).toHaveLength(2);
    expect(useStore.getState().riff.notes.filter((n) => n.start === 960)).toHaveLength(2);
    s.select(['c']);
    s.duplicateSelection();
    expect(useStore.getState().riff.notes.find((n) => n.start === 1920 + 120)).toBeDefined();
    useStore.getState().select(['c']);
    useStore.getState().cutSelection();
    expect(useStore.getState().riff.notes.find((n) => n.id === 'c')).toBeUndefined();
    expect(useStore.getState().clipboard.map((n) => n.id)).toEqual(['c']);
  });
});
