/**
 * Flatten an arrangement, or a whole song, into one long virtual riff (P5.T3).
 *
 * Entries are concatenated in order, each repeated `repeats` times. `transpose` shifts
 * frets (shape transposition: the hand moves, the strings stay), and a fret that leaves
 * 0..24 is clamped and flagged unplayable so the engine skips it and the tab shows it
 * amber instead of silently dropping it. One section per entry marks the boundaries.
 * The result is read-only in the UI: edits happen in the source riff.
 */
import type { Arrangement, LibraryBundle, Note, Riff, Section, Song } from '@/model/types';
import { MAX_FRET, RIFF_FORMAT } from '@/model/types';
import { TICKS_PER_BAR } from '@/music/time';

export type FlatRiff = Riff & {
  /** Where each entry starts, for the ruler and the readout. */
  markers: { tick: number; label: string; riffId: string; entryIndex: number; repeat: number }[];
  /** Original note id behind each virtual note id. */
  sourceNoteIds: Record<string, string>;
};

function riffsById(library: Pick<LibraryBundle, 'riffs'>): Map<string, Riff> {
  return new Map(library.riffs.map((r) => [r.id, r]));
}

export function arrangementLengthBars(
  arrangement: Arrangement,
  library: Pick<LibraryBundle, 'riffs'>,
): number {
  const riffs = riffsById(library);
  return arrangement.entries.reduce(
    (sum, e) => sum + (riffs.get(e.riffId)?.lengthBars ?? 0) * e.repeats,
    0,
  );
}

/** Tuning shared by the arrangement's riffs (the first entry's), or null when empty. */
export function arrangementTuning(
  arrangement: Arrangement,
  library: Pick<LibraryBundle, 'riffs'>,
): Riff['tuning'] | null {
  const riffs = riffsById(library);
  for (const e of arrangement.entries) {
    const r = riffs.get(e.riffId);
    if (r) return r.tuning;
  }
  return null;
}

export function flattenArrangement(
  arrangement: Arrangement,
  library: Pick<LibraryBundle, 'riffs'>,
  options: { idPrefix?: string; startBar?: number; bpm?: number } = {},
): FlatRiff {
  const riffs = riffsById(library);
  const prefix = options.idPrefix ?? arrangement.id;
  const notes: Note[] = [];
  const sections: Section[] = [];
  const markers: FlatRiff['markers'] = [];
  const sourceNoteIds: Record<string, string> = {};
  let bar = options.startBar ?? 0;
  let tuning: Riff['tuning'] | null = null;

  arrangement.entries.forEach((entry, entryIndex) => {
    const riff = riffs.get(entry.riffId);
    if (!riff) return;
    tuning ??= riff.tuning;
    const transpose = entry.transpose ?? 0;
    const entryStartBar = bar;
    for (let repeat = 0; repeat < entry.repeats; repeat++) {
      const offset = bar * TICKS_PER_BAR;
      markers.push({
        tick: offset,
        label: entry.label ?? riff.name,
        riffId: riff.id,
        entryIndex,
        repeat,
      });
      for (const n of riff.notes) {
        const rawFret = n.fret + transpose;
        const clamped = Math.max(0, Math.min(MAX_FRET, rawFret));
        const id = `${prefix}:${entryIndex}:${repeat}:${n.id}`;
        sourceNoteIds[id] = n.id;
        notes.push({
          ...n,
          id,
          start: n.start + offset,
          fret: clamped,
          chordId: n.chordId ? `${prefix}:${entryIndex}:${repeat}:${n.chordId}` : undefined,
          unplayable: n.unplayable || clamped !== rawFret,
        });
      }
      bar += riff.lengthBars;
    }
    sections.push({
      id: `${prefix}:${entryIndex}`,
      label: entry.label ?? riff.name,
      startBar: entryStartBar,
      lengthBars: bar - entryStartBar,
      kind: 'main',
    });
  });

  const lengthBars = Math.max(1, bar - (options.startBar ?? 0));
  const base: Riff = {
    format: RIFF_FORMAT,
    version: 1,
    id: `${prefix}:flat`,
    name: arrangement.name,
    createdAt: arrangement.createdAt,
    updatedAt: arrangement.updatedAt,
    tuning: tuning ?? { name: 'Bb Standard', pitches: [34, 39, 44, 49, 53, 58] },
    tempo: { bpm: options.bpm ?? arrangement.tempo.bpm },
    timeSignature: { beats: 4, unit: 4 },
    ppq: 480,
    lengthBars,
    sections: sections.length
      ? sections
      : [{ id: `${prefix}:empty`, label: 'empty', startBar: 0, lengthBars, kind: 'other' }],
    notes,
    tags: arrangement.tags ?? [],
    source: { type: 'manual' },
  };
  return { ...base, markers, sourceNoteIds };
}

/** A song is its arrangements back to back; the tempo is the first arrangement's. */
export function flattenSong(
  song: Song,
  library: Pick<LibraryBundle, 'riffs' | 'arrangements'>,
): FlatRiff {
  const arrangements = new Map(library.arrangements.map((a) => [a.id, a]));
  const parts = song.parts
    .map((p) => ({ part: p, arrangement: arrangements.get(p.arrangementId) }))
    .filter((x) => x.arrangement);
  const bpm = parts[0]?.arrangement?.tempo.bpm ?? 92;
  let bar = 0;
  const notes: Note[] = [];
  const sections: Section[] = [];
  const markers: FlatRiff['markers'] = [];
  const sourceNoteIds: Record<string, string> = {};
  parts.forEach(({ part, arrangement }, i) => {
    const flat = flattenArrangement(arrangement!, library, {
      idPrefix: `${song.id}:${i}`,
      startBar: bar,
      bpm,
    });
    notes.push(...flat.notes);
    markers.push(
      ...flat.markers.map((m) => ({
        ...m,
        label: `${part.label ?? arrangement!.name} · ${m.label}`,
      })),
    );
    Object.assign(sourceNoteIds, flat.sourceNoteIds);
    const length = flat.lengthBars;
    sections.push({
      id: `${song.id}:${i}`,
      label: part.label ?? arrangement!.name,
      startBar: bar,
      lengthBars: length,
      kind: 'main',
    });
    bar += length;
  });
  const lengthBars = Math.max(1, bar);
  return {
    format: RIFF_FORMAT,
    version: 1,
    id: `${song.id}:flat`,
    name: song.title,
    createdAt: song.createdAt,
    updatedAt: song.updatedAt,
    tuning: song.tuning,
    tempo: { bpm },
    timeSignature: { beats: 4, unit: 4 },
    ppq: 480,
    lengthBars,
    sections: sections.length
      ? sections
      : [{ id: `${song.id}:empty`, label: 'empty', startBar: 0, lengthBars, kind: 'other' }],
    notes,
    tags: song.tags ?? [],
    source: { type: 'manual' },
    markers,
    sourceNoteIds,
  };
}
