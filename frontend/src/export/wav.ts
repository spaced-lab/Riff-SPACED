/**
 * Hand-written 16-bit PCM WAV encoder (SPEC 6.3, DECISIONS 16). A WAV file is a RIFF
 * container with a `fmt ` chunk describing the samples and a `data` chunk holding them;
 * 44 bytes of header, then interleaved little-endian samples.
 */

export const WAV_HEADER_BYTES = 44;

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

/** Clamp a float sample to [-1, 1] and scale to a signed 16-bit integer. */
export function floatTo16(sample: number): number {
  const s = Math.max(-1, Math.min(1, sample));
  return s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
}

/**
 * Encode channels of float samples (each the same length) to a WAV ArrayBuffer.
 */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): ArrayBuffer {
  const channelCount = channels.length;
  if (channelCount === 0) throw new Error('encodeWav needs at least one channel');
  const frames = channels[0]!.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataBytes = frames * blockAlign;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = WAV_HEADER_BYTES;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channelCount; c++) {
      view.setInt16(offset, floatTo16(channels[c]![i] ?? 0), true);
      offset += 2;
    }
  }
  return buffer;
}

/** Read back the header fields; used by tests and by the import side later. */
export function readWavHeader(buffer: ArrayBuffer): {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataBytes: number;
  frames: number;
} {
  const view = new DataView(buffer);
  const tag = (o: number) =>
    String.fromCharCode(
      view.getUint8(o),
      view.getUint8(o + 1),
      view.getUint8(o + 2),
      view.getUint8(o + 3),
    );
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || tag(12) !== 'fmt ' || tag(36) !== 'data') {
    throw new Error('not a PCM WAV written by this encoder');
  }
  const channels = view.getUint16(22, true);
  const bitsPerSample = view.getUint16(34, true);
  const dataBytes = view.getUint32(40, true);
  return {
    channels,
    sampleRate: view.getUint32(24, true),
    bitsPerSample,
    dataBytes,
    frames: dataBytes / (channels * (bitsPerSample / 8)),
  };
}
