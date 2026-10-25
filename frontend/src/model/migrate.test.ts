import { describe, expect, it } from 'vitest';
import legacyV0 from '@shared/fixtures/legacy/riff-v0.json';
import { newRiff } from './factories';
import { MigrationError, migrateAny, migrateLibrary, migrateRiff } from './migrate';
import { validateRiff } from './validate';

describe('migrateRiff', () => {
  it('upgrades the v0 fixture to a valid v1 riff', () => {
    const migrated = migrateRiff(legacyV0);
    const result = validateRiff(migrated);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.version).toBe(1);
      expect(result.value.lengthBars).toBe(8);
      expect(result.value.sections).toEqual([
        { id: 'legacy-v0-riff-main', label: 'A', startBar: 0, lengthBars: 8, kind: 'main' },
      ]);
      expect(result.value.timeSignature).toEqual({ beats: 4, unit: 4 });
      expect('bars' in result.value).toBe(false);
    }
  });

  it('leaves a current riff unchanged', () => {
    const riff = newRiff();
    expect(migrateRiff(riff)).toEqual(riff);
  });

  it('refuses documents from the future', () => {
    expect(() => migrateRiff({ ...newRiff(), version: 2 })).toThrow(MigrationError);
  });

  it('migrates every riff inside a library and dispatches on format', () => {
    const lib = migrateLibrary({
      format: 'riff-spaced/library',
      version: 1,
      exportedAt: '2026-01-01T00:00:00Z',
      riffs: [legacyV0],
      arrangements: [],
      songs: [],
    }) as { riffs: { version: number }[] };
    expect(lib.riffs[0]?.version).toBe(1);
    expect((migrateAny(legacyV0) as { version: number }).version).toBe(1);
  });
});
