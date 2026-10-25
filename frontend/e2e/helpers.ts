import type { Page } from '@playwright/test';

/**
 * Collects console errors and uncaught page errors so a test can assert the
 * console stayed clean (SPEC 11: any console.error fails a UI task).
 * Call it before `page.goto` so nothing is missed.
 */
export function watchConsole(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // The analysis backend is optional (SPEC 2.3). When it is down, the health poll's
    // refused connection is logged by the browser itself as a resource error; that is the
    // expected state in CI and not an app error, so it does not count.
    const text = message.text();
    const url = message.location().url ?? '';
    if (text.startsWith('Failed to load resource') && /\/(health|tunings|analyze)(\?|$)/.test(url))
      return;
    errors.push(`console.error: ${text}`);
  });
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  return { errors };
}

/** Screenshots are committed under docs/screenshots/phase-NN/ as the visual record of each phase. */
export function screenshotPath(phase: string, name: string): string {
  return `../docs/screenshots/${phase}/${name}.png`;
}
