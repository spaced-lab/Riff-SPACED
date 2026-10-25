/**
 * ID generation (DECISIONS 27): UUID v4 from the platform. Wrapped so tests can install a
 * deterministic generator and fixtures can stay readable.
 */

let generator: () => string = () => crypto.randomUUID();

export function uuid(): string {
  return generator();
}

/** Replace the generator (tests). Returns a function that restores the previous one. */
export function setIdGenerator(next: () => string): () => void {
  const previous = generator;
  generator = next;
  return () => {
    generator = previous;
  };
}

/** A deterministic generator producing `prefix-1`, `prefix-2`, ... */
export function sequentialIds(prefix = 'id'): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}
