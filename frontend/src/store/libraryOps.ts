/**
 * Pure operations on the library bundle (P5.T2). The slice wraps them; tests call them
 * directly. Deleting a riff also removes it from every arrangement; deleting an arrangement
 * removes it from every song.
 */
import { newArrangement, newRiff, newSong, nowIso } from '@/model/factories';
import { uuid } from '@/model/ids';
import type { Arrangement, LibraryBundle, Riff, Song } from '@/model/types';

export type Tier = 'riffs' | 'arrangements' | 'songs';

export function duplicateName(name: string, existing: readonly string[]): string {
  const base = name.replace(/ copy( \d+)?$/, '');
  let candidate = `${base} copy`;
  let n = 2;
  while (existing.includes(candidate)) candidate = `${base} copy ${n++}`;
  return candidate;
}

export function duplicateRiff(
  library: LibraryBundle,
  id: string,
): { library: LibraryBundle; riff: Riff } | null {
  const source = library.riffs.find((r) => r.id === id);
  if (!source) return null;
  const now = nowIso();
  const copy: Riff = {
    ...structuredClone(source),
    id: uuid(),
    name: duplicateName(
      source.name,
      library.riffs.map((r) => r.name),
    ),
    createdAt: now,
    updatedAt: now,
  };
  return { library: { ...library, riffs: [...library.riffs, copy] }, riff: copy };
}

export function renameItem(
  library: LibraryBundle,
  tier: Tier,
  id: string,
  name: string,
): LibraryBundle {
  const trimmed = name.trim();
  if (!trimmed) return library;
  const stamp = nowIso();
  if (tier === 'songs') {
    return {
      ...library,
      songs: library.songs.map((s) =>
        s.id === id ? { ...s, title: trimmed, updatedAt: stamp } : s,
      ),
    };
  }
  if (tier === 'arrangements') {
    return {
      ...library,
      arrangements: library.arrangements.map((a) =>
        a.id === id ? { ...a, name: trimmed, updatedAt: stamp } : a,
      ),
    };
  }
  return {
    ...library,
    riffs: library.riffs.map((r) => (r.id === id ? { ...r, name: trimmed, updatedAt: stamp } : r)),
  };
}

export function deleteItem(library: LibraryBundle, tier: Tier, id: string): LibraryBundle {
  if (tier === 'riffs') {
    return {
      ...library,
      riffs: library.riffs.filter((r) => r.id !== id),
      arrangements: library.arrangements.map((a) => ({
        ...a,
        entries: a.entries.filter((e) => e.riffId !== id),
      })),
    };
  }
  if (tier === 'arrangements') {
    return {
      ...library,
      arrangements: library.arrangements.filter((a) => a.id !== id),
      songs: library.songs.map((s) => ({
        ...s,
        parts: s.parts.filter((p) => p.arrangementId !== id),
      })),
    };
  }
  return { ...library, songs: library.songs.filter((s) => s.id !== id) };
}

export function setTags(
  library: LibraryBundle,
  tier: Tier,
  id: string,
  tags: string[],
): LibraryBundle {
  const clean = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  const apply = <T extends { id: string; tags?: string[]; updatedAt: string }>(items: T[]): T[] =>
    items.map((i) => (i.id === id ? { ...i, tags: clean, updatedAt: nowIso() } : i));
  if (tier === 'riffs') return { ...library, riffs: apply(library.riffs) };
  if (tier === 'arrangements') return { ...library, arrangements: apply(library.arrangements) };
  return { ...library, songs: apply(library.songs) };
}

export function addTag(library: LibraryBundle, tier: Tier, id: string, tag: string): LibraryBundle {
  const item = (library[tier] as { id: string; tags?: string[] }[]).find((i) => i.id === id);
  if (!item) return library;
  return setTags(library, tier, id, [...(item.tags ?? []), tag]);
}

export function removeTag(
  library: LibraryBundle,
  tier: Tier,
  id: string,
  tag: string,
): LibraryBundle {
  const item = (library[tier] as { id: string; tags?: string[] }[]).find((i) => i.id === id);
  if (!item) return library;
  return setTags(
    library,
    tier,
    id,
    (item.tags ?? []).filter((t) => t !== tag),
  );
}

export function createArrangementIn(
  library: LibraryBundle,
  name: string,
  bpm: number,
): { library: LibraryBundle; arrangement: Arrangement } {
  const arrangement = newArrangement(name, bpm);
  return {
    library: { ...library, arrangements: [...library.arrangements, arrangement] },
    arrangement,
  };
}

export function createSongIn(
  library: LibraryBundle,
  title: string,
  tuning: Riff['tuning'],
): { library: LibraryBundle; song: Song } {
  const song = newSong(title, tuning);
  return { library: { ...library, songs: [...library.songs, song] }, song };
}

/** Drag-append: add a riff at the end of an arrangement. Returns null on a tuning mismatch. */
export function appendRiffToArrangement(
  library: LibraryBundle,
  arrangementId: string,
  riffId: string,
): { library: LibraryBundle } | { error: string } {
  const arrangement = library.arrangements.find((a) => a.id === arrangementId);
  const riff = library.riffs.find((r) => r.id === riffId);
  if (!arrangement || !riff) return { error: 'arrangement or riff not found' };
  const first = arrangement.entries[0];
  if (first) {
    const existing = library.riffs.find((r) => r.id === first.riffId);
    if (existing && existing.tuning.pitches.join() !== riff.tuning.pitches.join()) {
      return {
        error: `tuning mismatch: "${arrangement.name}" is in ${existing.tuning.name}, "${riff.name}" is in ${riff.tuning.name}. Retune the riff (keep pitches) first; that tool lands in Phase 8.`,
      };
    }
  }
  const entries = [...arrangement.entries, { riffId, repeats: 1, transpose: 0, label: riff.name }];
  return {
    library: {
      ...library,
      arrangements: library.arrangements.map((a) =>
        a.id === arrangementId ? { ...a, entries, updatedAt: nowIso() } : a,
      ),
    },
  };
}

export function createRiffIn(
  library: LibraryBundle,
  tuning: Riff['tuning'],
  name: string,
): { library: LibraryBundle; riff: Riff } {
  const riff = newRiff(tuning, { name });
  return { library: { ...library, riffs: [...library.riffs, riff] }, riff };
}
