/**
 * The heavy voice (SPEC 6.2 stretch): the basic voice plus a sub oscillator an octave down,
 * a tanh waveshaper for drive, a cabinet-like lowpass at 4 kHz and a highpass at 70 Hz.
 * Intentionally crude; samples and a real amp sim are backlog.
 */
import { freqOf } from '@/music/pitch';
import type { NoteOnEvent } from '../types';
import { envelopeFor, scheduleAdsr } from './basic';
import { createBasicVoice } from './basic';
import { FAST_RELEASE, velocityGain } from './types';
import type { Voice, VoiceContext, VoiceHandle } from './types';

export const DRIVE = 6;
export const SUB_GAIN = 0.4;
export const CAB_LOWPASS_HZ = 4000;
export const CAB_HIGHPASS_HZ = 70;

/** tanh(drive * x) sampled over [-1, 1]: odd-symmetric and monotonic, so no DC and no folding. */
export function tanhCurve(drive = DRIVE, samples = 1024): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / Math.tanh(drive);
  }
  return curve;
}

type Active = {
  handle: VoiceHandle;
  gain: GainNode;
  sources: (OscillatorNode | AudioBufferSourceNode)[];
};

export function createHeavyVoice(ctx: VoiceContext, destination: AudioNode): Voice {
  // The drive stage is shared: one waveshaper and cabinet for all notes, like one amp.
  const shaper = ctx.createWaveShaper();
  shaper.curve = tanhCurve();
  shaper.oversample = '2x';
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = CAB_LOWPASS_HZ;
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = CAB_HIGHPASS_HZ;
  shaper.connect(lowpass);
  lowpass.connect(highpass);
  highpass.connect(destination);

  // Dead notes and envelopes come from the basic voice, pointed at the amp input.
  const basic = createBasicVoice(ctx, shaper, 'heavy');
  const subs = new Map<number, Active>();

  return {
    name: 'heavy',
    noteOn(event: NoteOnEvent): VoiceHandle {
      const handle = basic.noteOn(event);
      if (event.techniques.includes('dead')) return handle;
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = freqOf(event.pitch - 12);
      const gain = ctx.createGain();
      gain.connect(shaper);
      sub.connect(gain);
      const env = envelopeFor(event.techniques);
      const endTime = scheduleAdsr(
        gain.gain,
        event.time,
        event.time + event.duration,
        velocityGain(event.velocity) * SUB_GAIN,
        env,
      );
      sub.start(event.time);
      sub.stop(endTime);
      subs.set(handle.id, { handle, gain, sources: [sub] });
      return handle;
    },
    noteOff(handle, time) {
      basic.noteOff(handle, time);
      const s = subs.get(handle.id);
      if (s) {
        s.gain.gain.cancelScheduledValues(time);
        s.gain.gain.setTargetAtTime(0, time, FAST_RELEASE / 3);
        for (const src of s.sources) src.stop(time + FAST_RELEASE * 3);
        subs.delete(handle.id);
      }
    },
    allOff(time) {
      basic.allOff(time);
      for (const s of [...subs.values()]) {
        s.gain.gain.cancelScheduledValues(time);
        s.gain.gain.setTargetAtTime(0, time, FAST_RELEASE / 3);
        for (const src of s.sources) src.stop(time + FAST_RELEASE * 3);
      }
      subs.clear();
    },
  };
}
