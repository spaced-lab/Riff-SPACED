import { useMemo } from 'react';
import type { Note } from '@/model/types';
import { TICKS_PER_BAR } from '@/music/time';
import { useStore } from '@/store';
import { selectDisplayRiff } from '@/store/derived';
import { Fretboard } from './Fretboard';
import './splitView.css';

/**
 * Four-way split (SPEC 5.5): a 2x2 grid of mini fretboards, each showing one quarter of
 * the loop (1, 2, 3 or 4 bars per quadrant for loops of 4, 8, 12, 16). Each quadrant shows
 * every note that starts in its bar range; the quadrant containing the playback position
 * is outlined bright while playing, and sounding notes flash where they live.
 */
export function quadrantRanges(lengthBars: number): { fromBar: number; toBar: number }[] {
  const per = Math.max(1, Math.ceil(lengthBars / 4));
  const ranges = [];
  for (let i = 0; i < 4; i++) {
    const fromBar = i * per;
    const toBar = Math.min(lengthBars, fromBar + per);
    ranges.push({ fromBar, toBar: Math.max(fromBar, toBar) });
  }
  return ranges;
}

export function notesInBars(notes: readonly Note[], fromBar: number, toBar: number): Note[] {
  const from = fromBar * TICKS_PER_BAR;
  const to = toBar * TICKS_PER_BAR;
  return notes.filter((n) => n.start >= from && n.start < to);
}

export function SplitView() {
  const riff = useStore(selectDisplayRiff).riff;
  const showLetters = useStore((s) => s.showLetters);
  const accidentals = useStore((s) => s.accidentals);
  const fretRange = useStore((s) => s.fretRange);
  const realisticSpacing = useStore((s) => s.realisticSpacing);
  const highlightIds = useStore((s) => s.highlightIds);
  const selectedNoteIds = useStore((s) => s.selectedNoteIds);
  const isPlaying = useStore((s) => s.isPlaying);
  const positionTick = useStore((s) => s.positionTick);
  const editCursorTick = useStore((s) => s.editCursorTick);
  const select = useStore((s) => s.select);

  const ranges = useMemo(() => quadrantRanges(riff.lengthBars), [riff.lengthBars]);
  const tick = isPlaying ? positionTick : editCursorTick;
  const activeIndex = ranges.findIndex(
    (r) => tick >= r.fromBar * TICKS_PER_BAR && tick < r.toBar * TICKS_PER_BAR,
  );

  return (
    <div className="split-view" data-testid="split-view">
      {ranges.map((r, i) => {
        const active = isPlaying && i === activeIndex;
        const empty = r.toBar <= r.fromBar;
        return (
          <section
            key={i}
            className={
              active ? 'split-view__quadrant split-view__quadrant--active' : 'split-view__quadrant'
            }
            data-testid={`quadrant-${i}`}
            data-active={active ? 'true' : 'false'}
            aria-label={`bars ${r.fromBar + 1} to ${r.toBar}`}
          >
            <h4 className="split-view__title">
              {empty
                ? 'empty'
                : r.toBar - r.fromBar === 1
                  ? `bar ${r.fromBar + 1}`
                  : `bars ${r.fromBar + 1}-${r.toBar}`}
            </h4>
            <div className="split-view__board">
              <Fretboard
                tuning={riff.tuning}
                notes={notesInBars(riff.notes, r.fromBar, r.toBar)}
                highlightIds={highlightIds}
                selectedIds={selectedNoteIds}
                range={fretRange}
                showLetters={showLetters}
                accidentals={accidentals}
                realisticSpacing={realisticSpacing}
                onNoteClick={(id, e) => select([id], e.shiftKey)}
                label={`quadrant ${i + 1}`}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
