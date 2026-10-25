import { describe, expect, it } from 'vitest';
import { createMaster, POLYPHONY } from '../master';
import type { MasterContext } from '../master';
import { fakeContext, FakeNode } from '../testing/fakeAudioContext';
import type { NoteOnEvent } from '../types';
import { BASIC_ENVELOPE, createBasicVoice, envelopeFor, PALM_MUTE_ENVELOPE } from './basic';
import { createHeavyVoice, tanhCurve } from './heavy';
import { createMetronome } from './metronome';
import type { VoiceContext } from './types';
import { velocityGain } from './types';

const on = (over: Partial<NoteOnEvent> = {}): NoteOnEvent => ({
  kind: 'noteOn',
  time: 1,
  tick: 0,
  noteId: 'n',
  pitch: 34,
  velocity: 100,
  techniques: [],
  duration: 0.5,
  ...over,
});

const calls = (node: FakeNode, method: string) =>
  node.gain.calls.filter((c) => c.method === method);

describe('basic voice', () => {
  it('builds two oscillators through a lowpass into an ADSR gain with the spec times', () => {
    const ctx = fakeContext();
    const dest = new FakeNode('dest');
    const voice = createBasicVoice(ctx as unknown as VoiceContext, dest as unknown as AudioNode);
    voice.noteOn(on({ velocity: 127 }));
    const oscs = ctx.byKind('oscillator');
    expect(oscs.map((o) => o.type)).toEqual(['sawtooth', 'square']);
    expect(oscs[0]!.frequency.value).toBeCloseTo(58.27, 2);
    expect(oscs[1]!.detune.value).toBe(4);
    const filter = ctx.byKind('biquad')[0]!;
    expect(filter.type).toBe('lowpass');
    expect(filter.frequency.value).toBe(BASIC_ENVELOPE.cutoff);
    const env = ctx.byKind('gain').find((g) => g.connections.includes(dest))!;
    expect(calls(env, 'setValueAtTime')[0]!.args).toEqual([0, 1]);
    const ramps = calls(env, 'linearRampToValueAtTime');
    expect(ramps[0]!.args[0]).toBeCloseTo(1.0);
    expect(ramps[0]!.args[1]).toBeCloseTo(1.003);
    expect(ramps[1]!.args[0]).toBeCloseTo(0.6);
    expect(ramps[1]!.args[1]).toBeCloseTo(1.153);
    const release = calls(env, 'setTargetAtTime')[0]!;
    expect(release.args[1]).toBeCloseTo(1.5);
    expect(release.args[2]).toBeCloseTo(0.06 / 3);
    expect(oscs[0]!.started).toEqual([1]);
    expect(oscs[0]!.stopped[0]).toBeGreaterThan(1.5);
  });

  it('palmMute shortens the decay to silence and darkens the filter; letRing lengthens the release', () => {
    expect(envelopeFor(['palmMute'])).toEqual(PALM_MUTE_ENVELOPE);
    expect(envelopeFor(['letRing']).release).toBe(0.4);
    expect(envelopeFor(['palmMute', 'letRing'])).toMatchObject({
      decay: 0.09,
      sustain: 0,
      release: 0.4,
    });
    const ctx = fakeContext();
    const dest = new FakeNode('dest');
    createBasicVoice(ctx as unknown as VoiceContext, dest as unknown as AudioNode).noteOn(
      on({ techniques: ['palmMute'] }),
    );
    const env = ctx.byKind('gain').find((g) => g.connections.includes(dest))!;
    const ramps = calls(env, 'linearRampToValueAtTime');
    expect(ramps[1]!.args).toEqual([0, expect.closeTo(1.003 + 0.09, 6)]);
    expect(ctx.byKind('biquad')[0]!.frequency.value).toBe(1200);
  });

  it('a dead note is a noise burst through a bandpass, no oscillators', () => {
    const ctx = fakeContext();
    const dest = new FakeNode('dest');
    createBasicVoice(ctx as unknown as VoiceContext, dest as unknown as AudioNode).noteOn(
      on({ techniques: ['dead'] }),
    );
    expect(ctx.byKind('oscillator')).toHaveLength(0);
    const source = ctx.byKind('bufferSource')[0]!;
    expect(source.started).toEqual([1]);
    const band = ctx.byKind('biquad')[0]!;
    expect(band.type).toBe('bandpass');
    expect(band.frequency.value).toBe(180);
  });

  it('maps velocity linearly from 0.25 to 1.0 and stops early on noteOff / allOff', () => {
    expect(velocityGain(1)).toBeCloseTo(0.25);
    expect(velocityGain(127)).toBeCloseTo(1.0);
    expect(velocityGain(64)).toBeCloseTo(0.625);
    const ctx = fakeContext();
    const dest = new FakeNode('dest');
    const voice = createBasicVoice(ctx as unknown as VoiceContext, dest as unknown as AudioNode);
    const h = voice.noteOn(on());
    voice.noteOn(on({ noteId: 'm', time: 1.1 }));
    voice.noteOff(h, 1.2);
    const envs = ctx.byKind('gain').filter((g) => g.connections.includes(dest));
    expect(calls(envs[0]!, 'cancelScheduledValues')[0]!.args).toEqual([1.2]);
    expect(ctx.byKind('oscillator')[0]!.stopped.at(-1)).toBeCloseTo(1.26);
    voice.allOff(1.3);
    expect(calls(envs[1]!, 'cancelScheduledValues')[0]!.args).toEqual([1.3]);
  });
});

describe('heavy voice', () => {
  it('adds a sub oscillator an octave down and a shared tanh drive into a cabinet', () => {
    const ctx = fakeContext();
    const dest = new FakeNode('dest');
    const voice = createHeavyVoice(ctx as unknown as VoiceContext, dest as unknown as AudioNode);
    voice.noteOn(on({ pitch: 46 }));
    const oscs = ctx.byKind('oscillator');
    expect(oscs.map((o) => o.type)).toEqual(['sawtooth', 'square', 'sine']);
    expect(oscs[2]!.frequency.value).toBeCloseTo(oscs[0]!.frequency.value / 2, 6);
    const shaper = ctx.byKind('waveShaper')[0]!;
    expect(shaper.oversample).toBe('2x');
    const biquads = ctx.byKind('biquad');
    expect(biquads.map((b) => [b.type, b.frequency.value])).toEqual(
      expect.arrayContaining([
        ['lowpass', 4000],
        ['highpass', 70],
      ]),
    );
    const curve = tanhCurve(6, 101);
    expect(curve[50]).toBeCloseTo(0, 6);
    expect(curve[100]).toBeCloseTo(1, 6);
    for (let i = 1; i < curve.length; i++) expect(curve[i]!).toBeGreaterThan(curve[i - 1]!);
    for (let i = 0; i < 50; i++) expect(curve[i]!).toBeCloseTo(-curve[100 - i]!, 6);
  });
});

describe('metronome and master', () => {
  it('clicks with noise through a 2 kHz highpass, louder on the accent', () => {
    const ctx = fakeContext();
    const dest = new FakeNode('dest');
    const m = createMetronome(ctx as unknown as VoiceContext, dest as unknown as AudioNode);
    m.click(2, true);
    m.click(2.5, false);
    const gains = ctx.byKind('gain');
    expect(gains[0]!.gain.value).toBeGreaterThan(gains[1]!.gain.value);
    expect(ctx.byKind('biquad')[0]).toMatchObject({ type: 'highpass' });
    expect(ctx.byKind('bufferSource')[0]!.started).toEqual([2]);
  });

  it('routes voices through gain 0.5 and a compressor, and steals the oldest past 12 voices', () => {
    const ctx = fakeContext();
    const master = createMaster(ctx as unknown as MasterContext);
    expect(master.input.gain.value).toBe(0.5);
    expect((master.compressor as unknown as FakeNode).threshold.value).toBe(-12);
    expect((master.compressor as unknown as FakeNode).ratio.value).toBe(4);
    expect((master.input as unknown as FakeNode).connections).toContain(master.compressor);
    const voice = createBasicVoice(ctx as unknown as VoiceContext, master.input);
    const sink = master.sink(voice);
    for (let i = 0; i < POLYPHONY + 1; i++)
      sink.schedule(on({ noteId: `n${i}`, time: 1 + i * 0.01, duration: 5 }));
    expect(master.activeCount()).toBe(POLYPHONY);
    const firstEnv = ctx
      .byKind('gain')
      .find((g) => g.connections.includes(master.input as unknown as FakeNode))!;
    expect(calls(firstEnv, 'cancelScheduledValues')).toHaveLength(1);
    sink.schedule({ kind: 'click', time: 2, tick: 0, accent: true });
    sink.allOff(3);
    expect(master.activeCount()).toBe(0);
  });
});
