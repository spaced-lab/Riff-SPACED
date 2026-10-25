/**
 * Hand-written validation (DECISIONS 17). Checks the fields that matter with messages a
 * person can act on, e.g. `notes[3].fret must be an integer between 0 and 24`.
 *
 * JSON Schema (shared/schema/*.json) remains the formal definition; the backend validates
 * against it with the jsonschema library. This module mirrors the schema's rules and adds
 * the semantic ones JSON Schema cannot express: chord members share a start, sections cover
 * the riff without overlap, strings fit the tuning.
 */
import { isValidTuning } from '@/music/tuning';
import type {
  Arrangement,
  LibraryBundle,
  Note,
  Riff,
  Section,
  Song,
  Technique,
  SectionKind,
} from './types';
import {
  ARRANGEMENT_FORMAT,
  LIBRARY_FORMAT,
  MAX_FRET,
  MAX_LENGTH_BARS,
  RIFF_FORMAT,
  SECTION_KINDS,
  SONG_FORMAT,
  SOURCE_TYPES,
  TECHNIQUES,
} from './types';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

/** Collects messages; every check appends instead of throwing so the user sees them all. */
class Errors {
  readonly list: string[] = [];
  add(message: string): void {
    this.list.push(message);
  }
  intIn(obj: Obj, key: string, min: number, max: number, path: string, required = true): void {
    const v = obj[key];
    if (v === undefined) {
      if (required) this.add(`${path}.${key} is required`);
      return;
    }
    if (!isInt(v) || v < min || v > max) {
      this.add(`${path}.${key} must be an integer between ${min} and ${max}`);
    }
  }
  numIn(obj: Obj, key: string, min: number, max: number, path: string, required = true): void {
    const v = obj[key];
    if (v === undefined) {
      if (required) this.add(`${path}.${key} is required`);
      return;
    }
    if (!isNum(v) || v < min || v > max) {
      this.add(`${path}.${key} must be a number between ${min} and ${max}`);
    }
  }
  nonEmptyString(obj: Obj, key: string, path: string, required = true): void {
    const v = obj[key];
    if (v === undefined) {
      if (required) this.add(`${path}.${key} is required`);
      return;
    }
    if (!isStr(v) || v.length === 0) this.add(`${path}.${key} must be a non-empty string`);
  }
  dateTime(obj: Obj, key: string, path: string): void {
    const v = obj[key];
    if (!isStr(v) || Number.isNaN(Date.parse(v))) {
      this.add(`${path}.${key} must be an ISO 8601 date-time string`);
    }
  }
  stringArray(obj: Obj, key: string, path: string): void {
    const v = obj[key];
    if (v === undefined) return;
    if (!Array.isArray(v) || !v.every(isStr))
      this.add(`${path}.${key} must be an array of strings`);
  }
}

function checkHeader(doc: Obj, format: string, errors: Errors): void {
  if (doc.format !== format) errors.add(`format must be "${format}"`);
  if (doc.version !== 1)
    errors.add(`version must be 1 (got ${String(doc.version)}); run migrate first`);
}

function checkTuning(value: unknown, path: string, errors: Errors): void {
  if (!isObj(value)) {
    errors.add(`${path} is required`);
    return;
  }
  errors.nonEmptyString(value, 'name', path);
  const pitches = value.pitches;
  if (!Array.isArray(pitches) || !pitches.every(isInt)) {
    errors.add(`${path}.pitches must be an array of integers`);
  } else if (!isValidTuning({ pitches })) {
    errors.add(
      `${path}.pitches must be 6 to 8 strictly ascending integers between 20 and 70 (low to high)`,
    );
  }
}

function checkTempo(value: unknown, path: string, errors: Errors): void {
  if (!isObj(value)) {
    errors.add(`${path} is required`);
    return;
  }
  errors.numIn(value, 'bpm', 30, 300, path);
}

function checkNote(value: unknown, index: number, stringCount: number, errors: Errors): void {
  const path = `notes[${index}]`;
  if (!isObj(value)) {
    errors.add(`${path} must be an object`);
    return;
  }
  errors.nonEmptyString(value, 'id', path);
  errors.intIn(value, 'string', 1, stringCount, path);
  errors.intIn(value, 'fret', 0, MAX_FRET, path);
  errors.intIn(value, 'start', 0, Number.MAX_SAFE_INTEGER, path);
  errors.intIn(value, 'duration', 1, Number.MAX_SAFE_INTEGER, path);
  errors.intIn(value, 'velocity', 1, 127, path, false);
  errors.numIn(value, 'confidence', 0, 1, path, false);
  if (value.unplayable !== undefined && typeof value.unplayable !== 'boolean') {
    errors.add(`${path}.unplayable must be a boolean`);
  }
  if (value.chordId !== undefined && (!isStr(value.chordId) || value.chordId.length === 0)) {
    errors.add(`${path}.chordId must be a non-empty string`);
  }
  const techniques = value.techniques;
  if (techniques !== undefined) {
    if (!Array.isArray(techniques)) {
      errors.add(`${path}.techniques must be an array`);
    } else {
      for (const t of techniques) {
        if (!TECHNIQUES.includes(t as Technique)) {
          errors.add(`${path}.techniques contains unknown technique "${String(t)}"`);
        }
      }
      if (new Set(techniques).size !== techniques.length) {
        errors.add(`${path}.techniques must not repeat a technique`);
      }
    }
  }
}

function checkSections(value: unknown, lengthBars: number, errors: Errors): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.add('sections must be a non-empty array');
    return;
  }
  const sections: Section[] = [];
  value.forEach((s, i) => {
    const path = `sections[${i}]`;
    if (!isObj(s)) {
      errors.add(`${path} must be an object`);
      return;
    }
    errors.nonEmptyString(s, 'id', path);
    if (!isStr(s.label)) errors.add(`${path}.label must be a string`);
    errors.intIn(s, 'startBar', 0, MAX_LENGTH_BARS, path);
    errors.intIn(s, 'lengthBars', 1, MAX_LENGTH_BARS, path);
    if (!SECTION_KINDS.includes(s.kind as SectionKind)) {
      errors.add(`${path}.kind must be one of ${SECTION_KINDS.join(', ')}`);
    }
    if (isInt(s.startBar) && isInt(s.lengthBars)) sections.push(s as unknown as Section);
  });
  if (sections.length !== value.length) return;

  // Coverage: sorted by start, each section must begin exactly where the previous ended,
  // the first at bar 0 and the last ending at lengthBars.
  const sorted = [...sections].sort((a, b) => a.startBar - b.startBar);
  let expectedStart = 0;
  for (const s of sorted) {
    if (s.startBar !== expectedStart) {
      errors.add(
        `sections must be contiguous: expected a section starting at bar ${expectedStart}, found "${s.label}" at ${s.startBar}`,
      );
      return;
    }
    expectedStart = s.startBar + s.lengthBars;
  }
  if (expectedStart !== lengthBars) {
    errors.add(`sections must cover 0..${lengthBars} bars exactly, they cover 0..${expectedStart}`);
  }
}

function checkChordGroups(notes: Note[], errors: Errors): void {
  const starts = new Map<string, number>();
  notes.forEach((n, i) => {
    if (!n.chordId) return;
    const seen = starts.get(n.chordId);
    if (seen === undefined) starts.set(n.chordId, n.start);
    else if (seen !== n.start) {
      errors.add(`notes[${i}] shares chordId "${n.chordId}" but starts at ${n.start}, not ${seen}`);
    }
  });
}

export function validateRiff(doc: unknown): ValidationResult<Riff> {
  const errors = new Errors();
  if (!isObj(doc)) return { ok: false, errors: ['riff must be a JSON object'] };
  checkHeader(doc, RIFF_FORMAT, errors);
  errors.nonEmptyString(doc, 'id', 'riff');
  errors.nonEmptyString(doc, 'name', 'riff');
  errors.dateTime(doc, 'createdAt', 'riff');
  errors.dateTime(doc, 'updatedAt', 'riff');
  checkTuning(doc.tuning, 'tuning', errors);
  checkTempo(doc.tempo, 'tempo', errors);
  if (!isObj(doc.timeSignature)) errors.add('timeSignature is required');
  else {
    errors.intIn(doc.timeSignature, 'beats', 1, 16, 'timeSignature');
    if (![1, 2, 4, 8, 16].includes(doc.timeSignature.unit as number)) {
      errors.add('timeSignature.unit must be one of 1, 2, 4, 8, 16');
    }
  }
  if (doc.ppq !== 480) errors.add('ppq must be 480');
  errors.intIn(doc, 'lengthBars', 1, MAX_LENGTH_BARS, 'riff');
  errors.stringArray(doc, 'tags', 'riff');

  const stringCount =
    isObj(doc.tuning) && Array.isArray(doc.tuning.pitches) ? doc.tuning.pitches.length : 6;
  if (!Array.isArray(doc.notes)) errors.add('notes must be an array');
  else doc.notes.forEach((n, i) => checkNote(n, i, stringCount, errors));

  if (isInt(doc.lengthBars)) checkSections(doc.sections, doc.lengthBars, errors);
  else if (!Array.isArray(doc.sections)) errors.add('sections must be a non-empty array');

  if (isObj(doc.source) && !SOURCE_TYPES.includes(doc.source.type as never)) {
    errors.add(`source.type must be one of ${SOURCE_TYPES.join(', ')}`);
  }
  if (isObj(doc.namingPrefs) && doc.namingPrefs.accidentals !== undefined) {
    if (!['flats', 'sharps'].includes(doc.namingPrefs.accidentals as string)) {
      errors.add('namingPrefs.accidentals must be "flats" or "sharps"');
    }
  }

  if (errors.list.length === 0 && Array.isArray(doc.notes)) {
    checkChordGroups(doc.notes as Note[], errors);
  }
  return errors.list.length
    ? { ok: false, errors: errors.list }
    : { ok: true, value: doc as unknown as Riff };
}

export function validateArrangement(doc: unknown): ValidationResult<Arrangement> {
  const errors = new Errors();
  if (!isObj(doc)) return { ok: false, errors: ['arrangement must be a JSON object'] };
  checkHeader(doc, ARRANGEMENT_FORMAT, errors);
  errors.nonEmptyString(doc, 'id', 'arrangement');
  errors.nonEmptyString(doc, 'name', 'arrangement');
  errors.dateTime(doc, 'createdAt', 'arrangement');
  errors.dateTime(doc, 'updatedAt', 'arrangement');
  checkTempo(doc.tempo, 'tempo', errors);
  errors.stringArray(doc, 'tags', 'arrangement');
  if (!Array.isArray(doc.entries)) errors.add('entries must be an array');
  else {
    doc.entries.forEach((e, i) => {
      const path = `entries[${i}]`;
      if (!isObj(e)) {
        errors.add(`${path} must be an object`);
        return;
      }
      errors.nonEmptyString(e, 'riffId', path);
      errors.intIn(e, 'repeats', 1, 64, path);
      errors.intIn(e, 'transpose', -24, 24, path, false);
      if (e.label !== undefined && !isStr(e.label)) errors.add(`${path}.label must be a string`);
    });
  }
  return errors.list.length
    ? { ok: false, errors: errors.list }
    : { ok: true, value: doc as unknown as Arrangement };
}

export function validateSong(doc: unknown): ValidationResult<Song> {
  const errors = new Errors();
  if (!isObj(doc)) return { ok: false, errors: ['song must be a JSON object'] };
  checkHeader(doc, SONG_FORMAT, errors);
  errors.nonEmptyString(doc, 'id', 'song');
  errors.nonEmptyString(doc, 'title', 'song');
  errors.dateTime(doc, 'createdAt', 'song');
  errors.dateTime(doc, 'updatedAt', 'song');
  checkTuning(doc.tuning, 'tuning', errors);
  errors.stringArray(doc, 'tags', 'song');
  if (doc.notes !== undefined && !isStr(doc.notes)) errors.add('song.notes must be a string');
  if (!Array.isArray(doc.parts)) errors.add('parts must be an array');
  else {
    doc.parts.forEach((p, i) => {
      const path = `parts[${i}]`;
      if (!isObj(p)) {
        errors.add(`${path} must be an object`);
        return;
      }
      errors.nonEmptyString(p, 'arrangementId', path);
      if (p.label !== undefined && !isStr(p.label)) errors.add(`${path}.label must be a string`);
    });
  }
  return errors.list.length
    ? { ok: false, errors: errors.list }
    : { ok: true, value: doc as unknown as Song };
}

export function validateLibrary(doc: unknown): ValidationResult<LibraryBundle> {
  const errors = new Errors();
  if (!isObj(doc)) return { ok: false, errors: ['library must be a JSON object'] };
  checkHeader(doc, LIBRARY_FORMAT, errors);
  errors.dateTime(doc, 'exportedAt', 'library');
  const collect = <T>(
    key: 'riffs' | 'arrangements' | 'songs',
    validate: (d: unknown) => ValidationResult<T>,
  ) => {
    const items = doc[key];
    if (!Array.isArray(items)) {
      errors.add(`${key} must be an array`);
      return;
    }
    items.forEach((item, i) => {
      const r = validate(item);
      if (!r.ok) r.errors.forEach((e) => errors.add(`${key}[${i}]: ${e}`));
    });
  };
  collect('riffs', validateRiff);
  collect('arrangements', validateArrangement);
  collect('songs', validateSong);
  return errors.list.length
    ? { ok: false, errors: errors.list }
    : { ok: true, value: doc as unknown as LibraryBundle };
}

/** Dispatch on `format`, for File > Open which accepts any of the four document kinds. */
export function detectFormat(doc: unknown): string | undefined {
  return isObj(doc) && isStr(doc.format) ? doc.format : undefined;
}
