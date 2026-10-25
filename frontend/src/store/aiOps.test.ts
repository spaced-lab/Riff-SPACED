import { afterEach, describe, expect, it } from 'vitest';
import demo from '../../../shared/fixtures/demo-library.json';
import type { LibraryBundle, Riff } from '@/model/types';
import { validateRiff } from '@/model/validate';
import { sequentialIds, setIdGenerator } from '@/model/ids';
import { appendAsVariation, asSiblingRiff } from './aiOps';

const library = demo as unknown as LibraryBundle;
const walkdown = library.riffs[0]!;

describe('appendAsVariation', () => {
  let restore: (() => void) | null = null;
  afterEach(() => restore?.());

  it('adds a variation section after the riff with every note shifted and re-identified', () => {
    restore = setIdGenerator(sequentialIds('v'));
    const suggestion: Riff = {
      ...structuredClone(walkdown),
      id: 'sugg',
      name: 'walkdown (variation 1)',
    };
    const out = appendAsVariation(walkdown, suggestion);
    expect(out.lengthBars).toBe(8);
    expect(out.sections).toHaveLength(2);
    expect(out.sections[1]).toMatchObject({
      label: 'B',
      startBar: 4,
      lengthBars: 4,
      kind: 'variation',
    });
    expect(out.notes).toHaveLength(walkdown.notes.length * 2);
    const added = out.notes.slice(walkdown.notes.length);
    expect(added[0]!.start).toBe(4 * 1920);
    expect(new Set(out.notes.map((n) => n.id)).size).toBe(out.notes.length);
    const parentChords = new Set(walkdown.notes.map((n) => n.chordId).filter(Boolean));
    for (const n of added) if (n.chordId) expect(parentChords.has(n.chordId)).toBe(false);
    expect(validateRiff(out).ok).toBe(true);
    // The parent is untouched (commit relies on a new object).
    expect(walkdown.lengthBars).toBe(4);
  });

  it('refuses another tuning and an over-long result', () => {
    const drop: Riff = {
      ...structuredClone(walkdown),
      tuning: { name: 'Drop Ab', pitches: [32, 39, 44, 49, 53, 58] },
    };
    expect(() => appendAsVariation(walkdown, drop)).toThrow(/tuning mismatch/);
    const long: Riff = { ...structuredClone(walkdown), lengthBars: 64 };
    expect(() => appendAsVariation(walkdown, long)).toThrow(/limit is 64/);
  });
});

describe('asSiblingRiff', () => {
  it('gives the copy a new id, a unique name and the ai tag', () => {
    const copy = asSiblingRiff(walkdown, [walkdown.name, `${walkdown.name} (2)`]);
    expect(copy.id).not.toBe(walkdown.id);
    expect(copy.name).toBe(`${walkdown.name} (3)`);
    expect(copy.tags).toContain('ai');
    expect(copy.notes).toEqual(walkdown.notes);
  });
});
