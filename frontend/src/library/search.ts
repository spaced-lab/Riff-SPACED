/**
 * Library search (SPEC P5.T2): case-insensitive, every typed token must match somewhere in
 * the item's name, tags, tuning name, or section labels (token AND).
 */
import type { Arrangement, Riff, Song } from '@/model/types';

export function tokenize(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Everything searchable about an item, lower-cased, as one list of strings. */
export function searchableText(item: Riff | Arrangement | Song): string[] {
  const parts: string[] = [];
  if ('name' in item) parts.push(item.name);
  if ('title' in item) parts.push(item.title);
  parts.push(...(item.tags ?? []));
  if ('tuning' in item) parts.push(item.tuning.name);
  if ('sections' in item) parts.push(...item.sections.map((s) => s.label));
  if ('entries' in item) parts.push(...item.entries.map((e) => e.label ?? ''));
  return parts.map((p) => p.toLowerCase());
}

export function matches(item: Riff | Arrangement | Song, query: string): boolean {
  const tokens = tokenize(query);
  if (!tokens.length) return true;
  const haystack = searchableText(item);
  return tokens.every((t) => haystack.some((h) => h.includes(t)));
}

export function filterItems<T extends Riff | Arrangement | Song>(
  items: readonly T[],
  query: string,
): T[] {
  return items.filter((i) => matches(i, query));
}

/** Every tag in use across the library, most used first. */
export function allTags(items: readonly (Riff | Arrangement | Song)[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items)
    for (const t of item.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t);
}
