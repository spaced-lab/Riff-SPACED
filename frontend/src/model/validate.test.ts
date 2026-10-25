import { describe, expect, it } from 'vitest';
import riffSchema from '@shared/schema/riff.schema.json';
import { newNote, newRiff } from './factories';
import type { Riff } from './types';
import { SECTION_KINDS, TECHNIQUES } from './types';
import { validateArrangement, validateLibrary, validateRiff, validateSong } from './validate';

function errorsOf(doc: unknown): string[] {
  const r = validateRiff(doc);
  return r.ok ? [] : r.errors;
}

function riffWith(mutate: (r: Riff) => void): Riff {
  const r = newRiff();
  mutate(r);
  return r;
}

describe('validateRiff', () => {
  it('accepts a fresh riff with notes and a dyad', () => {
    const r = riffWith((riff) => {
      riff.notes.push(
        newNote({ string: 6, fret: 3, start: 0, duration: 240, chordId: 'c1' }),
        newNote({ string: 5, fret: 5, start: 0, duration: 240, chordId: 'c1' }),
      );
    });
    expect(validateRiff(r)).toEqual({ ok: true, value: r });
  });

  it('rejects non-objects and wrong headers', () => {
    expect(errorsOf(null)).toEqual(['riff must be a JSON object']);
    expect(errorsOf({ ...newRiff(), format: 'nope' })).toContain(
      'format must be "riff-spaced/riff"',
    );
    expect(errorsOf({ ...newRiff(), version: 2 })).toContain(
      'version must be 1 (got 2); run migrate first',
    );
    expect(errorsOf({ ...newRiff(), ppq: 96 })).toContain('ppq must be 480');
  });

  it('reports field ranges with readable paths', () => {
    const r = riffWith((riff) => {
      riff.notes.push(newNote({ string: 6, fret: 25, start: 0, duration: 240 }));
      riff.notes.push(newNote({ string: 7, fret: 0, start: -1, duration: 0 }));
    });
    const errors = errorsOf(r);
    expect(errors).toContain('notes[0].fret must be an integer between 0 and 24');
    expect(errors).toContain('notes[1].string must be an integer between 1 and 6');
    expect(errors).toContain('notes[1].start must be an integer between 0 and 9007199254740991');
    expect(errors).toContain('notes[1].duration must be an integer between 1 and 9007199254740991');
  });

  it('rejects unknown or repeated techniques and bad velocity and confidence', () => {
    const r = riffWith((riff) => {
      riff.notes.push({
        ...newNote({ string: 6, fret: 0, start: 0, duration: 120 }),
        // Deliberately invalid data for the validator; the cast is the point of the test.
        techniques: [
          'palmMute',
          'palmMute',
          'tap',
        ] as unknown as Riff['notes'][number]['techniques'],
        velocity: 200,
        confidence: 1.5,
      });
    });
    const errors = errorsOf(r);
    expect(errors).toContain('notes[0].techniques contains unknown technique "tap"');
    expect(errors).toContain('notes[0].techniques must not repeat a technique');
    expect(errors).toContain('notes[0].velocity must be an integer between 1 and 127');
    expect(errors).toContain('notes[0].confidence must be a number between 0 and 1');
  });

  it('requires chord members to share a start', () => {
    const r = riffWith((riff) => {
      riff.notes.push(
        newNote({ string: 6, fret: 3, start: 0, duration: 240, chordId: 'c1' }),
        newNote({ string: 5, fret: 5, start: 240, duration: 240, chordId: 'c1' }),
      );
    });
    expect(errorsOf(r)).toEqual(['notes[1] shares chordId "c1" but starts at 240, not 0']);
  });

  it('requires sections to be contiguous and cover the riff', () => {
    const gap = riffWith((riff) => {
      riff.lengthBars = 8;
      riff.sections = [
        { id: 'a', label: 'A', startBar: 0, lengthBars: 4, kind: 'main' },
        { id: 'b', label: 'B', startBar: 5, lengthBars: 3, kind: 'variation' },
      ];
    });
    expect(errorsOf(gap)).toEqual([
      'sections must be contiguous: expected a section starting at bar 4, found "B" at 5',
    ]);

    const short = riffWith((riff) => {
      riff.lengthBars = 8;
    });
    expect(errorsOf(short)).toEqual(['sections must cover 0..8 bars exactly, they cover 0..4']);

    const overlap = riffWith((riff) => {
      riff.sections = [
        { id: 'a', label: 'A', startBar: 0, lengthBars: 3, kind: 'main' },
        { id: 'b', label: 'B', startBar: 2, lengthBars: 2, kind: 'other' },
      ];
    });
    expect(errorsOf(overlap)[0]).toMatch(/contiguous/);

    const badKind = riffWith((riff) => {
      riff.sections[0]!.kind = 'chorus' as never;
    });
    expect(errorsOf(badKind)).toEqual([
      `sections[0].kind must be one of ${SECTION_KINDS.join(', ')}`,
    ]);
  });

  it('validates the tuning and tempo', () => {
    expect(errorsOf(riffWith((r) => (r.tuning.pitches = [34, 39, 39, 49, 53, 58])))).toEqual([
      'tuning.pitches must be 6 to 8 strictly ascending integers between 20 and 70 (low to high)',
    ]);
    expect(errorsOf(riffWith((r) => (r.tempo.bpm = 10)))).toEqual([
      'tempo.bpm must be a number between 30 and 300',
    ]);
  });

  it('agrees with the JSON schema on enums and ranges', () => {
    const defs = riffSchema.$defs;
    expect(defs.technique.enum).toEqual([...TECHNIQUES]);
    expect(defs.section.properties.kind.enum).toEqual([...SECTION_KINDS]);
    expect(defs.note.properties.fret.maximum).toBe(24);
    expect(defs.note.properties.velocity.maximum).toBe(127);
    expect(riffSchema.properties.tempo.properties.bpm.minimum).toBe(30);
    expect(riffSchema.properties.tempo.properties.bpm.maximum).toBe(300);
  });
});

describe('validateArrangement, validateSong, validateLibrary', () => {
  it('reports entry and part problems with paths', () => {
    const arr = validateArrangement({
      format: 'riff-spaced/arrangement',
      version: 1,
      id: 'a',
      name: 'x',
      tempo: { bpm: 90 },
      entries: [{ riffId: '', repeats: 0, transpose: 30 }],
      createdAt: 'bad',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    expect(arr.ok).toBe(false);
    if (!arr.ok) {
      expect(arr.errors).toEqual([
        'arrangement.createdAt must be an ISO 8601 date-time string',
        'entries[0].riffId must be a non-empty string',
        'entries[0].repeats must be an integer between 1 and 64',
        'entries[0].transpose must be an integer between -24 and 24',
      ]);
    }
    const song = validateSong({
      format: 'riff-spaced/song',
      version: 1,
      id: 's',
      title: 'T',
      tuning: { name: 'x', pitches: [1] },
      parts: [{}],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    expect(song.ok).toBe(false);
    if (!song.ok) {
      expect(song.errors).toContain('parts[0].arrangementId is required');
    }
  });

  it('prefixes nested errors with the collection and index', () => {
    const lib = validateLibrary({
      format: 'riff-spaced/library',
      version: 1,
      exportedAt: '2026-01-01T00:00:00Z',
      riffs: [{ ...newRiff(), ppq: 96 }],
      arrangements: [],
      songs: 'nope',
    });
    expect(lib.ok).toBe(false);
    if (!lib.ok)
      expect(lib.errors).toEqual(['riffs[0]: ppq must be 480', 'songs must be an array']);
  });
});
