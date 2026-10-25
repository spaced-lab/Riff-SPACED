/**
 * Version migrations (SPEC 4.5). `migrate*` takes an untrusted parsed document and returns
 * a document shaped like the current version, without validating it; callers validate after.
 * Each migration is one guarded step applied in version order, so a v0 file passes through
 * every step on its way to the current shape.
 */
import {
  LIBRARY_FORMAT,
  RIFF_FORMAT,
  ARRANGEMENT_FORMAT,
  SONG_FORMAT,
  CURRENT_VERSION,
} from './types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function versionOf(doc: Obj): number {
  return typeof doc.version === 'number' ? doc.version : 0;
}

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * v0 was the pre-release shape: `bars` instead of `lengthBars`, no `sections`,
 * no `timeSignature`. Migrating fills those in with one `main` section.
 */
function riffV0toV1(doc: Obj): Obj {
  const lengthBars = typeof doc.bars === 'number' ? doc.bars : ((doc.lengthBars as number) ?? 4);
  const { bars: _bars, ...rest } = doc;
  void _bars;
  return {
    ...rest,
    version: 1,
    lengthBars,
    timeSignature: doc.timeSignature ?? { beats: 4, unit: 4 },
    sections: doc.sections ?? [
      { id: `${String(doc.id ?? 'riff')}-main`, label: 'A', startBar: 0, lengthBars, kind: 'main' },
    ],
  };
}

export function migrateRiff(input: unknown): unknown {
  if (!isObj(input)) return input;
  let doc: Obj = { ...input, format: input.format ?? RIFF_FORMAT };
  const version = versionOf(doc);
  if (version > CURRENT_VERSION) {
    throw new MigrationError(
      `riff version ${version} is newer than this app understands (${CURRENT_VERSION})`,
    );
  }
  // Each step upgrades one version; a v0 file runs through every step in order.
  if (version < 1) doc = riffV0toV1(doc);
  return doc;
}

export function migrateArrangement(input: unknown): unknown {
  if (!isObj(input)) return input;
  const doc: Obj = { ...input, format: input.format ?? ARRANGEMENT_FORMAT };
  if (versionOf(doc) > CURRENT_VERSION) {
    throw new MigrationError(
      `arrangement version ${versionOf(doc)} is newer than this app understands`,
    );
  }
  return { ...doc, version: 1 };
}

export function migrateSong(input: unknown): unknown {
  if (!isObj(input)) return input;
  const doc: Obj = { ...input, format: input.format ?? SONG_FORMAT };
  if (versionOf(doc) > CURRENT_VERSION) {
    throw new MigrationError(`song version ${versionOf(doc)} is newer than this app understands`);
  }
  return { ...doc, version: 1 };
}

export function migrateLibrary(input: unknown): unknown {
  if (!isObj(input)) return input;
  const doc: Obj = { ...input, format: input.format ?? LIBRARY_FORMAT };
  if (versionOf(doc) > CURRENT_VERSION) {
    throw new MigrationError(
      `library version ${versionOf(doc)} is newer than this app understands`,
    );
  }
  const map = (items: unknown, fn: (d: unknown) => unknown) =>
    Array.isArray(items) ? items.map(fn) : [];
  return {
    ...doc,
    version: 1,
    riffs: map(doc.riffs, migrateRiff),
    arrangements: map(doc.arrangements, migrateArrangement),
    songs: map(doc.songs, migrateSong),
  };
}

/** Dispatch on `format` so File > Open can migrate any document kind. */
export function migrateAny(input: unknown): unknown {
  if (!isObj(input)) return input;
  switch (input.format) {
    case ARRANGEMENT_FORMAT:
      return migrateArrangement(input);
    case SONG_FORMAT:
      return migrateSong(input);
    case LIBRARY_FORMAT:
      return migrateLibrary(input);
    default:
      return migrateRiff(input);
  }
}
