import type { MouseEvent } from 'react';
import type { Note } from '@/model/types';

export type NoteState = {
  selected: boolean;
  sounding: boolean;
  dimmed: boolean;
};

type Props = {
  note: Note;
  x: number;
  y: number;
  radius: number;
  letter: string | null;
  state: NoteState;
  onClick?: (noteId: string, event: { shiftKey: boolean; button: number }) => void;
  onContextMenu?: (noteId: string) => void;
  onHover?: (noteId: string | null) => void;
};

export const LOW_CONFIDENCE = 0.6;

/**
 * One dot. Its visual state is a set of CSS classes so the theme file, not the component,
 * decides what selected, sounding, low-confidence, and unplayable look like.
 */
export function FretboardNote({
  note,
  x,
  y,
  radius,
  letter,
  state,
  onClick,
  onContextMenu,
  onHover,
}: Props) {
  const classes = ['fb-note'];
  if (state.selected) classes.push('fb-note--selected');
  if (state.sounding) classes.push('fb-note--sounding');
  if (state.dimmed) classes.push('fb-note--dimmed');
  if ((note.confidence ?? 1) < LOW_CONFIDENCE) classes.push('fb-note--low');
  if (note.unplayable) classes.push('fb-note--unplayable');

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    onClick?.(note.id, { shiftKey: e.shiftKey, button: e.button });
  };
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(note.id);
  };

  return (
    <g
      className={classes.join(' ')}
      data-note-id={note.id}
      data-string={note.string}
      data-fret={note.fret}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => onHover?.(note.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <circle cx={x} cy={y} r={radius} />
      {letter ? (
        <text x={x} y={y} fontSize={radius * 1.1}>
          {letter}
        </text>
      ) : null}
    </g>
  );
}
