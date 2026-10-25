/**
 * Document types for the three data tiers plus the library bundle (SPEC 4).
 * These are the shapes stored on disk and in localStorage. Every file carries `format`
 * and `version`; `migrate.ts` upgrades old versions and `validate.ts` checks the rules
 * below before anything is trusted.
 */
import type { Accidentals } from '@/music/naming';
import type { Tuning } from '@/music/tuning';

export const RIFF_FORMAT = 'riff-spaced/riff';
export const ARRANGEMENT_FORMAT = 'riff-spaced/arrangement';
export const SONG_FORMAT = 'riff-spaced/song';
export const LIBRARY_FORMAT = 'riff-spaced/library';
export const CURRENT_VERSION = 1;

export const TECHNIQUES = [
  'palmMute',
  'letRing',
  'slideUp',
  'slideDown',
  'bend',
  'hammerOn',
  'pullOff',
  'vibrato',
  'dead',
  'harmonic',
  'tremolo',
] as const;
export type Technique = (typeof TECHNIQUES)[number];

export const SECTION_KINDS = ['main', 'variation', 'turnaround', 'bridge', 'other'] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const SOURCE_TYPES = ['manual', 'audio', 'ai'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const MAX_FRET = 24;
export const MAX_LENGTH_BARS = 64;

export type Note = {
  id: string;
  /** Guitarist numbering: 1 is the highest string, N the lowest. */
  string: number;
  /** 0 is the open string. */
  fret: number;
  /** Ticks from the start of the riff (PPQ 480). */
  start: number;
  /** Ticks, at least 1. */
  duration: number;
  /** 1..127, default 100. */
  velocity?: number;
  /** v1 playback honors palmMute, letRing, dead; the rest are stored and displayed. */
  techniques?: Technique[];
  /** Notes sharing a chordId are a dyad or chord and must share `start`. */
  chordId?: string;
  /** 0..1, default 1. Below 0.6 renders amber. Set by the audio importer. */
  confidence?: number;
  /** Set by transpose or retune when no fingering exists; shown amber, never dropped. */
  unplayable?: boolean;
};

export type Section = {
  id: string;
  label: string;
  startBar: number;
  lengthBars: number;
  kind: SectionKind;
};

export type RiffSource =
  | { type: 'manual' }
  | { type: 'audio'; audioFile?: string; analysisVersion?: string; bpmDetected?: number }
  | { type: 'ai'; model?: string; promptVersion?: number; parentRiffId?: string };

export type Riff = {
  format: typeof RIFF_FORMAT;
  version: 1;
  id: string;
  name: string;
  /** ISO 8601 UTC. */
  createdAt: string;
  updatedAt: string;
  tuning: Tuning;
  tempo: { bpm: number };
  /** Stored for forward compatibility; v1 is 4/4 only and the UI shows it read-only. */
  timeSignature: { beats: number; unit: number };
  ppq: 480;
  lengthBars: number;
  /** Non-overlapping, covering 0..lengthBars. */
  sections: Section[];
  notes: Note[];
  tags?: string[];
  style?: { genres?: string[]; notes?: string };
  namingPrefs?: { accidentals?: Accidentals };
  source?: RiffSource;
};

export type ArrangementEntry = {
  riffId: string;
  repeats: number;
  /** Semitones, default 0. */
  transpose?: number;
  label?: string;
};

export type Arrangement = {
  format: typeof ARRANGEMENT_FORMAT;
  version: 1;
  id: string;
  name: string;
  tempo: { bpm: number };
  entries: ArrangementEntry[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
};

export type SongPart = { arrangementId: string; label?: string };

export type Song = {
  format: typeof SONG_FORMAT;
  version: 1;
  id: string;
  title: string;
  tuning: Tuning;
  parts: SongPart[];
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
};

export type LibraryBundle = {
  format: typeof LIBRARY_FORMAT;
  version: 1;
  exportedAt: string;
  riffs: Riff[];
  arrangements: Arrangement[];
  songs: Song[];
};

export type AnyDocument = Riff | Arrangement | Song | LibraryBundle;
