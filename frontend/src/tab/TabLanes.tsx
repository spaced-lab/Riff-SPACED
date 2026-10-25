import { useEffect, useRef } from 'react';
import { nameOf } from '@/music/naming';
import { pitchOf } from '@/music/tuning';
import { TICKS_PER_BAR, snapToGrid } from '@/music/time';
import { useStore } from '@/store';
import { ChordBrackets } from './ChordBrackets';
import { EditCursor } from './EditCursor';
import { GridLines } from './GridLines';
import { Playhead } from './Playhead';
import { Ruler } from './Ruler';
import { TabNote } from './TabNote';
import { GUTTER_WIDTH, LANE_HEIGHT, laneY, tabHeight, tabWidth, tickToX } from './geometry';
import { playhead } from './playheadRef';
import { useTabPointer } from './useTabPointer';
import './tab.css';

/**
 * The tab lanes / timeline (SPEC 5.4). Connected to the store: it is the editor's main
 * surface and owns scrolling and zoom. Drawing is delegated to small pure children.
 */
export function TabLanes() {
  const riff = useStore((s) => s.riff);
  const grid = useStore((s) => s.grid);
  const pxPerBar = useStore((s) => s.pxPerBar);
  const setPxPerBar = useStore((s) => s.setPxPerBar);
  const accidentals = useStore((s) => s.accidentals);
  const selectedNoteIds = useStore((s) => s.selectedNoteIds);
  const highlightIds = useStore((s) => s.highlightIds);
  const editCursorTick = useStore((s) => s.editCursorTick);
  const setEditCursorTick = useStore((s) => s.setEditCursorTick);
  const select = useStore((s) => s.select);
  const removeNotes = useStore((s) => s.removeNotes);
  const pointer = useTabPointer();
  const followPlayhead = useStore((s) => s.followPlayhead);
  const isPlaying = useStore((s) => s.isPlaying);

  const stringCount = riff.tuning.pitches.length;
  const height = tabHeight(stringCount);
  const width = tabWidth(riff.lengthBars, pxPerBar);
  const selected = new Set(selectedNoteIds);
  const sounding = new Set(highlightIds);

  // Ctrl/Cmd + wheel zooms, plain wheel scrolls horizontally. A native listener is needed
  // because React's onWheel is passive and cannot preventDefault the browser zoom.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    playhead.setScroller(scrollRef.current);
    return () => playhead.setScroller(null);
  }, []);
  useEffect(() => {
    // Follow only while playing, so editing never fights the user's own scrolling.
    playhead.setFollow(followPlayhead && isPlaying);
  }, [followPlayhead, isPlaying]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        setPxPerBar(useStore.getState().pxPerBar * factor);
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setPxPerBar]);

  const labels = [];
  for (let s = 1; s <= stringCount; s++) {
    labels.push(
      <text key={s} x={GUTTER_WIDTH - 6} y={laneY(s)} data-lane-label={s}>
        {nameOf(pitchOf(riff.tuning, s, 0), accidentals, false)}
      </text>,
    );
  }

  return (
    <div className="tab" data-testid="tab-lanes">
      <div className="tab__gutter">
        <svg width={GUTTER_WIDTH} height={height}>
          {labels}
        </svg>
      </div>
      <div className="tab__scroll" ref={scrollRef} data-testid="tab-scroll">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          data-testid="tab-svg"
          data-pointer-phase={pointer.phase}
          onPointerDown={pointer.onBackgroundPointerDown}
          onPointerMove={pointer.onPointerMove}
          onPointerUp={pointer.onPointerUp}
          onPointerCancel={pointer.onPointerUp}
        >
          <rect
            className="tab-loop"
            x={0}
            y={0}
            width={tickToX(riff.lengthBars * TICKS_PER_BAR, pxPerBar)}
            height={height}
          />
          <GridLines
            lengthBars={riff.lengthBars}
            stringCount={stringCount}
            grid={grid}
            pxPerBar={pxPerBar}
          />
          <Ruler
            lengthBars={riff.lengthBars}
            sections={riff.sections}
            pxPerBar={pxPerBar}
            onClickTick={(tick) => setEditCursorTick(snapToGrid(tick, grid))}
          />
          <ChordBrackets notes={riff.notes} pxPerBar={pxPerBar} />
          <g data-testid="tab-notes">
            {riff.notes.map((n) => {
              const isSelected = selected.has(n.id);
              // Drag and resize previews: selected notes are drawn offset or stretched
              // without touching the store until the pointer is released.
              const preview = isSelected && pointer.dragPreview ? pointer.dragPreview : null;
              const stretched =
                isSelected && pointer.resizePreview !== null
                  ? { ...n, duration: Math.max(1, n.duration + pointer.resizePreview) }
                  : n;
              const transform = preview
                ? `translate(${tickToX(preview.dTicks, pxPerBar)}, ${preview.dLanes * LANE_HEIGHT})`
                : undefined;
              return (
                <g key={n.id} transform={transform}>
                  <TabNote
                    note={stretched}
                    pxPerBar={pxPerBar}
                    selected={isSelected}
                    sounding={sounding.has(n.id)}
                    onPointerDown={pointer.onNotePointerDown}
                    onClick={(id, e) => select([id], e.shiftKey)}
                    onContextMenu={(id) => removeNotes([id])}
                  />
                </g>
              );
            })}
          </g>
          {pointer.marquee ? (
            <rect
              className="tab-marquee"
              data-testid="marquee"
              x={pointer.marquee.x}
              y={pointer.marquee.y}
              width={pointer.marquee.width}
              height={pointer.marquee.height}
            />
          ) : null}
          <EditCursor tick={editCursorTick} stringCount={stringCount} pxPerBar={pxPerBar} />
          <Playhead stringCount={stringCount} pxPerBar={pxPerBar} />
        </svg>
      </div>
    </div>
  );
}
