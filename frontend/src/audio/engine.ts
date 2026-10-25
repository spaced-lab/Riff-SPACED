/**
 * The engine binds the scheduler, the voices, and the store (SPEC 6.1, P4.T3).
 *
 * - It watches `isPlaying`: true starts the scheduler from the current riff and transport
 *   settings, false stops it.
 * - Riff edits while playing swap the notes in place; tempo edits rebind the clock.
 * - A requestAnimationFrame loop drains the scheduler's visual queue against the audio
 *   clock, batches the sounding set into `highlightIds` once per frame, moves the playhead
 *   through its ref, and throttles the position readout to 30 updates a second.
 *
 * All browser pieces are injected so the whole loop runs under fakes in tests.
 */
import { TICKS_PER_BAR } from '@/music/time';
import { useStore } from '@/store';
import type { AppState } from '@/store';
import { selectDisplayRiff } from '@/store/derived';
import { sameIds } from '@/store/selectionSlice';
import { playhead } from '@/tab/playheadRef';
import { getAudioContext, resumeAudio } from './context';
import { createMaster } from './master';
import type { Master, MasterContext } from './master';
import { Scheduler } from './scheduler';
import type { Playable, SchedulerClock } from './types';
import { createBasicVoice } from './voices/basic';
import { createHeavyVoice } from './voices/heavy';
import type { Voice } from './voices/types';

export type EngineContext = MasterContext & {
  currentTime: number;
  state: AudioContextState;
};

export type EngineDeps = {
  /** Create or fetch the audio context; may throw when Web Audio is unavailable. */
  getContext: () => EngineContext;
  resume: () => Promise<AudioContextState>;
  clock: (ctx: EngineContext) => SchedulerClock;
  requestFrame: (cb: () => void) => number;
  cancelFrame: (id: number) => void;
};

export const POSITION_UPDATES_PER_SECOND = 30;

type PlayableInputs = Pick<
  AppState,
  | 'riff'
  | 'soloSectionId'
  | 'editing'
  | 'library'
  | 'currentArrangementId'
  | 'currentSongId'
  | 'currentRiffId'
  | 'auditionRiff'
>;

/**
 * Build what the scheduler plays from the store: the open riff, or the flattened arrangement
 * or song when one is being edited, with the solo section as the loop window. While an AI
 * suggestion is being auditioned (Phase 7) it plays instead, whole, without touching the
 * open riff.
 */
export function playableFrom(state: PlayableInputs): Playable {
  if (state.auditionRiff) {
    const a = state.auditionRiff;
    return {
      notes: a.notes,
      tuningPitches: a.tuning.pitches,
      loopStartTick: 0,
      loopEndTick: a.lengthBars * TICKS_PER_BAR,
      bpm: a.tempo.bpm,
    };
  }
  const { soloSectionId } = state;
  const riff = selectDisplayRiff(state).riff;
  const section = soloSectionId ? riff.sections.find((s) => s.id === soloSectionId) : undefined;
  const loopStartTick = section ? section.startBar * TICKS_PER_BAR : 0;
  const loopEndTick = section
    ? (section.startBar + section.lengthBars) * TICKS_PER_BAR
    : riff.lengthBars * TICKS_PER_BAR;
  return {
    notes: riff.notes,
    tuningPitches: riff.tuning.pitches,
    loopStartTick,
    loopEndTick,
    bpm: riff.tempo.bpm,
  };
}

export class Engine {
  private deps: EngineDeps;
  private ctx: EngineContext | null = null;
  private master: Master | null = null;
  private voices: Partial<Record<'basic' | 'heavy', Voice>> = {};
  private scheduler: Scheduler | null = null;
  private frameId: number | null = null;
  private sounding = new Set<string>();
  private lastPositionWrite = 0;
  private jitterWindow: { at: number; ms: number }[] = [];
  private unsubscribe: (() => void) | null = null;

  constructor(deps: EngineDeps) {
    this.deps = deps;
  }

  /** Start watching the store. Idempotent. */
  attach(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = useStore.subscribe((state, previous) => {
      if (state.isPlaying !== previous.isPlaying) {
        if (state.isPlaying) void this.start();
        else this.stop();
        return;
      }
      if (!this.scheduler?.isRunning) return;
      if (state.riff !== previous.riff) {
        if (state.riff.tempo.bpm !== previous.riff.tempo.bpm)
          this.scheduler.setTempo(state.riff.tempo.bpm);
        if (
          state.riff.notes !== previous.riff.notes ||
          state.riff.lengthBars !== previous.riff.lengthBars
        ) {
          this.scheduler.setPlayable(playableFrom(state));
        }
      }
      if (state.soloSectionId !== previous.soloSectionId || state.voice !== previous.voice) {
        // Loop window or instrument changed: restart at the current position, no count-in.
        const tick = this.scheduler.positionTick();
        this.startScheduler(state, tick, false);
      }
      if (state.auditionRiff !== previous.auditionRiff) {
        // Switched between suggestions (or back to the riff) mid-play: restart from the top.
        this.startScheduler(state, 0, false);
      }
    });
  }

  detach(): void {
    this.stop();
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  get isRunning(): boolean {
    return this.scheduler?.isRunning ?? false;
  }

  private ensureAudio(): boolean {
    if (this.ctx) return true;
    try {
      this.ctx = this.deps.getContext();
    } catch {
      useStore.getState().setAudioState('unavailable');
      return false;
    }
    this.master = createMaster(this.ctx);
    this.voices.basic = createBasicVoice(this.ctx, this.master.input);
    this.voices.heavy = createHeavyVoice(this.ctx, this.master.input);
    this.scheduler = new Scheduler(this.deps.clock(this.ctx), this.master.sink(this.voices.basic));
    return true;
  }

  private async start(): Promise<void> {
    if (!this.ensureAudio()) {
      useStore.getState().stop();
      return;
    }
    const state = await this.deps.resume();
    // AudioContextState also has 'closed'; treat anything not running as suspended.
    useStore.getState().setAudioState(state === 'running' ? 'running' : 'suspended');
    if (!useStore.getState().isPlaying) return; // stopped while resuming
    const s = useStore.getState();
    const playable = playableFrom(s);
    const cursor = s.editCursorTick;
    const startTick =
      cursor >= playable.loopStartTick && cursor < playable.loopEndTick
        ? cursor
        : playable.loopStartTick;
    this.startScheduler(s, startTick, s.countIn);
  }

  private startScheduler(s: AppState, startTick: number, countIn: boolean): void {
    if (!this.scheduler || !this.master) return;
    const voice = this.voices[s.voice] ?? this.voices.basic!;
    // A new scheduler per start keeps the sink bound to the chosen voice.
    const wasRunning = this.scheduler.isRunning;
    if (wasRunning) this.scheduler.stop();
    this.scheduler = new Scheduler(this.deps.clock(this.ctx!), this.master.sink(voice));
    this.scheduler.start(playableFrom(s), {
      startTick,
      loop: s.loopEnabled,
      countInBars: countIn ? 1 : 0,
      metronome: s.metronome,
    });
    this.sounding.clear();
    this.jitterWindow = [];
    if (this.frameId === null) this.frameId = this.deps.requestFrame(this.frame);
  }

  stop(): void {
    this.scheduler?.stop();
    if (this.frameId !== null) this.deps.cancelFrame(this.frameId);
    this.frameId = null;
    this.sounding.clear();
    const s = useStore.getState();
    s.setHighlightIds([]);
    s.setInCountIn(false);
    s.setPositionTick(s.editCursorTick);
    playhead.setTick(s.editCursorTick);
    if (s.isPlaying) s.stop();
  }

  /** One animation frame: apply every visual event whose audio time has passed. */
  private frame = (): void => {
    this.frameId = null;
    const scheduler = this.scheduler;
    const ctx = this.ctx;
    if (!scheduler || !ctx) return;
    if (!scheduler.isRunning) {
      // A non-looping pass ended on its own.
      this.stop();
      return;
    }
    const now = ctx.currentTime;
    const events = scheduler.drainVisual(now);
    let changed = false;
    for (const e of events) {
      for (const id of e.noteIds) {
        if (e.on) this.sounding.add(id);
        else this.sounding.delete(id);
        changed = true;
      }
      this.jitterWindow.push({ at: now, ms: (now - e.audioTime) * 1000 });
    }
    const s = useStore.getState();
    if (changed) {
      const ids = [...this.sounding];
      if (!sameIds(s.highlightIds, ids)) s.setHighlightIds(ids);
    }
    const tick = scheduler.positionTick();
    playhead.setTick(tick);
    if (now - this.lastPositionWrite >= 1 / POSITION_UPDATES_PER_SECOND) {
      this.lastPositionWrite = now;
      s.setPositionTick(Math.floor(tick));
      s.setInCountIn(scheduler.inCountIn());
      this.jitterWindow = this.jitterWindow.filter((j) => now - j.at <= 1);
      if (this.jitterWindow.length) {
        const max = Math.max(...this.jitterWindow.map((j) => j.ms));
        if (s.syncJitterMs === null || Math.abs(max - s.syncJitterMs) >= 1)
          s.setSyncJitterMs(Math.round(max));
      }
    }
    this.frameId = this.deps.requestFrame(this.frame);
  };
}

/** Production dependencies: the real AudioContext, setInterval, requestAnimationFrame. */
export function browserDeps(): EngineDeps {
  return {
    getContext: () => getAudioContext() as unknown as EngineContext,
    resume: () => resumeAudio(),
    clock: (ctx) => ({
      now: () => ctx.currentTime,
      setInterval: (fn, ms) => window.setInterval(fn, ms),
      clearInterval: (id) => window.clearInterval(id),
    }),
    requestFrame: (cb) => window.requestAnimationFrame(cb),
    cancelFrame: (id) => window.cancelAnimationFrame(id),
  };
}

let singleton: Engine | null = null;

/** The app's engine, attached once from main.tsx. */
export function startEngine(deps: EngineDeps = browserDeps()): Engine {
  if (!singleton) {
    singleton = new Engine(deps);
    singleton.attach();
  }
  return singleton;
}
