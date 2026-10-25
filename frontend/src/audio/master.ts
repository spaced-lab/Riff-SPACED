/**
 * The master bus (SPEC 6.2): voices feed a gain at 0.5 into a compressor into the
 * destination. Polyphony is capped at 12 sounding notes; the oldest is stolen.
 */
import type { AudioEvent } from './types';
import { createMetronome } from './voices/metronome';
import type { Voice, VoiceContext, VoiceHandle } from './voices/types';

export const MASTER_GAIN = 0.5;
export const POLYPHONY = 12;

export type MasterContext = VoiceContext &
  Pick<BaseAudioContext, 'createDynamicsCompressor' | 'destination'>;

export type Master = {
  input: GainNode;
  compressor: DynamicsCompressorNode;
  /** A VoiceSink for the scheduler, bound to the active voice. */
  sink: (voice: Voice) => { schedule: (event: AudioEvent) => void; allOff: (time: number) => void };
  activeCount: () => number;
};

export function createMaster(ctx: MasterContext, destination: AudioNode = ctx.destination): Master {
  const input = ctx.createGain();
  input.gain.value = MASTER_GAIN;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.1;
  input.connect(compressor);
  compressor.connect(destination);
  const metronome = createMetronome(ctx, input);

  // Sounding notes in start order, for stealing and for noteOff by id.
  const sounding: { handle: VoiceHandle; voice: Voice; endTime: number }[] = [];
  const prune = (time: number) => {
    for (let i = sounding.length - 1; i >= 0; i--)
      if (sounding[i]!.endTime <= time) sounding.splice(i, 1);
  };

  return {
    input,
    compressor,
    activeCount: () => sounding.length,
    sink(voice) {
      return {
        schedule(event) {
          if (event.kind === 'click') {
            metronome.click(event.time, event.accent);
            return;
          }
          if (event.kind === 'noteOff') {
            // Envelopes already include their release; an explicit off only matters for
            // bookkeeping so stealing sees the right set.
            prune(event.time);
            return;
          }
          prune(event.time);
          while (sounding.length >= POLYPHONY) {
            const oldest = sounding.shift()!;
            oldest.voice.noteOff(oldest.handle, event.time);
          }
          const handle = voice.noteOn(event);
          sounding.push({ handle, voice, endTime: event.time + event.duration });
        },
        allOff(time) {
          voice.allOff(time);
          sounding.length = 0;
        },
      };
    },
  };
}
