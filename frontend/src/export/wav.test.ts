import { describe, expect, it } from 'vitest';
import { encodeWav, floatTo16, readWavHeader, WAV_HEADER_BYTES } from './wav';

describe('wav encoder', () => {
  it('writes the canonical 44-byte header and little-endian 16-bit samples', () => {
    const left = new Float32Array([0, 0.5, -0.5, 1, -1, 2, -2]);
    const buffer = encodeWav([left], 8000);
    expect(buffer.byteLength).toBe(WAV_HEADER_BYTES + left.length * 2);
    const bytes = new Uint8Array(buffer);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
    expect(String.fromCharCode(...bytes.slice(12, 16))).toBe('fmt ');
    expect(String.fromCharCode(...bytes.slice(36, 40))).toBe('data');
    const view = new DataView(buffer);
    expect(view.getUint32(4, true)).toBe(36 + left.length * 2);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint32(28, true)).toBe(16000);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(14);
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(Math.round(0.5 * 0x7fff));
    expect(view.getInt16(48, true)).toBe(Math.round(-0.5 * 0x8000));
    expect(view.getInt16(50, true)).toBe(0x7fff);
    expect(view.getInt16(52, true)).toBe(-0x8000);
    expect(view.getInt16(54, true)).toBe(0x7fff);
    expect(view.getInt16(56, true)).toBe(-0x8000);
  });

  it('interleaves stereo and reads its own header back', () => {
    const l = new Float32Array([0.25, 0.25]);
    const r = new Float32Array([-0.25, -0.25]);
    const buffer = encodeWav([l, r], 44100);
    const header = readWavHeader(buffer);
    expect(header).toEqual({
      channels: 2,
      sampleRate: 44100,
      bitsPerSample: 16,
      dataBytes: 8,
      frames: 2,
    });
    const view = new DataView(buffer);
    expect(view.getInt16(44, true)).toBeGreaterThan(0);
    expect(view.getInt16(46, true)).toBeLessThan(0);
    expect(floatTo16(0.999999)).toBe(0x7fff);
    expect(() => encodeWav([], 44100)).toThrow();
    expect(() => readWavHeader(new ArrayBuffer(44))).toThrow();
  });
});
