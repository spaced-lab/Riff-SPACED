import { expect, test } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';
import { menuClick } from './menu';

/**
 * The import flow against the real backend (P6.T11). Opt in with RIFFSPACED_REAL_BACKEND=1
 * and a backend on port 8000; CI runs the mocked import.spec.ts instead.
 */
test.skip(
  process.env.RIFFSPACED_REAL_BACKEND !== '1',
  'needs the backend on :8000 (RIFFSPACED_REAL_BACKEND=1)',
);

test('the synth walkdown comes back from the real backend and plays beside the original', async ({
  page,
}) => {
  const console = watchConsole(page);
  await page.goto('/');
  await expect(page.getByTestId('status-backend')).toContainText('backend: ok', {
    timeout: 20_000,
  });

  await menuClick(page, 'file', 'file.importAudio');
  await page.getByTestId('import-file-input').setInputFiles('../backend/debug/walkdown.wav');
  await page.getByRole('button', { name: 'import', exact: true }).click();
  await expect(page.locator('[data-import-status="done"]')).toHaveCount(1, { timeout: 60_000 });
  const summary = await page.getByTestId('import-list').textContent();
  await page.getByRole('button', { name: 'report' }).click();
  const report = await page.getByTestId('import-report').textContent();
  await page.screenshot({ path: screenshotPath('phase-06', 'real-import-dialog'), fullPage: true });
  await page.getByRole('button', { name: 'close' }).click();

  await expect(page.getByTestId('riff-name')).toHaveText('walkdown');
  const notes = await page.evaluate(() => window.riffspaced!.store.getState().riff.notes.length);
  expect(notes).toBeGreaterThan(45);
  // Play it, then show the import and the original side by side in split view for the docs.
  await page.getByRole('button', { name: 'play' }).click();
  await page.waitForTimeout(700);
  await expect(page.locator('.fb-note--sounding').first()).toBeVisible();
  await page.keyboard.press('Space');
  await menuClick(page, 'view', 'view.split');
  await page.screenshot({ path: screenshotPath('phase-06', 'real-import-split'), fullPage: true });
  await menuClick(page, 'file', 'file.openLibrary', 'file.open:demo-riff-walkdown');
  await page.screenshot({ path: screenshotPath('phase-06', 'original-split'), fullPage: true });
  await menuClick(page, 'view', 'view.split');
  test.info().annotations.push({
    type: 'import',
    description: `${summary} | ${report?.split('\n').slice(0, 6).join(' ')}`,
  });
  expect(console.errors).toEqual([]);
});
