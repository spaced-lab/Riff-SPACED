import { describe, expect, it } from 'vitest';
import demo from '@shared/fixtures/demo-library.json';
import legacy from '@shared/fixtures/legacy/riff-v0.json';
import type { LibraryBundle } from '@/model/types';
import { duplicateIds, fileNameFor, itemsOf, mergeIntoLibrary, parseDocument } from './documents';
import { safeFileName } from './files';
import { pushRecent, readRecent, RECENT_MAX } from './recent';

const lib = demo as unknown as LibraryBundle;

describe('parseDocument', () => {
  it('detects, migrates, and validates each format', () => {
    const riff = parseDocument(JSON.stringify(lib.riffs[0]));
    expect(riff.ok && riff.doc.kind).toBe('riff');
    const arr = parseDocument(JSON.stringify(lib.arrangements[0]));
    expect(arr.ok && arr.doc.kind).toBe('arrangement');
    const song = parseDocument(JSON.stringify(lib.songs[0]));
    expect(song.ok && song.doc.kind).toBe('song');
    const bundle = parseDocument(JSON.stringify(lib));
    expect(bundle.ok && bundle.doc.kind).toBe('library');
    const old = parseDocument(JSON.stringify(legacy));
    expect(old.ok && old.doc.kind === 'riff' && old.doc.value.version).toBe(1);
  });

  it('reports JSON errors, validation errors, and unknown formats', () => {
    expect(parseDocument('{nope')).toMatchObject({ ok: false });
    const bad = parseDocument(JSON.stringify({ ...lib.riffs[0], ppq: 96 }));
    expect(bad.ok ? [] : bad.errors).toContain('ppq must be 480');
    expect(
      parseDocument(JSON.stringify({ format: 'riff-spaced/other', version: 1 })),
    ).toMatchObject({ ok: false });
    expect(parseDocument(JSON.stringify({ ...lib.riffs[0], version: 9 }))).toMatchObject({
      ok: false,
    });
  });
});

describe('merge', () => {
  it('finds duplicates and replaces or keeps both with rewritten references', () => {
    const incoming = itemsOf({ kind: 'library', value: lib });
    expect(duplicateIds(lib, incoming)).toHaveLength(4);
    const replaced = mergeIntoLibrary(
      lib,
      { ...incoming, riffs: [{ ...lib.riffs[0]!, name: 'Replaced' }] },
      'replace',
    );
    expect(replaced.riffs.find((r) => r.id === 'demo-riff-walkdown')!.name).toBe('Replaced');
    expect(replaced.riffs).toHaveLength(2);
    const both = mergeIntoLibrary(lib, incoming, 'keepBoth');
    expect(both.riffs).toHaveLength(4);
    expect(both.arrangements).toHaveLength(2);
    expect(both.songs).toHaveLength(2);
    const newArr = both.arrangements[1]!;
    expect(newArr.name).toBe('Demo verse (imported)');
    const newRiffIds = new Set(both.riffs.slice(2).map((r) => r.id));
    expect(newArr.entries.every((e) => newRiffIds.has(e.riffId))).toBe(true);
    expect(both.songs[1]!.parts[0]!.arrangementId).toBe(newArr.id);
    const fresh = mergeIntoLibrary(
      lib,
      itemsOf({ kind: 'riff', value: { ...lib.riffs[0]!, id: 'brand-new' } }),
      'replace',
    );
    expect(fresh.riffs).toHaveLength(3);
  });

  it('names files per kind and sanitizes', () => {
    expect(fileNameFor({ kind: 'riff', value: lib.riffs[0]! })).toBe(
      'Walkdown-Turnaround.riff.json',
    );
    expect(fileNameFor({ kind: 'arrangement', value: lib.arrangements[0]! })).toBe(
      'Demo-verse.arr.json',
    );
    expect(fileNameFor({ kind: 'song', value: lib.songs[0]! })).toBe('Demo-song.song.json');
    expect(fileNameFor({ kind: 'library', value: lib })).toBe('library.riffspaced.json');
    expect(safeFileName('  my / riff?  ')).toBe('my-riff');
    expect(safeFileName('///')).toBe('untitled');
  });
});

describe('recent', () => {
  it('keeps the newest ten unique entries', () => {
    const data: Record<string, string> = {};
    const kv = {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => (data[k] = v),
    };
    for (let i = 0; i < 12; i++)
      pushRecent({ name: `r${i}.riff.json`, kind: 'riff', id: `id${i}` }, kv);
    pushRecent({ name: 'r5-again.riff.json', kind: 'riff', id: 'id5' }, kv);
    const list = readRecent(kv);
    expect(list).toHaveLength(RECENT_MAX);
    expect(list[0]!.name).toBe('r5-again.riff.json');
    expect(list.filter((e) => e.id === 'id5')).toHaveLength(1);
    expect(readRecent({ getItem: () => '{bad', setItem: () => undefined })).toEqual([]);
  });
});
