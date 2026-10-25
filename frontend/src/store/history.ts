/**
 * Undo history as a stack of riff snapshots (SPEC 5.9). Riffs are small, so whole-document
 * snapshots are simpler and safer than diffs. Capped at 200 entries.
 */
import type { Riff } from '@/model/types';

export type HistoryEntry = { label: string; snapshot: Riff };

export type History = {
  past: HistoryEntry[];
  future: HistoryEntry[];
};

export const HISTORY_CAP = 200;

export const emptyHistory = (): History => ({ past: [], future: [] });

/** Record `snapshot` (the state before a change) under `label`; a new change clears redo. */
export function pushHistory(history: History, label: string, snapshot: Riff): History {
  const past = [...history.past, { label, snapshot: structuredClone(snapshot) }];
  if (past.length > HISTORY_CAP) past.splice(0, past.length - HISTORY_CAP);
  return { past, future: [] };
}

/** Step back: the current riff goes onto the redo stack, the latest snapshot comes back. */
export function undo(history: History, current: Riff): { history: History; riff: Riff } | null {
  const entry = history.past[history.past.length - 1];
  if (!entry) return null;
  return {
    riff: entry.snapshot,
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, { label: entry.label, snapshot: structuredClone(current) }],
    },
  };
}

/** Step forward again after an undo. */
export function redo(history: History, current: Riff): { history: History; riff: Riff } | null {
  const entry = history.future[history.future.length - 1];
  if (!entry) return null;
  return {
    riff: entry.snapshot,
    history: {
      past: [...history.past, { label: entry.label, snapshot: structuredClone(current) }],
      future: history.future.slice(0, -1),
    },
  };
}
