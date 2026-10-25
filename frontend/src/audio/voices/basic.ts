/**
 * The basic synth voice (SPEC 6.2): per note, a sawtooth and a slightly detuned square
 * through a lowpass into an ADSR gain. Three techniques change the envelope:
 * palmMute (short, dark), letRing (long release), dead (a noise burst, no pitch).
 */
import { freqOf } from '@/music/pitch';
import type { NoteOnEvent } from '../types';
import { noiseBuffer } from './noise';
import { FAST_RELEASE, velocityGain } from './types';
import type { Voice, VoiceContext, VoiceHandle } from './types';

export type Envelope = {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  cutoff: number;
};

export const BASIC_ENVELOPE: Envelope = {
  attack: 0.003,
  decay: 0.15,
  sustain: 0.6,
  release: 0.06,
  cutoff: 2500,
};
export const PALM_MUTE_ENVELOPE: Envelope = {
  ...BASIC_ENVELOPE,
  decay: 0.09,
  sustain: 0,
  release: 0.03,
  cutoff: 1200,
};
export const LET_RING_RELEASE = 0.4;
export const DEAD_NOISE_SECONDS = 0.04;
export const DEAD_BANDPASS_HZ = 180;

export function envelopeFor(techniques: readonly string[]): Envelope {
  let env = techniques.includes('palmMute') ? PALM_MUTE_ENVELOPE : BASIC_ENVELOPE;
  if (techniques.includes('letRing')) env = { ...env, release: LET_RING_RELEASE };
  return env;
}

type Active = {
  handle: VoiceHandle;
  gain: GainNode;
  sources: (OscillatorNode | AudioBufferSourceNode)[];
  endTime: number;
};

/**
 * Schedule a full ADSR on a gain param: attack to `peak`, decay to `sustain * peak`,
 * hold until `offTime`, then release toward 0. Returns when the sound is fully over.
 */
export function scheduleAdsr(
  gain: AudioParam,
  time: number,
  offTime: number,
  peak: number,
  env: Envelope,
): number {
  const attackEnd = time + env.attack;
  const decayEnd = attackEnd + env.decay;
  gain.setValueAtTime(0, time);
  gain.linearRampToValueAtTime(peak, attackEnd);
  gain.linearRampToValueAtTime(peak * env.sustain, decayEnd);
  const releaseStart = Math.max(offTime, attackEnd);
  if (releaseStart > decayEnd) gain.setValueAtTime(peak * env.sustain, releaseStart);
  // setTargetAtTime is an exponential approach; three time constants is close enough to silent.
  gain.setTargetAtTime(0, releaseStart, env.release / 3);
  return releaseStart + env.release + 0.05;
}

export function createBasicVoice(ctx: VoiceContext, destination: AudioNode, name = 'basic'): Voice {
  const active = new Map<number, Active>();
  let nextId = 1;

  const stopEarly = (a: Active, time: number) => {
    a.gain.gain.cancelScheduledValues(time);
    a.gain.gain.setTargetAtTime(0, time, FAST_RELEASE / 3);
    for (const s of a.sources) s.stop(time + FAST_RELEASE * 3);
    active.delete(a.handle.id);
  };

  return {
    name,
    noteOn(event: NoteOnEvent): VoiceHandle {
      const handle: VoiceHandle = { id: nextId++, noteId: event.noteId, startTime: event.time };
      const peak = velocityGain(event.velocity);
      const gain = ctx.createGain();
      gain.connect(destination);
      const offTime = event.time + event.duration;

      if (event.techniques.includes('dead')) {
        // A dead note is a percussive thud: 40 ms of noise through a low bandpass, no pitch.
        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer(ctx, DEAD_NOISE_SECONDS);
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = DEAD_BANDPASS_HZ;
        band.Q.value = 1;
        source.connect(band);
        band.connect(gain);
        gain.gain.setValueAtTime(peak, event.time);
        gain.gain.setTargetAtTime(0, event.time + 0.01, 0.012);
        source.start(event.time);
        source.stop(event.time + DEAD_NOISE_SECONDS + 0.05);
        active.set(handle.id, { handle, gain, sources: [source], endTime: event.time + 0.1 });
        return handle;
      }

      const env = envelopeFor(event.techniques);
      const frequency = freqOf(event.pitch);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = env.cutoff;
      filter.Q.value = 1;
      filter.connect(gain);

      const saw = ctx.createOscillator();
      saw.type = 'sawtooth';
      saw.frequency.value = frequency;
      const square = ctx.createOscillator();
      square.type = 'square';
      square.frequency.value = frequency;
      square.detune.value = 4;
      // The square sits a touch lower so the saw leads; together they beat gently.
      const squareGain = ctx.createGain();
      squareGain.gain.value = 0.5;
      saw.connect(filter);
      square.connect(squareGain);
      squareGain.connect(filter);

      const endTime = scheduleAdsr(gain.gain, event.time, offTime, peak, env);
      saw.start(event.time);
      square.start(event.time);
      saw.stop(endTime);
      square.stop(endTime);
      active.set(handle.id, { handle, gain, sources: [saw, square], endTime });
      return handle;
    },

    noteOff(handle, time) {
      const a = active.get(handle.id);
      if (a) stopEarly(a, time);
    },

    allOff(time) {
      for (const a of [...active.values()]) stopEarly(a, time);
    },
  };
}
