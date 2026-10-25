/** Metronome click (SPEC 6.2): 2 ms of noise through a highpass at 2 kHz, louder on beat 1. */
import { noiseBuffer } from './noise';
import type { VoiceContext } from './types';

export const CLICK_SECONDS = 0.002;
export const CLICK_HIGHPASS_HZ = 2000;
export const CLICK_GAIN = 0.35;
export const CLICK_ACCENT_GAIN = 0.7;

export function createMetronome(ctx: VoiceContext, destination: AudioNode) {
  return {
    click(time: number, accent: boolean): void {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx, CLICK_SECONDS);
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = CLICK_HIGHPASS_HZ;
      const gain = ctx.createGain();
      gain.gain.value = accent ? CLICK_ACCENT_GAIN : CLICK_GAIN;
      source.connect(highpass);
      highpass.connect(gain);
      gain.connect(destination);
      source.start(time);
      source.stop(time + CLICK_SECONDS + 0.01);
    },
  };
}
