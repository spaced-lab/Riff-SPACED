/**
 * A fake SchedulerClock: time only moves when the test says so, and intervals fire in
 * order as time advances. Resolution follows the interval, like a real timer would.
 */
import type { SchedulerClock } from '../types';

export class FakeClock implements SchedulerClock {
  private time = 0;
  private intervals = new Map<number, { fn: () => void; ms: number; next: number }>();
  private nextId = 1;

  now(): number {
    return this.time;
  }

  setInterval(fn: () => void, ms: number): number {
    const id = this.nextId++;
    this.intervals.set(id, { fn, ms, next: this.time + ms / 1000 });
    return id;
  }

  clearInterval(id: number): void {
    this.intervals.delete(id);
  }

  /** Advance by `seconds`, firing every due interval callback at its due time. */
  advance(seconds: number): void {
    const target = this.time + seconds;
    for (;;) {
      let soonest: { id: number; at: number } | null = null;
      for (const [id, it] of this.intervals) {
        if (it.next <= target && (!soonest || it.next < soonest.at)) soonest = { id, at: it.next };
      }
      if (!soonest) break;
      const it = this.intervals.get(soonest.id)!;
      this.time = soonest.at;
      it.next += it.ms / 1000;
      it.fn();
    }
    this.time = target;
  }
}
