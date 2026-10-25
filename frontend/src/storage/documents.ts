/**
 * Turning parsed JSON into library items (P5.T4): detect the format, migrate, validate,
 * and describe duplicates so the caller can ask "replace or keep both" (SPEC 7.5).
 */
import type { Arrangement, LibraryBundle, Riff, Song } from '@/model/types';
import { ARRANGEMENT_FORMAT, LIBRARY_FORMAT, RIFF_FORMAT, SONG_FORMAT } from '@/model/types';
import { migrateAny } from '@/model/migrate';
import { validateArrangement, validateLibrary, validateRiff, validateSong } from '@/model/validate';
import { uuid } from '@/model/ids';

export type ParsedDocument =
  | { kind: 'riff'; value: Riff }
  | { kind: 'arrangement'; value: Arrangement }
  | { kind: 'song'; value: Song }
  | { kind: 'library'; value: LibraryBundle };

export type ParseResult = { ok: true; doc: ParsedDocument } | { ok: false; errors: string[] };

export function parseDocument(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      errors: [`not valid JSON: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
  let migrated: unknown;
  try {
    migrated = migrateAny(raw);
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
  const format =
    typeof migrated === 'object' && migrated
      ? (migrated as { format?: unknown }).format
      : undefined;
  if (format === LIBRARY_FORMAT) {
    const r = validateLibrary(migrated);
    return r.ok
      ? { ok: true, doc: { kind: 'library', value: r.value } }
      : { ok: false, errors: r.errors };
  }
  if (format === ARRANGEMENT_FORMAT) {
    const r = validateArrangement(migrated);
    return r.ok
      ? { ok: true, doc: { kind: 'arrangement', value: r.value } }
      : { ok: false, errors: r.errors };
  }
  if (format === SONG_FORMAT) {
    const r = validateSong(migrated);
    return r.ok
      ? { ok: true, doc: { kind: 'song', value: r.value } }
      : { ok: false, errors: r.errors };
  }
  if (format === RIFF_FORMAT || format === undefined) {
    const r = validateRiff(migrated);
    return r.ok
      ? { ok: true, doc: { kind: 'riff', value: r.value } }
      : { ok: false, errors: r.errors };
  }
  return { ok: false, errors: [`unknown format "${String(format)}"`] };
}

/** Items from a document as three lists, so one merge routine handles every kind. */
export function itemsOf(
  doc: ParsedDocument,
): Pick<LibraryBundle, 'riffs' | 'arrangements' | 'songs'> {
  switch (doc.kind) {
    case 'riff':
      return { riffs: [doc.value], arrangements: [], songs: [] };
    case 'arrangement':
      return { riffs: [], arrangements: [doc.value], songs: [] };
    case 'song':
      return { riffs: [], arrangements: [], songs: [doc.value] };
    case 'library':
      return {
        riffs: doc.value.riffs,
        arrangements: doc.value.arrangements,
        songs: doc.value.songs,
      };
  }
}

export function duplicateIds(
  library: LibraryBundle,
  incoming: ReturnType<typeof itemsOf>,
): string[] {
  const existing = new Set(
    [...library.riffs, ...library.arrangements, ...library.songs].map((i) => i.id),
  );
  return [...incoming.riffs, ...incoming.arrangements, ...incoming.songs]
    .map((i) => i.id)
    .filter((id) => existing.has(id));
}

export type MergeMode = 'replace' | 'keepBoth';

/**
 * Merge incoming items into the library. `replace` overwrites same-id items; `keepBoth`
 * gives incoming duplicates new ids (and rewrites references inside the same import).
 */
export function mergeIntoLibrary(
  library: LibraryBundle,
  incoming: ReturnType<typeof itemsOf>,
  mode: MergeMode,
): LibraryBundle {
  let riffs = incoming.riffs;
  let arrangements = incoming.arrangements;
  let songs = incoming.songs;
  if (mode === 'keepBoth') {
    const dupes = new Set(duplicateIds(library, incoming));
    const idMap = new Map<string, string>();
    for (const id of dupes) idMap.set(id, uuid());
    const remap = (id: string) => idMap.get(id) ?? id;
    riffs = riffs.map((r) =>
      dupes.has(r.id) ? { ...r, id: remap(r.id), name: `${r.name} (imported)` } : r,
    );
    arrangements = arrangements.map((a) => ({
      ...a,
      id: remap(a.id),
      name: dupes.has(a.id) ? `${a.name} (imported)` : a.name,
      entries: a.entries.map((e) => ({ ...e, riffId: remap(e.riffId) })),
    }));
    songs = songs.map((s) => ({
      ...s,
      id: remap(s.id),
      title: dupes.has(s.id) ? `${s.title} (imported)` : s.title,
      parts: s.parts.map((p) => ({ ...p, arrangementId: remap(p.arrangementId) })),
    }));
  }
  const upsert = <T extends { id: string }>(current: T[], add: T[]): T[] => {
    const byId = new Map(current.map((i) => [i.id, i]));
    for (const item of add) byId.set(item.id, item);
    return [...byId.values()];
  };
  return {
    ...library,
    riffs: upsert(library.riffs, riffs),
    arrangements: upsert(library.arrangements, arrangements),
    songs: upsert(library.songs, songs),
  };
}

export function fileNameFor(doc: ParsedDocument | { kind: 'riff'; value: Riff }): string {
  const base = (name: string) =>
    name
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^A-Za-z0-9._-]/g, '') || 'untitled';
  switch (doc.kind) {
    case 'riff':
      return `${base(doc.value.name)}.riff.json`;
    case 'arrangement':
      return `${base(doc.value.name)}.arr.json`;
    case 'song':
      return `${base(doc.value.title)}.song.json`;
    case 'library':
      return `library.riffspaced.json`;
  }
}
