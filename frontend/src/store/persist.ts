/**
 * Where the library comes from on startup (SPEC 7.1). Phase 2: the demo library, so the app
 * never opens empty. Phase 3 adds the localStorage autosave bundle in front of it.
 */
import demo from '@shared/fixtures/demo-library.json';
import { migrateLibrary } from '@/model/migrate';
import type { LibraryBundle } from '@/model/types';
import { validateLibrary } from '@/model/validate';

export function loadDemoLibrary(): LibraryBundle {
  const result = validateLibrary(migrateLibrary(demo));
  if (!result.ok) {
    // The fixture is tested in CI, so this is a build error, not a runtime condition.
    throw new Error(`demo library is invalid:\n${result.errors.join('\n')}`);
  }
  return structuredClone(result.value);
}

export function loadInitialLibrary(): LibraryBundle {
  return loadDemoLibrary();
}
