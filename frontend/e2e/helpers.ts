import type { Page } from '@playwright/test';

/**
 * Collects console errors and uncaught page errors so a test can assert the
 * console stayed clean (SPEC 11: any console.error fails a UI task).
 * Call it before `page.goto` so nothing is missed.
 */
export function watchConsole(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console.error: ${message.text()}`);
    }
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
