/**
 * Undo history as a stack of riff snapshots (SPEC 5.9). Riffs are small, so whole-document
 * snapshots are simpler and safer than diffs. Capped at 200 entries. Phase 3 adds the
 * undo/redo actions; Phase 2 only records snapshots so the mechanism is exercised early.
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
