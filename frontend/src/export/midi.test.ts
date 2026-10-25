import { describe, expect, it } from 'vitest';
import { newNote, newRiff } from '@/model/factories';
import { encodeTrack, riffToMidi, tempoBytes, writeVarLen } from './midi';

const hex = (bytes: Iterable<number>) =>
  [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ');

describe('midi writer', () => {
  it('encodes variable-length quantities per the spec vectors', () => {
    expect(hex(writeVarLen(0x00))).toBe('00');
    expect(hex(writeVarLen(0x7f))).toBe('7f');
    expect(hex(writeVarLen(0x80))).toBe('81 00');
    expect(hex(writeVarLen(0x3fff))).toBe('ff 7f');
    expect(hex(writeVarLen(0x4000))).toBe('81 80 00');
    expect(hex(writeVarLen(0x0fffffff))).toBe('ff ff ff 7f');
    expect(() => writeVarLen(-1)).toThrow(RangeError);
  });

  it('writes the header bytes for format 0, one track, 480 PPQ', () => {
    const bytes = riffToMidi(newRiff());
    expect(hex(bytes.slice(0, 14))).toBe('4d 54 68 64 00 00 00 06 00 00 00 01 01 e0');
    expect(hex(bytes.slice(14, 18))).toBe('4d 54 72 6b');
  });

  it('produces the expected full byte sequence for a one-note riff', () => {
    const riff = newRiff();
    riff.name = 'A';
    riff.tempo.bpm = 120;
    riff.notes = [newNote({ string: 6, fret: 3, start: 480, duration: 240, velocity: 100 })];
    const bytes = riffToMidi(riff);
    const track = bytes.slice(18);
    const expected = [
      '00 ff 03 01 41', // track name "A"
      '00 ff 51 03 07 a1 20', // tempo 500000 us
      '00 ff 58 04 04 02 18 08', // 4/4
      '00 c0 1e', // program 30 on channel 0
      '83 60 90 25 64', // delta 480, note on Db2 (37) velocity 100
      '81 70 80 25 00', // delta 240, note off
      '00 ff 2f 00', // end of track
    ].join(' ');
    expect(hex(track.slice(4))).toBe(expected);
    const length = (track[0]! << 24) | (track[1]! << 16) | (track[2]! << 8) | track[3]!;
    expect(length).toBe(track.length - 4);
  });

  it('uses running status for consecutive events of the same kind and channel', () => {
    const events = [
      { tick: 0, order: 0, bytes: [0x90, 60, 100] },
      { tick: 0, order: 1, bytes: [0x90, 64, 100] },
      { tick: 480, order: 0, bytes: [0x80, 60, 0] },
      { tick: 480, order: 1, bytes: [0x80, 64, 0] },
    ];
    expect(hex(encodeTrack(events).slice(8))).toBe(
      '00 90 3c 64 00 40 64 83 60 80 3c 00 00 40 00 00 ff 2f 00',
    );
    expect(hex(tempoBytes(92))).toBe('09 f3 8e'); // 652174 us per quarter
  });

  it('skips unplayable notes and clamps velocity and pitch', () => {
    const riff = newRiff();
    riff.notes = [
      {
        ...newNote({ string: 6, fret: 3, start: 0, duration: 120, velocity: 100 }),
        unplayable: true,
      },
      newNote({ string: 6, fret: 3, start: 0, duration: 120, velocity: 127 }),
    ];
    const bytes = riffToMidi(riff);
    const text = hex(bytes);
    expect(text.split('90 25 7f').length - 1).toBe(1);
  });
});
