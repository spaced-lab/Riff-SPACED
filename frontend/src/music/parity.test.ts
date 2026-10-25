import { describe, expect, it } from 'vitest';
import { caseCount, fixture } from './fixture';

/**
 * Guards the contract: if someone adds a section to the fixture, this count changes and the
 * matching Python test (backend/tests/test_fixture_parity.py) must change with it.
 */
describe('fixture parity', () => {
  it('counts every case in music-conventions.json', () => {
    expect(caseCount(fixture)).toBe(90);
  });
});
