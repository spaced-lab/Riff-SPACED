import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newNote, newRiff } from '@/model/factories';
import { bootstrapStore, useStore } from '@/store';
import { Engine, playableFrom } from './engine';
import type { EngineContext } from './engine';
import { FakeAudioContext } from './testing/fakeAudioContext';
import { FakeClock } from './testing/fakeClock';

/**
 * The engine under fakes: a FakeClock drives both the scheduler's timer and the context's
 * currentTime; frames are run by hand. Highlights must follow note times in order.
 */
function harness() {
  const clock = new FakeClock();
  const ctx = new FakeAudioContext();
  Object.defineProperty(ctx, 'currentTime', { get: () => clock.now() });
  (ctx as unknown as { state: string }).state = 'running';
  const frames: (() => void)[] = [];
  const engine = new Engine({
    getContext: () => ctx as unknown as EngineContext,
    resume: async () => 'running' as AudioContextState,
    clock: () => clock,
    requestFrame: (cb) => {
      frames.push(cb);
      return frames.length;
    },
    cancelFrame: () => undefined,
  });
  const runFrame = () => {
    const cb = frames.shift();
    cb?.();
  };
  const tick = async (seconds: number) => {
    clock.advance(seconds);
    runFrame();
    await Promise.resolve();
  };
  return { clock, ctx, engine, runFrame, tick, frames };
}

describe('Engine', () => {
  let detach = () => {};
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    bootstrapStore();
    const r = newRiff();
    r.tempo.bpm = 120;
    r.notes = [
      { ...newNote({ string: 6, fret: 0, start: 0, duration: 480 }), id: 'a' },
      { ...newNote({ string: 6, fret: 3, start: 960, duration: 480 }), id: 'b' },
      { ...newNote({ string: 5, fret: 5, start: 1920, duration: 240 }), id: 'c' },
    ];
    useStore.getState().setRiff(r);
  });
  afterEach(() => detach());

  it('highlights notes in time order and moves the position readout', async () => {
    const h = harness();
    h.engine.attach();
    detach = () => h.engine.detach();
    useStore.getState().play();
    await Promise.resolve();
    await Promise.resolve();
    expect(h.engine.isRunning).toBe(true);
    expect(useStore.getState().audioState).toBe('running');

    const seen: string[][] = [];
    const unsub = useStore.subscribe((s, p) => {
      if (s.highlightIds !== p.highlightIds) seen.push([...s.highlightIds]);
    });
    // 120 BPM: a quarter is 0.5 s. Note a at 0.05, off at 0.55; b at 1.05; c at 2.05.
    await h.tick(0.1);
    await h.tick(0.5);
    await h.tick(0.5);
    await h.tick(0.5);
    await h.tick(0.5);
    await h.tick(0.5);
    unsub();
    expect(seen[0]).toEqual(['a']);
    expect(seen).toContainEqual([]);
    expect(seen).toContainEqual(['b']);
    expect(seen).toContainEqual(['c']);
    const flat = seen.map((s) => s.join(','));
    expect(flat.indexOf('a')).toBeLessThan(flat.indexOf('b'));
    expect(flat.indexOf('b')).toBeLessThan(flat.indexOf('c'));
    expect(useStore.getState().positionTick).toBeGreaterThan(1920);
    expect(h.ctx.byKind('oscillator').length).toBeGreaterThanOrEqual(6);

    useStore.getState().stop();
    expect(h.engine.isRunning).toBe(false);
    expect(useStore.getState().highlightIds).toEqual([]);
    expect(useStore.getState().positionTick).toBe(0);
  });

  it('edits while playing swap the notes, tempo changes rebind the clock, solo restarts the window', async () => {
    const h = harness();
    h.engine.attach();
    detach = () => h.engine.detach();
    useStore.getState().play();
    await Promise.resolve();
    await Promise.resolve();
    await h.tick(0.1);
    useStore
      .getState()
      .addNote({ ...newNote({ string: 6, fret: 5, start: 480, duration: 120 }), id: 'd' });
    await h.tick(0.5);
    const ons = h.ctx.byKind('oscillator').length;
    expect(ons).toBeGreaterThanOrEqual(4);
    useStore.getState().setBpm(240);
    await h.tick(0.1);
    expect(h.engine.isRunning).toBe(true);
    const sectionId = useStore.getState().riff.sections[0]!.id;
    useStore.getState().splitSection(sectionId, 2);
    const second = useStore.getState().riff.sections[1]!.id;
    useStore.getState().toggleSoloSection(second);
    await h.tick(0.1);
    expect(h.engine.isRunning).toBe(true);
    const pos = useStore.getState().positionTick;
    await h.tick(0.5);
    expect(useStore.getState().positionTick).toBeGreaterThanOrEqual(Math.min(pos, 2 * 1920));
    expect(useStore.getState().positionTick).toBeGreaterThanOrEqual(2 * 1920);
  });

  it('reports audio unavailable and stops when the context cannot be created', async () => {
    const h = harness();
    const engine = new Engine({
      getContext: () => {
        throw new Error('no audio');
      },
      resume: async () => 'suspended' as AudioContextState,
      clock: () => h.clock,
      requestFrame: () => 1,
      cancelFrame: () => undefined,
    });
    engine.attach();
    detach = () => engine.detach();
    useStore.getState().play();
    await Promise.resolve();
    expect(useStore.getState().isPlaying).toBe(false);
    expect(useStore.getState().audioState).toBe('unavailable');
  });

  it('playableFrom uses the solo section as the loop window', () => {
    const riff = useStore.getState().riff;
    expect(playableFrom({ riff, soloSectionId: null })).toMatchObject({
      loopStartTick: 0,
      loopEndTick: 4 * 1920,
      bpm: 120,
    });
    const split = {
      ...riff,
      sections: [
        { id: 'x', label: 'A', startBar: 0, lengthBars: 1, kind: 'main' as const },
        { id: 'y', label: 'B', startBar: 1, lengthBars: 3, kind: 'other' as const },
      ],
    };
    expect(playableFrom({ riff: split, soloSectionId: 'y' })).toMatchObject({
      loopStartTick: 1920,
      loopEndTick: 4 * 1920,
    });
  });
});
