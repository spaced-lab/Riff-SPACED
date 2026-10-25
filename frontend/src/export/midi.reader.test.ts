/**
 * A tiny MIDI reader for tests: parses what our writer produces (format 0, one track,
 * meta events, program changes, note on/off with running status) back into note events.
 */
export type ParsedNote = {
  channel: number;
  pitch: number;
  velocity: number;
  start: number;
  end: number;
};
export type ParsedMidi = {
  ppq: number;
  format: number;
  tracks: number;
  tempoBpm: number | null;
  trackName: string | null;
  notes: ParsedNote[];
};

export function readVarLen(bytes: Uint8Array, pos: number): { value: number; next: number } {
  let value = 0;
  let i = pos;
  for (;;) {
    const b = bytes[i++]!;
    value = (value << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) break;
  }
  return { value, next: i };
}

export function parseMidi(bytes: Uint8Array): ParsedMidi {
  const text = (a: number, b: number) => String.fromCharCode(...bytes.slice(a, b));
  const u32 = (p: number) =>
    ((bytes[p]! << 24) | (bytes[p + 1]! << 16) | (bytes[p + 2]! << 8) | bytes[p + 3]!) >>> 0;
  const u16 = (p: number) => (bytes[p]! << 8) | bytes[p + 1]!;
  if (text(0, 4) !== 'MThd' || u32(4) !== 6) throw new Error('bad header');
  const format = u16(8);
  const tracks = u16(10);
  const ppq = u16(12);
  let pos = 14;
  if (text(pos, pos + 4) !== 'MTrk') throw new Error('expected MTrk');
  const length = u32(pos + 4);
  pos += 8;
  const end = pos + length;
  let tick = 0;
  let running = -1;
  let tempoBpm: number | null = null;
  let trackName: string | null = null;
  const open = new Map<string, ParsedNote>();
  const notes: ParsedNote[] = [];
  while (pos < end) {
    const d = readVarLen(bytes, pos);
    tick += d.value;
    pos = d.next;
    let status = bytes[pos]!;
    if (status < 0x80) {
      if (running < 0) throw new Error('running status without a prior status');
      status = running;
    } else {
      pos++;
    }
    if (status === 0xff) {
      const type = bytes[pos++]!;
      const len = readVarLen(bytes, pos);
      pos = len.next;
      const data = bytes.slice(pos, pos + len.value);
      pos += len.value;
      if (type === 0x51)
        tempoBpm = Math.round(60_000_000 / ((data[0]! << 16) | (data[1]! << 8) | data[2]!));
      if (type === 0x03) trackName = String.fromCharCode(...data);
      if (type === 0x2f) break;
      running = -1;
      continue;
    }
    running = status;
    const kind = status & 0xf0;
    const channel = status & 0x0f;
    if (kind === 0xc0 || kind === 0xd0) {
      pos += 1;
      continue;
    }
    const a = bytes[pos++]!;
    const b = bytes[pos++]!;
    const key = `${channel}:${a}`;
    if (kind === 0x90 && b > 0) {
      open.set(key, { channel, pitch: a, velocity: b, start: tick, end: -1 });
    } else if (kind === 0x80 || (kind === 0x90 && b === 0)) {
      const n = open.get(key);
      if (n) {
        n.end = tick;
        notes.push(n);
        open.delete(key);
      }
    }
  }
  return {
    ppq,
    format,
    tracks,
    tempoBpm,
    trackName,
    notes: notes.sort((x, y) => x.start - y.start || x.pitch - y.pitch),
  };
}

import { describe, expect, it } from 'vitest';
import demo from '@shared/fixtures/demo-library.json';
import type { LibraryBundle } from '@/model/types';
import { pitchOf } from '@/music/tuning';
import { riffToMidi } from './midi';

const lib = demo as unknown as LibraryBundle;

describe('midi round trip through the test reader', () => {
  it('recovers every demo walkdown note with its pitch, start, and channel', () => {
    const riff = lib.riffs[0]!;
    const parsed = parseMidi(riffToMidi(riff));
    expect(parsed).toMatchObject({
      ppq: 480,
      format: 0,
      tracks: 1,
      tempoBpm: 92,
      trackName: 'Walkdown Turnaround',
    });
    expect(parsed.notes).toHaveLength(56);
    const expected = [...riff.notes]
      .map((n) => ({ pitch: pitchOf(riff.tuning, n.string, n.fret), start: n.start }))
      .sort((a, b) => a.start - b.start || a.pitch - b.pitch);
    expect(parsed.notes.map((n) => ({ pitch: n.pitch, start: n.start }))).toEqual(expected);
    expect(parsed.notes.every((n) => n.channel === 0 && n.end > n.start)).toBe(true);
    // Palm-muted notes are half length; the held letRing Ab2 keeps its full bar.
    const held = parsed.notes.find((n) => n.start === 3 * 1920 && n.pitch === 44)!;
    expect(held.end - held.start).toBe(1920);
    const chug = parsed.notes.find((n) => n.start === 0)!;
    expect(chug.end - chug.start).toBe(120);
  });

  it('channel-per-string puts string 6 on channel 5 and string 4 on channel 3', () => {
    const parsed = parseMidi(riffToMidi(lib.riffs[0]!, { channelPerString: true }));
    const channels = new Set(parsed.notes.map((n) => n.channel));
    expect([...channels].sort()).toEqual([3, 4, 5]);
    expect(parsed.notes.filter((n) => n.pitch === 34).every((n) => n.channel === 5)).toBe(true);
  });
});
