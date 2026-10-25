/**
 * The lookahead scheduler (SPEC 6.1, the "two clocks" pattern).
 *
 * JavaScript timers are jittery (tens of milliseconds); the audio clock is exact. So a
 * coarse setInterval wakes up every 25 ms and hands the audio clock every event that falls
 * within the next 100 ms, with precise times. Audio nodes then fire on their own schedule
 * regardless of what the main thread is doing.
 *
 * Loop wrap: events are walked in absolute ticks (a count that never resets), so the first
 * notes of pass 2 are scheduled while pass 1 is still sounding. Nothing is reset mid-pass.
 *
 * Visual sync: every noteOn/noteOff is also pushed to a visual queue with its audio time.
 * The engine drains that queue from requestAnimationFrame against the audio clock.
 */
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '@/music/time';
import { pitchOfArray } from './pitch';
import { TempoClock, wrapTick } from './clock';
import type { Playable, SchedulerClock, StartOptions, VisualEvent, VoiceSink } from './types';

export const LOOKAHEAD_SECONDS = 0.1;
export const INTERVAL_MS = 25;
/** Small delay before the first event so the first noteOn is never already in the past. */
export const START_DELAY_SECONDS = 0.05;

type Cursor = {
  /** Next absolute tick to consider for note starts. */
  absoluteTick: number;
  /** Which loop pass that tick belongs to (0 = first). */
  pass: number;
};

export class Scheduler {
  private playable: Playable | null = null;
  private tempo: TempoClock | null = null;
  private intervalId: number | null = null;
  private cursor: Cursor = { absoluteTick: 0, pass: 0 };
  private loop = true;
  private metronome = false;
  private countInTicks = 0;
  /** Absolute tick where the loop content starts (after any count-in). */
  private contentOriginTick = 0;
  private running = false;
  private pendingOffs: { time: number; tick: number; noteId: string }[] = [];
  private visualQueue: VisualEvent[] = [];
  private endTime: number | null = null;
  /** `${pass}:${noteId}` of every note already handed out, so a cursor rewind never doubles a note. */
  private scheduled = new Set<string>();

  private readonly clock: SchedulerClock;
  private readonly sink: VoiceSink;
  private readonly lookahead: number;
  private readonly intervalMs: number;

  constructor(
    clock: SchedulerClock,
    sink: VoiceSink,
    lookahead = LOOKAHEAD_SECONDS,
    intervalMs = INTERVAL_MS,
  ) {
    this.clock = clock;
    this.sink = sink;
    this.lookahead = lookahead;
    this.intervalMs = intervalMs;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get bpm(): number {
    return this.tempo?.bpm ?? this.playable?.bpm ?? 120;
  }

  start(playable: Playable, options: StartOptions = {}): void {
    this.stop();
    this.playable = playable;
    this.loop = options.loop ?? true;
    this.metronome = options.metronome ?? false;
    const countInBars = options.countInBars ?? 0;
    this.countInTicks = countInBars * TICKS_PER_BAR;
    const startTick = Math.max(
      playable.loopStartTick,
      Math.min(playable.loopEndTick - 1, options.startTick ?? playable.loopStartTick),
    );

    // Absolute tick 0 is where playback begins. The count-in occupies [0, countInTicks);
    // the loop content starts at contentOriginTick and absolute tick a maps to loop tick
    // loopStart + (startTick - loopStart + a - contentOriginTick) mod loopLength.
    this.contentOriginTick = this.countInTicks;
    this.cursor = { absoluteTick: 0, pass: 0 };
    this.startOffsetTick = startTick - playable.loopStartTick;
    this.tempo = new TempoClock(playable.bpm, this.clock.now() + START_DELAY_SECONDS, 0);
    this.pendingOffs = [];
    this.visualQueue = [];
    this.endTime = null;
    this.scheduled.clear();
    this.running = true;
    this.scheduleAhead();
    this.intervalId = this.clock.setInterval(() => this.scheduleAhead(), this.intervalMs);
  }

  /** How far into the loop playback started, in ticks from loopStart. */
  private startOffsetTick = 0;

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.intervalId !== null) this.clock.clearInterval(this.intervalId);
    this.intervalId = null;
    const now = this.clock.now();
    this.sink.allOff(now);
    this.pendingOffs = [];
    this.visualQueue.push({ audioTime: now, noteIds: [], on: false, tick: this.positionTick() });
  }

  /** Change tempo while playing: restart the mapping at the current position, no click. */
  setTempo(bpm: number): void {
    if (!this.playable || !this.tempo || !this.running) {
      if (this.playable) this.playable = { ...this.playable, bpm };
      return;
    }
    const now = this.clock.now();
    const currentAbsolute = this.tempo.tickAt(now);
    this.tempo = new TempoClock(bpm, now, currentAbsolute);
    this.playable = { ...this.playable, bpm };
    // Events already handed to the audio clock keep their old times; the next lookahead
    // window continues from the new mapping. A 100 ms seam is inaudible for a tempo nudge.
  }

  /**
   * Replace the notes without stopping (editing while playing). The cursor rewinds to the
   * current position so a note added just ahead of the playhead sounds this pass; the
   * scheduled-key set keeps notes already handed out from sounding twice.
   */
  setPlayable(playable: Playable): void {
    if (!this.running || !this.playable || !this.tempo) {
      this.playable = playable;
      return;
    }
    this.playable = { ...playable, bpm: this.playable.bpm };
    const nowTick = Math.floor(this.tempo.tickAt(this.clock.now()));
    this.cursor = {
      absoluteTick: Math.max(this.contentOriginTick, nowTick),
      pass: this.cursor.pass,
    };
  }

  /** Current loop-relative tick, or the start tick when stopped. */
  positionTick(): number {
    if (!this.playable || !this.tempo) return 0;
    const absolute = this.tempo.tickAt(this.clock.now());
    return this.loopTickOf(absolute);
  }

  /** True while the count-in bar is sounding. */
  inCountIn(): boolean {
    if (!this.running || !this.tempo) return false;
    return this.tempo.tickAt(this.clock.now()) < this.contentOriginTick;
  }

  /** Absolute tick to loop-relative tick, respecting the start offset and the loop window. */
  private loopTickOf(absoluteTick: number): number {
    const p = this.playable!;
    const rel = absoluteTick - this.contentOriginTick + this.startOffsetTick;
    if (rel < 0) return p.loopStartTick + this.startOffsetTick;
    if (!this.loop && rel >= p.loopEndTick - p.loopStartTick) return p.loopEndTick;
    return wrapTick(p.loopStartTick + rel, p.loopStartTick, p.loopEndTick);
  }

  /** Visual events whose audio time has arrived. */
  drainVisual(now: number): VisualEvent[] {
    const due: VisualEvent[] = [];
    const rest: VisualEvent[] = [];
    for (const e of this.visualQueue) (e.audioTime <= now ? due : rest).push(e);
    this.visualQueue = rest;
    return due;
  }

  /** The core: hand the sink every event up to now + lookahead. */
  private scheduleAhead(): void {
    if (!this.running || !this.playable || !this.tempo) return;
    const p = this.playable;
    const horizon = this.clock.now() + this.lookahead;
    const loopLength = p.loopEndTick - p.loopStartTick;

    // Pending note offs first; they were computed when the note was scheduled.
    this.pendingOffs.sort((a, b) => a.time - b.time);
    while (this.pendingOffs.length && this.pendingOffs[0]!.time <= horizon) {
      const off = this.pendingOffs.shift()!;
      this.sink.schedule({ kind: 'noteOff', time: off.time, tick: off.tick, noteId: off.noteId });
      this.visualQueue.push({
        audioTime: off.time,
        noteIds: [off.noteId],
        on: false,
        tick: off.tick,
      });
    }

    if (this.endTime !== null) {
      if (this.clock.now() >= this.endTime && this.pendingOffs.length === 0) this.stop();
      return;
    }

    // Walk absolute ticks up to the horizon. Each step lands on the next event tick.
    for (let guard = 0; guard < 10_000; guard++) {
      const a = this.cursor.absoluteTick;
      const time = this.tempo.timeOf(a);
      if (time > horizon) break;

      if (a < this.contentOriginTick) {
        // Count-in: a click on every beat, accent on the downbeat.
        if (this.metronome || this.countInTicks > 0) {
          const beatInBar = (a % TICKS_PER_BAR) / TICKS_PER_BEAT;
          this.sink.schedule({ kind: 'click', time, tick: a, accent: beatInBar === 0 });
        }
        this.cursor.absoluteTick = Math.min(this.contentOriginTick, a + TICKS_PER_BEAT);
        continue;
      }

      const rel = a - this.contentOriginTick + this.startOffsetTick;
      const pass = Math.floor(rel / loopLength);
      if (!this.loop && pass > 0) {
        this.endTime = time;
        break;
      }
      const loopTick = p.loopStartTick + (rel - pass * loopLength);
      const passStartAbsolute = a - (loopTick - p.loopStartTick);

      if (this.metronome && (loopTick - p.loopStartTick) % TICKS_PER_BEAT === 0) {
        const beatInBar = (loopTick % TICKS_PER_BAR) / TICKS_PER_BEAT;
        this.sink.schedule({ kind: 'click', time, tick: loopTick, accent: beatInBar === 0 });
      }

      if (pass !== this.cursor.pass) {
        // New pass: forget keys from two passes back so the set stays small.
        for (const key of this.scheduled)
          if (Number(key.split(':')[0]) < pass - 1) this.scheduled.delete(key);
      }
      const starting = p.notes.filter(
        (n) => n.start === loopTick && !this.scheduled.has(`${pass}:${n.id}`),
      );
      if (starting.length) {
        const ids: string[] = [];
        for (const n of starting) {
          this.scheduled.add(`${pass}:${n.id}`);
          const offAbsolute = a + n.duration;
          const offTime = this.tempo.timeOf(offAbsolute);
          this.sink.schedule({
            kind: 'noteOn',
            time,
            tick: loopTick,
            noteId: n.id,
            pitch: pitchOfArray(p.tuningPitches, n.string, n.fret),
            velocity: n.velocity ?? 100,
            techniques: n.techniques ?? [],
            duration: offTime - time,
          });
          this.pendingOffs.push({ time: offTime, tick: loopTick + n.duration, noteId: n.id });
          ids.push(n.id);
        }
        this.visualQueue.push({ audioTime: time, noteIds: ids, on: true, tick: loopTick });
      }

      // Jump to the next interesting tick: the next note start, beat (for the metronome),
      // or the loop end, whichever comes first.
      let next = p.loopEndTick;
      for (const n of p.notes) if (n.start > loopTick && n.start < next) next = n.start;
      if (this.metronome) {
        const nextBeat =
          loopTick - ((loopTick - p.loopStartTick) % TICKS_PER_BEAT) + TICKS_PER_BEAT;
        if (nextBeat < next) next = nextBeat;
      }
      this.cursor = { absoluteTick: passStartAbsolute + (next - p.loopStartTick), pass };
    }
  }
}
