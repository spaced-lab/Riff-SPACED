/**
 * Constructors for new documents. Defaults follow DECISIONS 1 to 5: Bb Standard, 4 bars,
 * 4/4, 92 BPM, flats. Each factory returns a document that passes `validate`.
 */
import { DEFAULT_TUNING } from '@/music/tuning';
import type { Tuning } from '@/music/tuning';
import { uuid } from './ids';
import type { Arrangement, LibraryBundle, Note, Riff, Section, Song, Technique } from './types';
import { ARRANGEMENT_FORMAT, LIBRARY_FORMAT, RIFF_FORMAT, SONG_FORMAT } from './types';

export const DEFAULT_BPM = 92;
export const DEFAULT_LENGTH_BARS = 4;

export function nowIso(): string {
  return new Date().toISOString();
}

export function newSection(partial: Partial<Section> = {}): Section {
  return {
    id: uuid(),
    label: 'A',
    startBar: 0,
    lengthBars: DEFAULT_LENGTH_BARS,
    kind: 'main',
    ...partial,
  };
}

export function newRiff(tuning: Tuning = DEFAULT_TUNING, partial: Partial<Riff> = {}): Riff {
  const now = nowIso();
  const lengthBars = partial.lengthBars ?? DEFAULT_LENGTH_BARS;
  return {
    format: RIFF_FORMAT,
    version: 1,
    id: uuid(),
    name: 'Untitled riff',
    createdAt: now,
    updatedAt: now,
    tuning: { name: tuning.name, pitches: tuning.pitches.slice() },
    tempo: { bpm: DEFAULT_BPM },
    timeSignature: { beats: 4, unit: 4 },
    ppq: 480,
    lengthBars,
    sections: [newSection({ lengthBars })],
    notes: [],
    tags: [],
    style: { genres: [], notes: '' },
    namingPrefs: { accidentals: 'flats' },
    source: { type: 'manual' },
    ...partial,
  };
}

export type NewNote = {
  string: number;
  fret: number;
  start: number;
  duration: number;
  velocity?: number;
  techniques?: Technique[];
  chordId?: string;
};

export function newNote(input: NewNote): Note {
  const note: Note = {
    id: uuid(),
    string: input.string,
    fret: input.fret,
    start: input.start,
    duration: input.duration,
    velocity: input.velocity ?? 100,
  };
  if (input.techniques && input.techniques.length) note.techniques = [...input.techniques];
  if (input.chordId) note.chordId = input.chordId;
  return note;
}

export function newArrangement(name = 'Untitled arrangement', bpm = DEFAULT_BPM): Arrangement {
  const now = nowIso();
  return {
    format: ARRANGEMENT_FORMAT,
    version: 1,
    id: uuid(),
    name,
    tempo: { bpm },
    entries: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function newSong(title = 'Untitled song', tuning: Tuning = DEFAULT_TUNING): Song {
  const now = nowIso();
  return {
    format: SONG_FORMAT,
    version: 1,
    id: uuid(),
    title,
    tuning: { name: tuning.name, pitches: tuning.pitches.slice() },
    parts: [],
    notes: '',
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function newLibrary(): LibraryBundle {
  return {
    format: LIBRARY_FORMAT,
    version: 1,
    exportedAt: nowIso(),
    riffs: [],
    arrangements: [],
    songs: [],
  };
}
