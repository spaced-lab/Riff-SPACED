// Registers the jest-dom matchers (toBeInTheDocument, toHaveTextContent, ...) with Vitest,
// and unmounts rendered trees after each test. Testing Library only auto-cleans when test
// globals are on; this project keeps globals off, so cleanup is explicit.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
