/**
 * One AudioContext for the app, created lazily on the first user gesture because browsers
 * refuse to start audio otherwise (autoplay policy). `resume()` is called on every Play.
 */
let context: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio is not available in this browser');
    context = new Ctor({ latencyHint: 'interactive' });
  }
  return context;
}

export function hasAudioContext(): boolean {
  return context !== null;
}

export async function resumeAudio(): Promise<AudioContextState> {
  const ctx = getAudioContext();
  if (ctx.state !== 'running') {
    try {
      await ctx.resume();
    } catch {
      // Some browsers reject resume() outside a gesture; the caller shows "tap to enable audio".
    }
  }
  return ctx.state;
}

export function audioNow(): number {
  return context?.currentTime ?? 0;
}

/** Tests inject a fake; production code never calls this. */
export function setAudioContextForTests(ctx: AudioContext | null): void {
  context = ctx;
}
