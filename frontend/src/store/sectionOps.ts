/**
 * Loop length and section operations (P3.T4). Sections must stay contiguous and cover
 * 0..lengthBars; these functions make invalid states unreachable by only offering split,
 * merge, rename, and kind changes, and by padding or truncating when the loop resizes.
 */
import { uuid } from '@/model/ids';
import type { Note, Riff, Section, SectionKind } from '@/model/types';
import { GRID, TICKS_PER_BAR, snapToGrid } from '@/music/time';
import type { GridName } from '@/music/time';

export function sortedSections(sections: readonly Section[]): Section[] {
  return [...sections].sort((a, b) => a.startBar - b.startBar);
}

/** Notes that would be removed entirely if the loop shrank to `lengthBars`. */
export function notesCutBy(riff: Riff, lengthBars: number): Note[] {
  const end = lengthBars * TICKS_PER_BAR;
  return riff.notes.filter((n) => n.start >= end);
}

/**
 * Resize the loop. Growing extends the last section; shrinking drops sections past the end,
 * clips the last one, removes notes starting past the end, and clips notes crossing it.
 */
export function setLengthBars(riff: Riff, lengthBars: number): Riff {
  if (lengthBars === riff.lengthBars) return riff;
  const end = lengthBars * TICKS_PER_BAR;
  const sections = sortedSections(riff.sections)
    .filter((s) => s.startBar < lengthBars)
    .map((s) => ({ ...s, lengthBars: Math.min(s.lengthBars, lengthBars - s.startBar) }));
  const last = sections[sections.length - 1];
  if (last) {
    const covered = last.startBar + last.lengthBars;
    if (covered < lengthBars)
      sections[sections.length - 1] = { ...last, lengthBars: lengthBars - last.startBar };
  } else {
    sections.push({ id: uuid(), label: 'A', startBar: 0, lengthBars, kind: 'main' });
  }
  const notes = riff.notes
    .filter((n) => n.start < end)
    .map((n) => (n.start + n.duration > end ? { ...n, duration: end - n.start } : n));
  return { ...riff, lengthBars, sections, notes };
}

/** Snap starts and durations of the given notes to the grid; durations never below one step. */
export function quantizeNotes(riff: Riff, ids: readonly string[], grid: GridName): Riff {
  const step = GRID[grid];
  const end = riff.lengthBars * TICKS_PER_BAR;
  const wanted = new Set(ids);
  let changed = false;
  const notes = riff.notes.map((n) => {
    if (!wanted.has(n.id)) return n;
    const start = Math.min(end - step, snapToGrid(n.start, step));
    const duration = Math.max(step, Math.min(end - start, snapToGrid(n.duration, step)));
    if (start === n.start && duration === n.duration) return n;
    changed = true;
    return { ...n, start, duration };
  });
  return changed ? { ...riff, notes } : riff;
}

/** Split a section at `atBar` (exclusive of its start, inside its range). */
export function splitSection(riff: Riff, sectionId: string, atBar: number): Riff {
  const section = riff.sections.find((s) => s.id === sectionId);
  if (!section) return riff;
  if (atBar <= section.startBar || atBar >= section.startBar + section.lengthBars) return riff;
  const first: Section = { ...section, lengthBars: atBar - section.startBar };
  const second: Section = {
    id: uuid(),
    label: nextLabel(riff.sections),
    startBar: atBar,
    lengthBars: section.startBar + section.lengthBars - atBar,
    kind: section.kind,
  };
  const sections = riff.sections.flatMap((s) => (s.id === sectionId ? [first, second] : [s]));
  return { ...riff, sections: sortedSections(sections) };
}

/** Merge a section with the one after it (keeps the first one's identity). */
export function mergeWithNext(riff: Riff, sectionId: string): Riff {
  const sorted = sortedSections(riff.sections);
  const i = sorted.findIndex((s) => s.id === sectionId);
  const next = sorted[i + 1];
  const current = sorted[i];
  if (!current || !next) return riff;
  const merged: Section = { ...current, lengthBars: current.lengthBars + next.lengthBars };
  return {
    ...riff,
    sections: sorted.flatMap((s) => (s.id === sectionId ? [merged] : s.id === next.id ? [] : [s])),
  };
}

export function updateSection(
  riff: Riff,
  sectionId: string,
  patch: Partial<Pick<Section, 'label' | 'kind'>>,
): Riff {
  let changed = false;
  const sections = riff.sections.map((s) => {
    if (s.id !== sectionId) return s;
    changed = true;
    return { ...s, ...patch };
  });
  return changed ? { ...riff, sections } : riff;
}

/** Next unused single-letter label: A, B, C ... */
export function nextLabel(sections: readonly Section[]): string {
  const used = new Set(sections.map((s) => s.label));
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    if (!used.has(letter)) return letter;
  }
  return `S${sections.length + 1}`;
}

export const SECTION_KIND_LIST: readonly SectionKind[] = [
  'main',
  'variation',
  'turnaround',
  'bridge',
  'other',
];
