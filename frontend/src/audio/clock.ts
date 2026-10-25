/**
 * Tempo-bound time conversion (SPEC 6.1). The scheduler thinks in "absolute ticks": a
 * running count that does not wrap at the loop, so loop wraps never reset the clock. The
 * clock maps absolute ticks to audio seconds and back.
 */
import { PPQ } from '@/music/time';

export class TempoClock {
  bpm: number;
  /** Audio time at which absolute tick `originTick` sounds. */
  originTime: number;
  originTick: number;

  constructor(bpm: number, originTime: number, originTick: number) {
    this.bpm = bpm;
    this.originTime = originTime;
    this.originTick = originTick;
  }

  secondsPerTick(): number {
    return 60 / this.bpm / PPQ;
  }

  timeOf(absoluteTick: number): number {
    return this.originTime + (absoluteTick - this.originTick) * this.secondsPerTick();
  }

  tickAt(audioTime: number): number {
    return this.originTick + (audioTime - this.originTime) / this.secondsPerTick();
  }
}

/** Fold an absolute tick into the loop window [start, end). */
export function wrapTick(absoluteTick: number, loopStart: number, loopEnd: number): number {
  const length = loopEnd - loopStart;
  if (length <= 0) return loopStart;
  const rel = ((absoluteTick % length) + length) % length;
  return loopStart + rel;
}
