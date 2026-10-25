/**
 * Offline render (SPEC 6.3): play a riff through the same scheduler and voices into an
 * OfflineAudioContext and encode the result as WAV. Used by File > Export > WAV (Phase 8)
 * and by the e2e suite to prove playback is not silent without anyone listening.
 */
import { TICKS_PER_BAR, ticksToSeconds } from '@/music/time';
import type { Riff } from '@/model/types';
import { encodeWav } from '@/export/wav';
import type { VoiceName } from '@/store/transportSlice';
import { createMaster } from './master';
import type { MasterContext } from './master';
import { Scheduler } from './scheduler';
import { createBasicVoice } from './voices/basic';
import { createHeavyVoice } from './voices/heavy';

export type RenderOptions = {
  voice?: VoiceName;
  /** Number of loop passes to render. */
  passes?: number;
  sampleRate?: number;
  /** Seconds of tail after the last pass so releases finish. */
  tail?: number;
};

export type RenderResult = { buffer: AudioBuffer; wav: ArrayBuffer; seconds: number };

/**
 * The scheduler normally runs on a timer. Offline, time is whatever we say it is: we drive
 * the scheduler's interval callback by hand across the whole duration before rendering.
 */
export async function renderRiff(riff: Riff, options: RenderOptions = {}): Promise<RenderResult> {
  const passes = options.passes ?? 1;
  const sampleRate = options.sampleRate ?? 44100;
  const tail = options.tail ?? 0.5;
  const loopSeconds = ticksToSeconds(riff.lengthBars * TICKS_PER_BAR, riff.tempo.bpm);
  const seconds = loopSeconds * passes + tail;
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);

  // A manual clock: `now` advances as we step, and the single interval is our step function.
  // (An object holder rather than a `let`, so TypeScript does not narrow it to null.)
  let now = 0;
  const timer: { step: (() => void) | null } = { step: null };
  const clock = {
    now: () => now,
    setInterval: (fn: () => void) => {
      timer.step = fn;
      return 1;
    },
    clearInterval: () => {
      timer.step = null;
    },
  };
  const master = createMaster(ctx as unknown as MasterContext);
  const voice =
    options.voice === 'heavy'
      ? createHeavyVoice(ctx, master.input)
      : createBasicVoice(ctx, master.input);
  const scheduler = new Scheduler(clock, master.sink(voice));
  scheduler.start(
    {
      notes: riff.notes,
      tuningPitches: riff.tuning.pitches,
      loopStartTick: 0,
      loopEndTick: riff.lengthBars * TICKS_PER_BAR,
      bpm: riff.tempo.bpm,
    },
    { loop: passes > 1, startTick: 0 },
  );
  // Walk the whole timeline in 25 ms steps so every event lands within a lookahead window.
  const end = loopSeconds * passes;
  while (now < end && scheduler.isRunning) {
    now += 0.025;
    timer.step?.();
  }
  scheduler.stop();

  const buffer = await ctx.startRendering();
  return { buffer, wav: encodeWav([buffer.getChannelData(0)], sampleRate), seconds };
}

/** Convenience for File > Export: a Blob ready for download. */
export async function renderRiffToWav(riff: Riff, options: RenderOptions = {}): Promise<Blob> {
  const { wav } = await renderRiff(riff, options);
  return new Blob([wav], { type: 'audio/wav' });
}

/** Root mean square of a buffer, for silence checks. */
export function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!;
  return Math.sqrt(sum / Math.max(1, samples.length));
}

/** Seconds until the signal first exceeds `threshold` in absolute value, or null. */
export function firstOnset(
  samples: Float32Array,
  sampleRate: number,
  threshold = 0.02,
): number | null {
  for (let i = 0; i < samples.length; i++)
    if (Math.abs(samples[i]!) > threshold) return i / sampleRate;
  return null;
}
