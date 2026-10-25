import { describe, expect, it } from 'vitest';
import demo from '@shared/fixtures/demo-library.json';
import type { LibraryBundle } from '@/model/types';
import { allTags, filterItems, matches, tokenize } from './search';

const lib = demo as unknown as LibraryBundle;

describe('library search', () => {
  it('tokenizes on whitespace, lower-case, dropping empties', () => {
    expect(tokenize('  Walk  DOWN ')).toEqual(['walk', 'down']);
    expect(tokenize('')).toEqual([]);
  });

  it('matches every token against name, tags, tuning, and section labels (AND)', () => {
    const [walkdown, tritone] = lib.riffs;
    expect(matches(walkdown!, 'turn')).toBe(true);
    expect(matches(walkdown!, 'TURN sludge')).toBe(true);
    expect(matches(walkdown!, 'turn doom')).toBe(false);
    expect(matches(tritone!, 'bb standard')).toBe(true);
    expect(matches(tritone!, 'a')).toBe(true);
    expect(matches(walkdown!, '')).toBe(true);
    expect(filterItems(lib.riffs, 'tritone').map((r) => r.name)).toEqual(['Tritone Chug']);
    expect(filterItems(lib.arrangements, 'verse')).toHaveLength(1);
    expect(filterItems(lib.songs, 'demo song')).toHaveLength(1);
  });

  it('lists tags by frequency then name', () => {
    expect(allTags([...lib.riffs, ...lib.arrangements, ...lib.songs])[0]).toBe('demo');
    expect(allTags(lib.riffs)).toContain('turnaround');
  });
});
