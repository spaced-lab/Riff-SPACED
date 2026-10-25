/**
 * Keyboard shortcuts (SPEC 5.8) as data plus one pure handler, so the table can be shown
 * in Help and the behavior can be tested with fake timers and no DOM.
 */
import type { AppState } from '@/store';

export type Shortcut = { keys: string; description: string; phase: number };

export const SHORTCUTS: readonly Shortcut[] = [
  { keys: 'Space', description: 'play / stop', phase: 4 },
  { keys: 'L', description: 'loop on / off', phase: 4 },
  { keys: 'Left / Right', description: 'move the edit cursor one grid step', phase: 3 },
  { keys: 'Shift+Left / Shift+Right', description: 'move the edit cursor one bar', phase: 3 },
  { keys: 'Up / Down', description: 'change the active string lane', phase: 3 },
  {
    keys: '0-9',
    description: 'type a fret number for the active lane at the cursor (two digits within 400 ms)',
    phase: 3,
  },
  { keys: 'Enter', description: 'commit the typed fret now', phase: 3 },
  { keys: 'Esc', description: 'cancel the typed fret / clear the selection', phase: 3 },
  { keys: 'Delete / Backspace', description: 'remove the selected notes', phase: 3 },
  { keys: 'Ctrl/Cmd+A', description: 'select all notes', phase: 3 },
  { keys: 'Ctrl/Cmd+Z', description: 'undo', phase: 3 },
  { keys: 'Ctrl/Cmd+Shift+Z', description: 'redo', phase: 3 },
  { keys: 'Ctrl/Cmd+C / X / V', description: 'copy / cut / paste at the cursor', phase: 3 },
  { keys: 'Ctrl/Cmd+D', description: 'duplicate the selection one grid step later', phase: 3 },
  { keys: 'Ctrl/Cmd+S', description: 'save (Shift: save as)', phase: 5 },
  { keys: 'Ctrl/Cmd+O', description: 'open a file', phase: 5 },
  { keys: '[ / ]', description: 'coarser / finer grid', phase: 3 },
  { keys: '- / =', description: 'tempo down / up by 1', phase: 4 },
  { keys: 'Tab', description: 'toggle note letters', phase: 3 },
  { keys: '< / >', description: 'scale position down / up the neck (Scales menu)', phase: 9 },
];

/** How long a first digit waits for a second one before the fret is committed. */
export const DIGIT_TIMEOUT_MS = 400;

export type KeyInput = {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
};

/** The parts of the store the handler needs; `getState` keeps it live. */
export type KeyboardDeps = {
  getState: () => AppState;
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
};

/** Pending-digit timer, module scoped so one keyboard owns one buffer. */
let digitTimer: number | null = null;

export function commitPendingFret(deps: KeyboardDeps): void {
  const s = deps.getState();
  if (digitTimer !== null) deps.clearTimeout(digitTimer);
  digitTimer = null;
  if (s.pendingFret === null) return;
  const fret = Number(s.pendingFret);
  s.setPendingFret(null);
  if (Number.isInteger(fret) && fret >= 0 && fret <= 24) s.addNoteAtCursor(s.activeLane, fret);
}

export function cancelPendingFret(deps: KeyboardDeps): void {
  if (digitTimer !== null) deps.clearTimeout(digitTimer);
  digitTimer = null;
  deps.getState().setPendingFret(null);
}

/**
 * Handle one key press. Returns true when the key was consumed (the caller should
 * preventDefault). Shortcuts from later phases are listed in SHORTCUTS but wired there.
 */
export function handleKey(e: KeyInput, deps: KeyboardDeps): boolean {
  const s = deps.getState();
  const mod = e.ctrlKey || e.metaKey;
  // Arrangements and songs are read-only views; only transport keys apply there.
  const readOnly = s.editing !== 'riff';

  if (/^[0-9]$/.test(e.key) && !mod) {
    if (readOnly) return false;
    const next = (s.pendingFret ?? '') + e.key;
    if (digitTimer !== null) deps.clearTimeout(digitTimer);
    if (s.pendingFret !== null && Number(next) <= 24 && s.pendingFret.length === 1) {
      s.setPendingFret(next);
      commitPendingFret(deps);
      return true;
    }
    s.setPendingFret(e.key);
    digitTimer = deps.setTimeout(() => commitPendingFret(deps), DIGIT_TIMEOUT_MS);
    return true;
  }

  switch (e.key) {
    case ' ':
      s.togglePlay();
      return true;
    case 'l':
    case 'L':
      if (mod) return false;
      s.setLoopEnabled(!s.loopEnabled);
      return true;
    case '-':
    case '_':
      s.nudgeBpm(-1);
      return true;
    case '=':
    case '+':
      s.nudgeBpm(1);
      return true;
    case 'Enter':
      if (readOnly) return false;
      commitPendingFret(deps);
      return true;
    case 'Escape':
      if (s.pendingFret !== null) cancelPendingFret(deps);
      else s.clearSelection();
      return true;
    case 'ArrowLeft':
      if (e.shiftKey) s.moveCursorBars(-1);
      else s.moveCursor(-1);
      return true;
    case 'ArrowRight':
      if (e.shiftKey) s.moveCursorBars(1);
      else s.moveCursor(1);
      return true;
    case 'ArrowUp':
      s.setActiveLane(Math.max(1, s.activeLane - 1));
      return true;
    case 'ArrowDown':
      s.setActiveLane(Math.min(s.riff.tuning.pitches.length, s.activeLane + 1));
      return true;
    case 'Delete':
    case 'Backspace':
      if (readOnly) return false;
      if (s.selectedNoteIds.length) s.removeNotes(s.selectedNoteIds);
      return true;
    case 'Tab':
      s.setShowLetters(!s.showLetters);
      return true;
    case '[':
      s.cycleGrid(-1);
      return true;
    case ']':
      s.cycleGrid(1);
      return true;
    case '<':
      s.stepScalePosition(-1);
      return true;
    case '>':
      s.stepScalePosition(1);
      return true;
    case 'a':
    case 'A':
      if (mod) {
        s.selectAll();
        return true;
      }
      return false;
    case 'z':
    case 'Z':
      if (mod && readOnly) return false;
      if (mod) {
        if (e.shiftKey) s.redo();
        else s.undo();
        return true;
      }
      return false;
    case 'y':
    case 'Y':
      if (mod && readOnly) return false;
      if (mod) {
        s.redo();
        return true;
      }
      return false;
    case 's':
    case 'S':
      if (mod) {
        void s.saveCurrent({ saveAs: e.shiftKey });
        return true;
      }
      return false;
    case 'o':
    case 'O':
      if (mod) {
        void s.openFromDisk();
        return true;
      }
      return false;
    case 'c':
    case 'C':
      if (mod) {
        s.copySelection();
        return true;
      }
      return false;
    case 'x':
    case 'X':
      if (mod && readOnly) return false;
      if (mod) {
        s.cutSelection();
        return true;
      }
      return false;
    case 'v':
    case 'V':
      if (mod && readOnly) return false;
      if (mod) {
        s.pasteAtCursor();
        return true;
      }
      return false;
    case 'd':
    case 'D':
      if (mod && readOnly) return false;
      if (mod) {
        s.duplicateSelection();
        return true;
      }
      return false;
    default:
      return false;
  }
}

const TEXT_INPUT_TYPES = new Set([
  'text',
  'number',
  'search',
  'email',
  'url',
  'password',
  'tel',
  '',
]);

/**
 * Shortcuts must not fire while typing in a form control. Checkboxes, buttons, ranges and
 * selects are not typing targets: Space on a focused checkbox should still play.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable === true) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') return TEXT_INPUT_TYPES.has((target as HTMLInputElement).type.toLowerCase());
  return false;
}
