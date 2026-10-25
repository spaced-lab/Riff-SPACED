import { describe, expect, it } from 'vitest';
import demo from '@shared/fixtures/demo-library.json';
import { newNote } from '@/model/factories';
import type { Note } from '@/model/types';
import { Scheduler } from './scheduler';
import { FakeClock } from './testing/fakeClock';
import type { AudioEvent, Playable } from './types';

class Recorder {
  events: AudioEvent[] = [];
  offs: number[] = [];
  schedule = (e: AudioEvent) => {
    this.events.push(e);
  };
  allOff = (time: number) => {
    this.offs.push(time);
  };
  ons(): Extract<AudioEvent, { kind: 'noteOn' }>[] {
    return this.events.filter(
      (e): e is Extract<AudioEvent, { kind: 'noteOn' }> => e.kind === 'noteOn',
    );
  }
}

const BB = [34, 39, 44, 49, 53, 58];

function fourBarRiff(): Playable {
  // One note per bar on beat 1 plus an off-beat note in bar 2: 5 notes per pass.
  const notes: Note[] = [0, 1, 2, 3].map((bar, i) => ({
    ...newNote({ string: 6, fret: i, start: bar * 1920, duration: 480 }),
    id: `n${i}`,
  }));
  notes.push({ ...newNote({ string: 5, fret: 5, start: 1920 + 720, duration: 240 }), id: 'off' });
  return { notes, tuningPitches: BB, loopStartTick: 0, loopEndTick: 4 * 1920, bpm: 120 };
}

describe('Scheduler', () => {
  it('schedules every note exactly once per loop pass at the right audio time', () => {
    const clock = new FakeClock();
    const rec = new Recorder();
    const s = new Scheduler(clock, rec);
    s.start(fourBarRiff(), { loop: true });
    // At 120 BPM a bar is 2 s, the loop is 8 s. Advance 8 s: pass 1 complete and the
    // first 100 ms of pass 2 already scheduled.
    clock.advance(8);
    const ons = rec.ons();
    const byId = new Map<string, number[]>();
    for (const e of ons) byId.set(e.noteId, [...(byId.get(e.noteId) ?? []), e.time]);
    const secondsPerTick = 60 / 120 / 480;
    const origin = 0.05;
    expect(byId.get('n0')).toHaveLength(2);
    expect(byId.get('n0')![0]).toBeCloseTo(origin, 6);
    expect(byId.get('n0')![1]).toBeCloseTo(origin + 8, 6);
    expect(byId.get('n1')).toHaveLength(1);
    expect(byId.get('n1')![0]).toBeCloseTo(origin + 1920 * secondsPerTick, 6);
    expect(byId.get('off')![0]).toBeCloseTo(origin + (1920 + 720) * secondsPerTick, 6);
    expect(byId.get('n3')![0]).toBeCloseTo(origin + 6, 6);
    // Every noteOn carries pitch, duration and a matching noteOff later.
    const n0 = ons.find((e) => e.noteId === 'n0')!;
    expect(n0.pitch).toBe(34);
    expect(n0.duration).toBeCloseTo(480 * secondsPerTick, 6);
    const offs = rec.events.filter((e) => e.kind === 'noteOff' && e.noteId === 'n0');
    expect(offs[0]!.time).toBeCloseTo(origin + 0.5, 6);
  });

  it('schedules the first notes of pass 2 before pass 1 has ended', () => {
    const clock = new FakeClock();
    const rec = new Recorder();
    const s = new Scheduler(clock, rec);
    s.start(fourBarRiff(), { loop: true });
    clock.advance(7.96);
    const n0Times = rec
      .ons()
      .filter((e) => e.noteId === 'n0')
      .map((e) => e.time);
    expect(n0Times).toHaveLength(2);
    expect(n0Times[1]).toBeGreaterThan(clock.now());
    expect(s.positionTick()).toBeLessThan(4 * 1920);
  });

  it('without loop it plays one pass and stops itself after the last note off', () => {
    const clock = new FakeClock();
    const rec = new Recorder();
    const s = new Scheduler(clock, rec);
    s.start(fourBarRiff(), { loop: false });
    clock.advance(9);
    expect(rec.ons().filter((e) => e.noteId === 'n0')).toHaveLength(1);
    expect(s.isRunning).toBe(false);
    expect(rec.offs).toHaveLength(1);
  });

  it('count-in clicks a bar before the content and reports inCountIn', () => {
    const clock = new FakeClock();
    const rec = new Recorder();
    const s = new Scheduler(clock, rec);
    s.start(fourBarRiff(), { loop: true, countInBars: 1 });
    expect(s.inCountIn()).toBe(true);
    clock.advance(1);
    const clicks = rec.events.filter((e) => e.kind === 'click');
    expect(clicks.length).toBeGreaterThanOrEqual(3);
    expect(clicks[0]).toMatchObject({ accent: true, tick: 0 });
    expect(rec.ons()).toHaveLength(0);
    clock.advance(1.2);
    expect(s.inCountIn()).toBe(false);
    expect(rec.ons()[0]!.time).toBeCloseTo(0.05 + 2, 6);
  });

  it('metronome clicks every beat with an accent on beat 1 of each bar', () => {
    const clock = new FakeClock();
    const rec = new Recorder();
    const s = new Scheduler(clock, rec);
    s.start(fourBarRiff(), { loop: true, metronome: true });
    clock.advance(4);
    const clicks = rec.events.filter(
      (e): e is Extract<AudioEvent, { kind: 'click' }> => e.kind === 'click',
    );
    expect(clicks.length).toBeGreaterThanOrEqual(8);
    expect(clicks.filter((c) => c.accent).map((c) => c.tick)).toEqual([0, 1920, 3840]);
  });

  it('starts at a given tick, tracks position, and restarts the mapping on tempo change', () => {
    const clock = new FakeClock();
    const rec = new Recorder();
    const s = new Scheduler(clock, rec);
    s.start(fourBarRiff(), { loop: true, startTick: 1920 });
    expect(rec.ons()[0]!.noteId).toBe('n1');
    clock.advance(1.05);
    expect(s.positionTick()).toBeCloseTo(1920 + 960, 0);
    s.setTempo(240);
    clock.advance(0.5);
    expect(s.positionTick()).toBeCloseTo(1920 + 960 + 960, 0);
    expect(s.bpm).toBe(240);
    s.stop();
    expect(s.isRunning).toBe(false);
  });

  it('drains visual events in audio-time order', () => {
    const clock = new FakeClock();
    const rec = new Recorder();
    const s = new Scheduler(clock, rec);
    s.start(fourBarRiff(), { loop: true });
    clock.advance(0.01);
    expect(s.drainVisual(0.04)).toEqual([]);
    const due = s.drainVisual(0.06);
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ noteIds: ['n0'], on: true, tick: 0 });
    clock.advance(0.6);
    const later = s.drainVisual(clock.now());
    expect(later.some((e) => !e.on && e.noteIds[0] === 'n0')).toBe(true);
  });

  it('plays the demo walkdown: 56 note ons per pass', () => {
    const clock = new FakeClock();
    const rec = new Recorder();
    const s = new Scheduler(clock, rec);
    const riff = demo.riffs[0]!;
    s.start(
      {
        notes: riff.notes as Note[],
        tuningPitches: riff.tuning.pitches,
        loopStartTick: 0,
        loopEndTick: 4 * 1920,
        bpm: riff.tempo.bpm,
      },
      { loop: false },
    );
    clock.advance(12);
    expect(rec.ons()).toHaveLength(56);
  });
});

describe('Scheduler edits while playing', () => {
  it('a note added just ahead of the playhead sounds this pass, and nothing doubles', () => {
    const clock = new FakeClock();
    const rec = new Recorder();
    const s = new Scheduler(clock, rec);
    const p = fourBarRiff();
    s.start(p, { loop: true });
    clock.advance(0.1);
    // The cursor already jumped past tick 480 (next start is n1 at 1920); add a note there.
    const added: Note = {
      ...newNote({ string: 6, fret: 5, start: 480, duration: 120 }),
      id: 'added',
    };
    s.setPlayable({ ...p, notes: [...p.notes, added] });
    clock.advance(0.6);
    expect(rec.ons().filter((e) => e.noteId === 'added')).toHaveLength(1);
    expect(rec.ons().filter((e) => e.noteId === 'n0')).toHaveLength(1);
    clock.advance(8);
    expect(rec.ons().filter((e) => e.noteId === 'added')).toHaveLength(2);
    expect(rec.ons().filter((e) => e.noteId === 'n0')).toHaveLength(2);
  });
});
