import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { useElementSize } from '@/hooks/useElementSize';
import type { Note } from '@/model/types';
import { nameOf } from '@/music/naming';
import type { Accidentals } from '@/music/naming';
import { pitchClass } from '@/music/pitch';
import { pitchOf } from '@/music/tuning';
import type { Tuning } from '@/music/tuning';
import type { FretRange } from '@/store/viewSlice';
import { ChordConnectors } from './ChordConnectors';
import { FretNumbers } from './FretNumbers';
import { FretWires } from './FretWires';
import { FretboardNote } from './FretboardNote';
import { Markers } from './Markers';
import { ScaleDots } from './ScaleDots';
import type { ScaleOverlay } from './ScaleDots';
import { StringLines } from './StringLines';
import { Tooltip } from './Tooltip';
import type { TooltipState } from './Tooltip';
import { layout as computeLayout } from './geometry';
import './fretboard.css';

export type CellClick = { string: number; fret: number; shiftKey: boolean };

export type FretboardProps = {
  tuning: Tuning;
  /** The notes to draw (the caller decides which: at the cursor, in the bar, the whole riff). */
  notes: readonly Note[];
  highlightIds?: readonly string[];
  selectedIds?: readonly string[];
  /** Drawn at reduced opacity (ghost context). */
  dimmedIds?: readonly string[];
  range: FretRange;
  showLetters: boolean;
  accidentals: Accidentals;
  realisticSpacing?: boolean;
  /** Scale overlay under the notes (Phase 9); null or undefined draws none. */
  scale?: ScaleOverlay | null;
  onCellClick?: (cell: CellClick) => void;
  onNoteClick?: (noteId: string, event: { shiftKey: boolean; button: number }) => void;
  onNoteContextMenu?: (noteId: string) => void;
  /** Fixed size for tests and previews; otherwise the component measures its container. */
  width?: number;
  height?: number;
  label?: string;
};

/**
 * The SVG fretboard (SPEC 5.3). Presentational: everything it shows arrives as props and
 * every interaction leaves as a callback. The store decides what the props mean.
 */
export function Fretboard(props: FretboardProps) {
  const {
    tuning,
    notes,
    highlightIds = [],
    selectedIds = [],
    dimmedIds = [],
    range,
    showLetters,
    accidentals,
    realisticSpacing = false,
    scale = null,
    onCellClick,
    onNoteClick,
    onNoteContextMenu,
    label,
  } = props;

  const [ref, measured] = useElementSize<HTMLDivElement>();
  const width = props.width ?? measured.width;
  const height = props.height ?? measured.height;
  const stringCount = tuning.pitches.length;

  const layout = useMemo(
    () => computeLayout(width, height, range, stringCount, realisticSpacing),
    [width, height, range, stringCount, realisticSpacing],
  );

  const highlight = useMemo(() => new Set(highlightIds), [highlightIds]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const dimmed = useMemo(() => new Set(dimmedIds), [dimmedIds]);
  const visible = useMemo(
    () =>
      notes.filter((n) => n.fret >= range.from && n.fret <= range.to && n.string <= stringCount),
    [notes, range, stringCount],
  );

  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const describe = (string: number, fret: number) => {
    const midi = pitchOf(tuning, string, fret);
    const base = `string ${string} fret ${fret} = ${nameOf(midi, accidentals, true)}`;
    const degree = scale?.table[pitchClass(midi)];
    return degree ? `${base}, ${degree.label} of ${scale.title}` : base;
  };
  const showTip = (string: number, fret: number) =>
    setTooltip({
      x: layout.noteX(fret),
      y: layout.stringY(string) - layout.dotRadius,
      text: describe(string, fret),
    });

  const noteById = useMemo(() => new Map(visible.map((n) => [n.id, n])), [visible]);

  // One invisible hit rectangle per (string, fret) cell so clicks on empty neck add notes.
  const cells = [];
  for (let s = 1; s <= stringCount; s++) {
    for (let f = range.from; f <= range.to; f++) {
      const isOpen = f === range.from;
      const left = isOpen ? layout.noteX(f) - layout.dotRadius * 1.6 : layout.fretX(f - 1);
      const right = isOpen ? layout.nutX : layout.fretX(f);
      cells.push(
        <rect
          key={`${s}-${f}`}
          className="fb-cell"
          data-cell
          data-string={s}
          data-fret={f}
          x={left}
          y={layout.stringY(s) - layout.stringGap / 2}
          width={Math.max(1, right - left)}
          height={layout.stringGap}
          onClick={(e: MouseEvent) => onCellClick?.({ string: s, fret: f, shiftKey: e.shiftKey })}
          onMouseEnter={() => showTip(s, f)}
          onMouseLeave={() => setTooltip(null)}
        />,
      );
    }
  }

  return (
    <div
      className="fretboard"
      ref={ref}
      data-testid="fretboard"
      aria-label={label ?? `fretboard, ${tuning.name}`}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${tuning.name} fretboard, frets ${range.from} to ${range.to}`}
      >
        <FretNumbers layout={layout} />
        <Markers layout={layout} />
        <FretWires layout={layout} />
        <StringLines layout={layout} tuning={tuning} accidentals={accidentals} />
        <g data-testid="cells">{cells}</g>
        {scale ? <ScaleDots layout={layout} tuning={tuning} overlay={scale} /> : null}
        <ChordConnectors layout={layout} notes={visible} soundingIds={highlight} />
        <g data-testid="notes">
          {visible.map((n) => (
            <FretboardNote
              key={n.id}
              note={n}
              x={layout.noteX(n.fret)}
              y={layout.stringY(n.string)}
              radius={layout.dotRadius}
              letter={
                showLetters ? nameOf(pitchOf(tuning, n.string, n.fret), accidentals, false) : null
              }
              state={{
                selected: selected.has(n.id),
                sounding: highlight.has(n.id),
                dimmed: dimmed.has(n.id),
              }}
              onClick={onNoteClick}
              onContextMenu={onNoteContextMenu}
              onHover={(id) => {
                const note = id ? noteById.get(id) : undefined;
                if (note) showTip(note.string, note.fret);
                else setTooltip(null);
              }}
            />
          ))}
        </g>
      </svg>
      <Tooltip state={tooltip} />
    </div>
  );
}
