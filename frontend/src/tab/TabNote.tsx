import type { MouseEvent, PointerEvent } from 'react';
import { LOW_CONFIDENCE } from '@/fretboard/FretboardNote';
import type { Note } from '@/model/types';
import { noteBox } from './geometry';

type Props = {
  note: Note;
  pxPerBar: number;
  selected: boolean;
  sounding: boolean;
  onPointerDown?: (noteId: string, e: PointerEvent<SVGGElement>, edge: boolean) => void;
  onClick?: (noteId: string, e: MouseEvent<SVGGElement>) => void;
  onContextMenu?: (noteId: string) => void;
};

/**
 * A note in the tab: a rectangle from start to start + duration with the fret number.
 * Palm-muted notes get a dotted top edge; the right 6 px are a resize handle.
 */
export function TabNote({
  note,
  pxPerBar,
  selected,
  sounding,
  onPointerDown,
  onClick,
  onContextMenu,
}: Props) {
  const box = noteBox(note.string, note.start, note.duration, pxPerBar);
  const classes = ['tab-note'];
  if (selected) classes.push('tab-note--selected');
  if (sounding) classes.push('tab-note--sounding');
  if (note.techniques?.includes('palmMute')) classes.push('tab-note--palm-mute');
  if ((note.confidence ?? 1) < LOW_CONFIDENCE) classes.push('tab-note--low');
  if (note.unplayable) classes.push('tab-note--unplayable');
  const handle = Math.min(8, box.width / 3);
  return (
    <g
      className={classes.join(' ')}
      data-tab-note={note.id}
      data-string={note.string}
      data-start={note.start}
      data-duration={note.duration}
      onPointerDown={(e) => onPointerDown?.(note.id, e, false)}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(note.id, e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(note.id);
      }}
    >
      <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={2} />
      {note.techniques?.includes('palmMute') ? (
        <line
          className="tab-note__mute"
          x1={box.x + 1}
          x2={box.x + box.width - 1}
          y1={box.y}
          y2={box.y}
        />
      ) : null}
      <text x={box.x + 4} y={box.y + box.height / 2}>
        {note.fret}
      </text>
      <rect
        className="tab-note__resize"
        data-resize-handle={note.id}
        x={box.x + box.width - handle}
        y={box.y}
        width={handle}
        height={box.height}
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDown?.(note.id, e, true);
        }}
      />
    </g>
  );
}
