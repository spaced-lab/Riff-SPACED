import type { VoiceContext } from './types';

/** A short white-noise buffer, cached per context and length. */
const cache = new WeakMap<VoiceContext, Map<number, AudioBuffer>>();

export function noiseBuffer(ctx: VoiceContext, seconds: number): AudioBuffer {
  let byLength = cache.get(ctx);
  if (!byLength) {
    byLength = new Map();
    cache.set(ctx, byLength);
  }
  const frames = Math.max(1, Math.round(seconds * ctx.sampleRate));
  let buffer = byLength.get(frames);
  if (!buffer) {
    buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // A fixed-seed linear congruential generator keeps the burst identical between runs.
    let seed = 1234567;
    for (let i = 0; i < frames; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = (seed / 0xffffffff) * 2 - 1;
    }
    byLength.set(frames, buffer);
  }
  return buffer;
}
