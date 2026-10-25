import type { StateCreator } from 'zustand';
import type { AppState } from './types';

export type VoiceName = 'basic' | 'heavy';
export type AudioState = 'unknown' | 'suspended' | 'running' | 'unavailable';

/**
 * Transport state (SPEC 5.6). `isPlaying` is the request: the engine watches it and starts
 * or stops the scheduler. `positionTick` is a throttled readout for the position display;
 * the playhead itself moves through a ref every frame, not through this field.
 */
export type TransportSlice = {
  isPlaying: boolean;
  loopEnabled: boolean;
  countIn: boolean;
  metronome: boolean;
  voice: VoiceName;
  /** Loop only this section (its bar range) when set. */
  soloSectionId: string | null;
  positionTick: number;
  /** True while the count-in bar is sounding. */
  inCountIn: boolean;
  audioState: AudioState;
  /** Max difference between scheduled audio time and the frame that drew it, last second. */
  syncJitterMs: number | null;
  play: () => void;
  stop: () => void;
  togglePlay: () => void;
  setLoopEnabled: (on: boolean) => void;
  setCountIn: (on: boolean) => void;
  setMetronome: (on: boolean) => void;
  setVoice: (voice: VoiceName) => void;
  setSoloSection: (sectionId: string | null) => void;
  toggleSoloSection: (sectionId: string) => void;
  setBpm: (bpm: number) => void;
  nudgeBpm: (delta: number) => void;
  /** Engine-only setters. */
  setPositionTick: (tick: number) => void;
  setInCountIn: (on: boolean) => void;
  setAudioState: (state: AudioState) => void;
  setSyncJitterMs: (ms: number | null) => void;
};

export const MIN_BPM = 30;
export const MAX_BPM = 300;

export function clampBpm(bpm: number): number {
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)));
}

export const createTransportSlice: StateCreator<AppState, [], [], TransportSlice> = (set, get) => ({
  isPlaying: false,
  loopEnabled: true,
  countIn: false,
  metronome: false,
  voice: 'basic',
  soloSectionId: null,
  positionTick: 0,
  inCountIn: false,
  audioState: 'unknown',
  syncJitterMs: null,

  play: () => set({ isPlaying: true }),
  stop: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setLoopEnabled: (loopEnabled) => set({ loopEnabled }),
  setCountIn: (countIn) => set({ countIn }),
  setMetronome: (metronome) => set({ metronome }),
  setVoice: (voice) => set({ voice }),
  setSoloSection: (soloSectionId) => set({ soloSectionId }),
  toggleSoloSection: (sectionId) =>
    set((s) => ({ soloSectionId: s.soloSectionId === sectionId ? null : sectionId })),

  // Tempo lives in the riff file, so changing it is an edit (one undo step per change).
  setBpm: (bpm) => {
    const next = clampBpm(bpm);
    get().commit('tempo', (riff) =>
      riff.tempo.bpm === next ? riff : { ...riff, tempo: { bpm: next } },
    );
  },
  nudgeBpm: (delta) => get().setBpm(get().riff.tempo.bpm + delta),

  setPositionTick: (positionTick) =>
    set((s) => (s.positionTick === positionTick ? {} : { positionTick })),
  setInCountIn: (inCountIn) => set((s) => (s.inCountIn === inCountIn ? {} : { inCountIn })),
  setAudioState: (audioState) => set((s) => (s.audioState === audioState ? {} : { audioState })),
  setSyncJitterMs: (syncJitterMs) => set({ syncJitterMs }),
});
