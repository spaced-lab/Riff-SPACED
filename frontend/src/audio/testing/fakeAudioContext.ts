/**
 * A recording fake of the Web Audio API: nodes remember their type, parameters remember
 * every schedule call, connect() records edges, start/stop record times. Enough to assert
 * what a voice built and when it told the envelope to move, without a browser.
 */

export type ParamCall = { method: string; args: number[] };

export class FakeParam {
  calls: ParamCall[] = [];
  value: number;
  constructor(value = 0) {
    this.value = value;
  }
  setValueAtTime(v: number, t: number) {
    this.calls.push({ method: 'setValueAtTime', args: [v, t] });
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push({ method: 'linearRampToValueAtTime', args: [v, t] });
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.calls.push({ method: 'exponentialRampToValueAtTime', args: [v, t] });
    return this;
  }
  setTargetAtTime(v: number, t: number, tc: number) {
    this.calls.push({ method: 'setTargetAtTime', args: [v, t, tc] });
    return this;
  }
  cancelScheduledValues(t: number) {
    this.calls.push({ method: 'cancelScheduledValues', args: [t] });
    return this;
  }
  cancelAndHoldAtTime(t: number) {
    this.calls.push({ method: 'cancelAndHoldAtTime', args: [t] });
    return this;
  }
}

export class FakeNode {
  connections: FakeNode[] = [];
  started: number[] = [];
  stopped: number[] = [];
  type = '';
  buffer: unknown = null;
  curve: Float32Array | null = null;
  oversample = 'none';
  frequency = new FakeParam(440);
  detune = new FakeParam(0);
  Q = new FakeParam(1);
  gain = new FakeParam(1);
  threshold = new FakeParam(-24);
  ratio = new FakeParam(12);
  attack = new FakeParam(0.003);
  release = new FakeParam(0.25);
  kind: string;
  constructor(kind: string) {
    this.kind = kind;
  }
  connect(target: FakeNode) {
    this.connections.push(target);
    return target;
  }
  disconnect() {
    this.connections = [];
  }
  start(t = 0) {
    this.started.push(t);
  }
  stop(t = 0) {
    this.stopped.push(t);
  }
}

export class FakeAudioContext {
  nodes: FakeNode[] = [];
  sampleRate = 44100;
  currentTime = 0;
  destination = new FakeNode('destination');
  private make(kind: string) {
    const n = new FakeNode(kind);
    this.nodes.push(n);
    return n;
  }
  createOscillator() {
    return this.make('oscillator');
  }
  createGain() {
    return this.make('gain');
  }
  createBiquadFilter() {
    return this.make('biquad');
  }
  createBufferSource() {
    return this.make('bufferSource');
  }
  createWaveShaper() {
    return this.make('waveShaper');
  }
  createDynamicsCompressor() {
    return this.make('compressor');
  }
  createBuffer(channels: number, frames: number, sampleRate: number) {
    const data = new Float32Array(frames);
    return {
      numberOfChannels: channels,
      length: frames,
      sampleRate,
      getChannelData: () => data,
    } as unknown as AudioBuffer;
  }
  byKind(kind: string) {
    return this.nodes.filter((n) => n.kind === kind);
  }
}

/** Cast helper: the fake satisfies the structural types the voices depend on. */
export function fakeContext(): FakeAudioContext & { asContext: () => never } {
  const ctx = new FakeAudioContext();
  return Object.assign(ctx, { asContext: () => ctx as never });
}
