import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newRiff } from '@/model/factories';
import { bootstrapStore, useStore } from '@/store';
import { DIGIT_TIMEOUT_MS, handleKey, isTypingTarget, SHORTCUTS } from './keyboard';
import type { KeyInput } from './keyboard';

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

const deps = {
  getState: useStore.getState,
  setTimeout: (fn: () => void, ms: number) => window.setTimeout(fn, ms),
  clearTimeout: (id: number) => window.clearTimeout(id),
};

describe('keyboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
    useStore.getState().setRiff(newRiff());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a single digit commits after the timeout on the active lane', () => {
    expect(handleKey(key('5'), deps)).toBe(true);
    expect(useStore.getState().pendingFret).toBe('5');
    expect(useStore.getState().riff.notes).toHaveLength(0);
    vi.advanceTimersByTime(DIGIT_TIMEOUT_MS);
    expect(useStore.getState().pendingFret).toBeNull();
    expect(useStore.getState().riff.notes[0]).toMatchObject({ string: 6, fret: 5, start: 0 });
  });

  it('two digits within the window make a two-digit fret, Enter commits early, Esc cancels', () => {
    handleKey(key('1'), deps);
    vi.advanceTimersByTime(100);
    handleKey(key('2'), deps);
    expect(useStore.getState().riff.notes[0]!.fret).toBe(12);

    useStore.getState().moveCursor(1);
    handleKey(key('7'), deps);
    handleKey(key('Enter'), deps);
    expect(useStore.getState().riff.notes[1]).toMatchObject({ fret: 7, start: 120 });

    useStore.getState().moveCursor(1);
    handleKey(key('3'), deps);
    handleKey(key('Escape'), deps);
    vi.advanceTimersByTime(DIGIT_TIMEOUT_MS * 2);
    expect(useStore.getState().riff.notes).toHaveLength(2);
    expect(useStore.getState().pendingFret).toBeNull();
  });

  it('digits above 24 do not combine: 2 then 9 is fret 2 then fret 9', () => {
    handleKey(key('2'), deps);
    handleKey(key('9'), deps);
    vi.advanceTimersByTime(DIGIT_TIMEOUT_MS);
    expect(useStore.getState().riff.notes.map((n) => n.fret)).toEqual([9]);
  });

  it('arrows move the cursor and lane, brackets change the grid, Tab toggles letters', () => {
    handleKey(key('ArrowRight'), deps);
    handleKey(key('ArrowRight'), deps);
    expect(useStore.getState().editCursorTick).toBe(240);
    handleKey(key('ArrowRight', { shiftKey: true }), deps);
    expect(useStore.getState().editCursorTick).toBe(1920 + 240);
    handleKey(key('ArrowLeft', { shiftKey: true }), deps);
    handleKey(key('ArrowLeft'), deps);
    expect(useStore.getState().editCursorTick).toBe(120);
    handleKey(key('ArrowUp'), deps);
    expect(useStore.getState().activeLane).toBe(5);
    handleKey(key('ArrowDown'), deps);
    handleKey(key('ArrowDown'), deps);
    expect(useStore.getState().activeLane).toBe(6);
    handleKey(key(']'), deps);
    expect(useStore.getState().grid).toBe('1/8T');
    handleKey(key('['), deps);
    expect(useStore.getState().grid).toBe('1/16');
    handleKey(key('Tab'), deps);
    expect(useStore.getState().showLetters).toBe(true);
  });

  it('Delete removes the selection, Ctrl+A selects all, Esc clears selection, unknown keys pass', () => {
    handleKey(key('3'), deps);
    handleKey(key('Enter'), deps);
    handleKey(key('a', { ctrlKey: true }), deps);
    expect(useStore.getState().selectedNoteIds).toHaveLength(1);
    handleKey(key('Escape'), deps);
    expect(useStore.getState().selectedNoteIds).toHaveLength(0);
    handleKey(key('a', { metaKey: true }), deps);
    handleKey(key('Delete'), deps);
    expect(useStore.getState().riff.notes).toHaveLength(0);
    expect(handleKey(key('q'), deps)).toBe(false);
    expect(handleKey(key('a'), deps)).toBe(false);
  });

  it('Ctrl/Cmd+Z undoes, Shift adds redo, Ctrl+Y redoes', () => {
    handleKey(key('3'), deps);
    handleKey(key('Enter'), deps);
    expect(useStore.getState().riff.notes).toHaveLength(1);
    handleKey(key('z', { metaKey: true }), deps);
    expect(useStore.getState().riff.notes).toHaveLength(0);
    handleKey(key('z', { metaKey: true, shiftKey: true }), deps);
    expect(useStore.getState().riff.notes).toHaveLength(1);
    handleKey(key('z', { ctrlKey: true }), deps);
    handleKey(key('y', { ctrlKey: true }), deps);
    expect(useStore.getState().riff.notes).toHaveLength(1);
  });

  it('Space toggles play, L toggles loop, - and = nudge the tempo', () => {
    handleKey(key(' '), deps);
    expect(useStore.getState().isPlaying).toBe(true);
    handleKey(key(' '), deps);
    expect(useStore.getState().isPlaying).toBe(false);
    handleKey(key('l'), deps);
    expect(useStore.getState().loopEnabled).toBe(false);
    const bpm = useStore.getState().riff.tempo.bpm;
    handleKey(key('='), deps);
    handleKey(key('='), deps);
    handleKey(key('-'), deps);
    expect(useStore.getState().riff.tempo.bpm).toBe(bpm + 1);
  });

  it('knows which targets are typing targets and lists the shortcut table', () => {
    const input = document.createElement('input');
    expect(isTypingTarget(input)).toBe(true);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    expect(isTypingTarget(checkbox)).toBe(false);
    const number = document.createElement('input');
    number.type = 'number';
    expect(isTypingTarget(number)).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(false);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(SHORTCUTS.some((s) => s.keys === '0-9')).toBe(true);
  });

  it('< and > step the scale position (Phase 9)', () => {
    expect(useStore.getState().scalePosition).toBeNull();
    expect(handleKey(key('>'), deps)).toBe(true);
    expect(useStore.getState().scalePosition).toBe(0);
    expect(handleKey(key('>'), deps)).toBe(true);
    expect(useStore.getState().scalePosition).toBe(1);
    expect(handleKey(key('<'), deps)).toBe(true);
    expect(handleKey(key('<'), deps)).toBe(true);
    expect(useStore.getState().scalePosition).toBeNull();
    expect(SHORTCUTS.some((sc) => sc.keys === '< / >')).toBe(true);
  });

  it('F toggles the wide fretboard, Cmd+F is left to the browser', () => {
    expect(handleKey(key('f'), deps)).toBe(true);
    expect(useStore.getState().wideBoard).toBe(true);
    expect(handleKey(key('F'), deps)).toBe(true);
    expect(useStore.getState().wideBoard).toBe(false);
    expect(handleKey(key('f', { metaKey: true }), deps)).toBe(false);
  });
});
