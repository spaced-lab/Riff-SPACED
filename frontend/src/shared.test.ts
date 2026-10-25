import { describe, expect, it } from 'vitest';
// The @shared alias points at the repo-level shared/ folder (vite.config.ts and tsconfig paths).
// Raw import keeps this test independent of any JSON fixture existing yet.
import readme from '@shared/fixtures/README.md?raw';

describe('@shared alias', () => {
  it('resolves to the repo shared folder', () => {
    expect(readme).toContain('music-conventions.json');
  });
});
