/**
 * Shared types for the playback engine (SPEC 6). Nothing in src/audio imports React.
 */
import type { Note, Technique } from '@/model/types';

/** What the scheduler needs to play: notes, a loop window, and a tempo. */
export type Playable = {
  notes: readonly Note[];
  /** Open-string pitches low to high; the engine needs them to turn (string, fret) into Hz. */
  tuningPitches: readonly number[];
  /** Loop window in ticks, [start, end). */
  loopStartTick: number;
  loopEndTick: number;
  bpm: number;
};

export type StartOptions = {
  /** Tick to begin at (within the loop window). */
  startTick?: number;
  loop?: boolean;
  /** Bars of metronome clicks before tick 0 of the loop. */
  countInBars?: number;
  metronome?: boolean;
};

/** A note the scheduler has decided to sound: everything a voice needs, already resolved. */
export type NoteOnEvent = {
  kind: 'noteOn';
  time: number;
  tick: number;
  noteId: string;
  pitch: number;
  velocity: number;
  techniques: readonly Technique[];
  /** Seconds until the matching noteOff, so a voice can plan its envelope. */
  duration: number;
};

export type NoteOffEvent = { kind: 'noteOff'; time: number; tick: number; noteId: string };

export type ClickEvent = { kind: 'click'; time: number; tick: number; accent: boolean };

export type AudioEvent = NoteOnEvent | NoteOffEvent | ClickEvent;

/** Where sound goes. The engine wires voices here; tests wire a recorder. */
export type VoiceSink = {
  schedule: (event: AudioEvent) => void;
  /** Called on stop so voices can release everything already scheduled. */
  allOff: (time: number) => void;
};

/** What the screen needs: at `audioTime`, these notes turned on or off. */
export type VisualEvent = { audioTime: number; noteIds: string[]; on: boolean; tick: number };

/** Injectable clock and timers so the scheduler runs under a fake clock in tests. */
export type SchedulerClock = {
  /** Current audio time in seconds (AudioContext.currentTime in the browser). */
  now: () => number;
  setInterval: (fn: () => void, ms: number) => number;
  clearInterval: (id: number) => void;
};
