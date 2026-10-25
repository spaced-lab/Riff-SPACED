/**
 * Pointer handling for the tab lanes as an explicit state machine (P3.T3):
 *
 *   idle ──pointerdown on empty space──▶ marquee ──pointerup──▶ idle (select hits)
 *   idle ──pointerdown on a note──────▶ dragging ──pointerup──▶ idle (commit move)
 *   idle ──pointerdown on a right edge─▶ resizing ──pointerup──▶ idle (commit resize)
 *
 * While dragging or resizing, nothing is written to the store; the hook exposes a preview
 * (snapped tick and lane deltas) that TabLanes renders as a transform. One commit on
 * release means one undo step per gesture. Alt while dragging across lanes preserves
 * pitch by refingering (SPEC 5.4).
 */
import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { GRID, snapToGrid } from '@/music/time';
import { useStore } from '@/store';
import { noteBox, xToTick } from './geometry';

type Phase =
  | { kind: 'idle' }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number; additive: boolean }
  | { kind: 'dragging'; x0: number; y0: number; alt: boolean; dTicks: number; dLanes: number }
  | { kind: 'resizing'; x0: number; dTicks: number };

export type Marquee = { x: number; y: number; width: number; height: number };

export type TabPointer = {
  phase: Phase['kind'];
  marquee: Marquee | null;
  /** Snapped preview deltas applied to the selected notes while dragging. */
  dragPreview: { dTicks: number; dLanes: number } | null;
  resizePreview: number | null;
  onBackgroundPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onNotePointerDown: (noteId: string, e: ReactPointerEvent<SVGGElement>, edge: boolean) => void;
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: (e: ReactPointerEvent<SVGSVGElement>) => void;
};

function localPoint(e: { clientX: number; clientY: number; currentTarget: SVGElement }) {
  const target = e.currentTarget;
  const svg = target instanceof SVGSVGElement ? target : (target.ownerSVGElement ?? target);
  const rect = svg.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

export function useTabPointer(): TabPointer {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  // The phase is also kept in a ref so pointerup can read the latest value synchronously.
  const phaseRef = useRef<Phase>(phase);
  const update = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const onBackgroundPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      const { x, y } = localPoint(e);
      e.currentTarget.setPointerCapture?.(e.pointerId);
      update({ kind: 'marquee', x0: x, y0: y, x1: x, y1: y, additive: e.shiftKey });
    },
    [update],
  );

  const onNotePointerDown = useCallback(
    (noteId: string, e: ReactPointerEvent<SVGGElement>, edge: boolean) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const s = useStore.getState();
      if (!s.selectedNoteIds.includes(noteId)) s.select([noteId], e.shiftKey);
      const { x, y } = localPoint(e);
      e.currentTarget.ownerSVGElement?.setPointerCapture?.(e.pointerId);
      if (edge) update({ kind: 'resizing', x0: x, dTicks: 0 });
      else update({ kind: 'dragging', x0: x, y0: y, alt: e.altKey, dTicks: 0, dLanes: 0 });
    },
    [update],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const current = phaseRef.current;
      if (current.kind === 'idle') return;
      const { x, y } = localPoint(e);
      const { pxPerBar, grid } = useStore.getState();
      const step = GRID[grid];
      if (current.kind === 'marquee') {
        update({ ...current, x1: x, y1: y });
      } else if (current.kind === 'dragging') {
        const dTicks = snapToGrid(xToTick(x - current.x0, pxPerBar), step);
        const dLanes = Math.round((y - current.y0) / 28);
        if (dTicks !== current.dTicks || dLanes !== current.dLanes) {
          update({ ...current, alt: e.altKey || current.alt, dTicks, dLanes });
        }
      } else if (current.kind === 'resizing') {
        const dTicks = snapToGrid(xToTick(x - current.x0, pxPerBar), step);
        if (dTicks !== current.dTicks) update({ ...current, dTicks });
      }
    },
    [update],
  );

  const onPointerUp = useCallback(() => {
    const current = phaseRef.current;
    const s = useStore.getState();
    if (current.kind === 'marquee') {
      const x = Math.min(current.x0, current.x1);
      const y = Math.min(current.y0, current.y1);
      const w = Math.abs(current.x1 - current.x0);
      const h = Math.abs(current.y1 - current.y0);
      if (w < 3 && h < 3) {
        if (!current.additive) s.clearSelection();
      } else {
        const hits = s.riff.notes
          .filter((n) => {
            const b = noteBox(n.string, n.start, n.duration, s.pxPerBar);
            return b.x < x + w && b.x + b.width > x && b.y < y + h && b.y + b.height > y;
          })
          .map((n) => n.id);
        s.select(hits, current.additive);
      }
    } else if (current.kind === 'dragging') {
      if (current.dTicks !== 0 || current.dLanes !== 0) {
        s.moveSelection(current.dTicks, current.dLanes, { preservePitch: current.alt });
      }
    } else if (current.kind === 'resizing') {
      if (current.dTicks !== 0) s.resizeSelection(current.dTicks);
    }
    update({ kind: 'idle' });
  }, [update]);

  const marquee: Marquee | null =
    phase.kind === 'marquee'
      ? {
          x: Math.min(phase.x0, phase.x1),
          y: Math.min(phase.y0, phase.y1),
          width: Math.abs(phase.x1 - phase.x0),
          height: Math.abs(phase.y1 - phase.y0),
        }
      : null;

  return {
    phase: phase.kind,
    marquee,
    dragPreview: phase.kind === 'dragging' ? { dTicks: phase.dTicks, dLanes: phase.dLanes } : null,
    resizePreview: phase.kind === 'resizing' ? phase.dTicks : null,
    onBackgroundPointerDown,
    onNotePointerDown,
    onPointerMove,
    onPointerUp,
  };
}
