/**
 * Standard MIDI File writer (SPEC 7.3, DECISIONS 16): format 0, one track, 480 PPQ.
 *
 * A MIDI file is a header chunk and track chunks. A track is a list of events, each
 * preceded by a delta time in ticks encoded as a variable-length quantity (7 bits per
 * byte, high bit set on all but the last). Running status lets consecutive events of the
 * same kind on the same channel omit the status byte. All multi-byte numbers in the chunk
 * headers are big-endian.
 */
import type { Riff } from '@/model/types';
import { PPQ } from '@/music/time';
import { pitchOf } from '@/music/tuning';

export const PROGRAM_DISTORTION_GUITAR = 30;

export type MidiOptions = {
  /** One channel per string (1..N) for DAW string-split workflows. Default: one channel. */
  channelPerString?: boolean;
  /** Which channel (0-based) when not splitting. Default 0. */
  channel?: number;
};

/** Encode a non-negative integer as a MIDI variable-length quantity. */
export function writeVarLen(value: number): number[] {
  if (value < 0 || !Number.isInteger(value))
    throw new RangeError(`varlen needs a non-negative integer, got ${value}`);
  const bytes = [value & 0x7f];
  let rest = value >> 7;
  while (rest > 0) {
    bytes.unshift((rest & 0x7f) | 0x80);
    rest >>= 7;
  }
  return bytes;
}

type RawEvent = { tick: number; order: number; bytes: number[] };

/** Big-endian helpers. */
const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u16 = (n: number) => [(n >>> 8) & 0xff, n & 0xff];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/**
 * Turn absolute-tick events into a track chunk with delta times and running status.
 * Events at the same tick keep their `order` (meta first, note offs before note ons).
 */
export function encodeTrack(events: readonly RawEvent[]): number[] {
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order);
  const out: number[] = [];
  let lastTick = 0;
  let runningStatus = -1;
  for (const e of sorted) {
    out.push(...writeVarLen(e.tick - lastTick));
    lastTick = e.tick;
    const status = e.bytes[0]!;
    const isChannelMessage = status >= 0x80 && status < 0xf0;
    if (isChannelMessage && status === runningStatus) {
      out.push(...e.bytes.slice(1));
    } else {
      out.push(...e.bytes);
      runningStatus = isChannelMessage ? status : -1;
    }
  }
  // End of track: delta 0, FF 2F 00.
  out.push(0x00, 0xff, 0x2f, 0x00);
  return [...ascii('MTrk'), ...u32(out.length), ...out];
}

function meta(tick: number, order: number, type: number, data: number[]): RawEvent {
  return { tick, order, bytes: [0xff, type, ...writeVarLen(data.length), ...data] };
}

/** Tempo meta: microseconds per quarter note, 24-bit. */
export function tempoBytes(bpm: number): number[] {
  const usPerQuarter = Math.round(60_000_000 / bpm);
  return [(usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff];
}

export function riffToMidi(riff: Riff, options: MidiOptions = {}): Uint8Array<ArrayBuffer> {
  const events: RawEvent[] = [];
  events.push(meta(0, 0, 0x03, ascii(riff.name)));
  events.push(meta(0, 1, 0x51, tempoBytes(riff.tempo.bpm)));
  // Time signature: numerator, denominator as a power of two, 24 clocks per metronome tick, 8 32nds per quarter.
  const denomPower = Math.round(Math.log2(riff.timeSignature.unit));
  events.push(meta(0, 2, 0x58, [riff.timeSignature.beats, denomPower, 24, 8]));

  const stringCount = riff.tuning.pitches.length;
  const channelFor = (string: number) =>
    options.channelPerString ? string - 1 : (options.channel ?? 0);
  const channels = options.channelPerString
    ? Array.from({ length: stringCount }, (_, i) => i)
    : [channelFor(6)];
  for (const ch of channels)
    events.push({ tick: 0, order: 3, bytes: [0xc0 | ch, PROGRAM_DISTORTION_GUITAR] });

  for (const n of riff.notes) {
    if (n.unplayable) continue;
    const ch = channelFor(n.string);
    const pitch = Math.max(0, Math.min(127, pitchOf(riff.tuning, n.string, n.fret)));
    const velocity = Math.max(1, Math.min(127, n.velocity ?? 100));
    // Palm mute is expressed as a shorter note only (SPEC 7.3).
    const duration = n.techniques?.includes('palmMute')
      ? Math.max(1, Math.round(n.duration * 0.5))
      : n.duration;
    events.push({ tick: n.start, order: 10, bytes: [0x90 | ch, pitch, velocity] });
    events.push({ tick: n.start + duration, order: 5, bytes: [0x80 | ch, pitch, 0] });
  }

  const header = [...ascii('MThd'), ...u32(6), ...u16(0), ...u16(1), ...u16(PPQ)];
  const all = [...header, ...encodeTrack(events)];
  const out = new Uint8Array(new ArrayBuffer(all.length));
  out.set(all);
  return out;
}

export function midiBlob(riff: Riff, options: MidiOptions = {}): Blob {
  return new Blob([riffToMidi(riff, options)], { type: 'audio/midi' });
}
