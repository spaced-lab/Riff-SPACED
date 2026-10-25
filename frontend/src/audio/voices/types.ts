import type { NoteOnEvent } from '../types';

/** An opaque reference to a sounding note, returned by noteOn and accepted by noteOff. */
export type VoiceHandle = {
  readonly id: number;
  readonly noteId: string;
  readonly startTime: number;
};

/**
 * A voice turns note events into audio nodes. The scheduler calls noteOn with the full
 * event (pitch, velocity, techniques, duration), so a voice can schedule its whole envelope
 * including the release up front. noteOff exists for early stops: stealing and Stop.
 */
export type Voice = {
  readonly name: string;
  noteOn: (event: NoteOnEvent) => VoiceHandle;
  /** Fade out fast at `time` and free the nodes. */
  noteOff: (handle: VoiceHandle, time: number) => void;
  allOff: (time: number) => void;
};

/** The minimal AudioContext surface the voices use; fakes implement this in tests. */
export type VoiceContext = Pick<
  BaseAudioContext,
  | 'createOscillator'
  | 'createGain'
  | 'createBiquadFilter'
  | 'createBufferSource'
  | 'createBuffer'
  | 'createWaveShaper'
  | 'sampleRate'
  | 'currentTime'
>;

/** Velocity 1..127 to gain 0.25..1.0, linear (SPEC 6.2). */
export function velocityGain(velocity: number): number {
  const v = Math.max(1, Math.min(127, velocity));
  return 0.25 + ((v - 1) / 126) * 0.75;
}

/** Quick release used when a voice is stopped early (stolen, Stop pressed). */
export const FAST_RELEASE = 0.02;
