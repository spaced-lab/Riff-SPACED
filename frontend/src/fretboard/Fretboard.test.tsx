import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { newNote } from '@/model/factories';
import { DEFAULT_TUNING } from '@/music/tuning';
import { Fretboard } from './Fretboard';
import { layout } from './geometry';

const notes = [
  { ...newNote({ string: 6, fret: 3, start: 0, duration: 240, chordId: 'c1' }), id: 'a' },
  { ...newNote({ string: 5, fret: 5, start: 0, duration: 240, chordId: 'c1' }), id: 'b' },
  { ...newNote({ string: 4, fret: 0, start: 240, duration: 240 }), id: 'open', unplayable: true },
  { ...newNote({ string: 6, fret: 14, start: 480, duration: 240 }), id: 'high' },
];

const base = {
  tuning: DEFAULT_TUNING,
  notes,
  range: { from: 0, to: 12 },
  showLetters: false,
  accidentals: 'flats' as const,
  width: 1000,
  height: 200,
};

describe('Fretboard', () => {
  it('renders six strings and 13 fret cells per string for 0-12', () => {
    const { container } = render(<Fretboard {...base} />);
    expect(container.querySelectorAll('[data-string-line]')).toHaveLength(6);
    expect(container.querySelectorAll('[data-cell][data-string="6"]')).toHaveLength(13);
    expect(container.querySelectorAll('[data-fret-wire]')).toHaveLength(13);
    expect(container.querySelector('.fb-wire--nut')).not.toBeNull();
    expect(container.querySelectorAll('[data-marker]')).toHaveLength(5);
  });

  it('places a note at the geometry position and hides notes outside the range', () => {
    const { container } = render(<Fretboard {...base} />);
    const l = layout(1000, 200, { from: 0, to: 12 }, 6, false);
    const dot = container.querySelector('[data-note-id="a"] circle')!;
    expect(Number(dot.getAttribute('cx'))).toBeCloseTo(l.noteX(3));
    expect(Number(dot.getAttribute('cy'))).toBeCloseTo(l.stringY(6));
    expect(container.querySelector('[data-note-id="high"]')).toBeNull();
    expect(container.querySelectorAll('[data-connector="c1"]')).toHaveLength(1);
  });

  it('shows letters with flats or sharps', () => {
    // String labels in the gutter also carry names (string 4 is Db3), so look inside the dots.
    const letters = (c: HTMLElement) =>
      [...c.querySelectorAll('[data-testid="notes"] text')].map((t) => t.textContent);
    const { container, rerender } = render(<Fretboard {...base} />);
    expect(letters(container)).toEqual([]);
    rerender(<Fretboard {...base} showLetters />);
    expect(letters(container)).toEqual(['Db', 'Ab', 'Ab']);
    rerender(<Fretboard {...base} showLetters accidentals="sharps" />);
    expect(letters(container)).toEqual(['C#', 'G#', 'G#']);
  });

  it('applies selected, sounding, dimmed, and unplayable classes', () => {
    const { container } = render(
      <Fretboard {...base} selectedIds={['a']} highlightIds={['b']} dimmedIds={['b']} />,
    );
    expect(
      container.querySelector('[data-note-id="a"]')!.classList.contains('fb-note--selected'),
    ).toBe(true);
    expect(
      container.querySelector('[data-note-id="b"]')!.classList.contains('fb-note--sounding'),
    ).toBe(true);
    expect(
      container.querySelector('[data-note-id="b"]')!.classList.contains('fb-note--dimmed'),
    ).toBe(true);
    expect(
      container.querySelector('[data-note-id="open"]')!.classList.contains('fb-note--unplayable'),
    ).toBe(true);
    expect(
      container
        .querySelector('[data-connector="c1"]')!
        .classList.contains('fb-connector--sounding'),
    ).toBe(true);
  });

  it('emits cell clicks with the shift key, note clicks, and context menus', () => {
    const onCellClick = vi.fn();
    const onNoteClick = vi.fn();
    const onNoteContextMenu = vi.fn();
    const { container } = render(
      <Fretboard
        {...base}
        onCellClick={onCellClick}
        onNoteClick={onNoteClick}
        onNoteContextMenu={onNoteContextMenu}
      />,
    );
    fireEvent.click(container.querySelector('[data-cell][data-string="5"][data-fret="7"]')!, {
      shiftKey: true,
    });
    expect(onCellClick).toHaveBeenCalledWith({ string: 5, fret: 7, shiftKey: true });
    fireEvent.click(container.querySelector('[data-note-id="a"]')!);
    expect(onNoteClick).toHaveBeenCalledWith('a', { shiftKey: false, button: 0 });
    fireEvent.contextMenu(container.querySelector('[data-note-id="a"]')!);
    expect(onNoteContextMenu).toHaveBeenCalledWith('a');
  });

  it('shows a tooltip naming the string, fret, and pitch on hover', () => {
    const { container } = render(<Fretboard {...base} />);
    fireEvent.mouseEnter(container.querySelector('[data-note-id="a"]')!);
    expect(screen.getByRole('tooltip')).toHaveTextContent('string 6 fret 3 = Db2');
    fireEvent.mouseLeave(container.querySelector('[data-note-id="a"]')!);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(container.querySelector('[data-cell][data-string="4"][data-fret="0"]')!);
    expect(screen.getByRole('tooltip')).toHaveTextContent('string 4 fret 0 = Ab2');
  });
});
