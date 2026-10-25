import { expect, test } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';

test('the app loads with the themed heading and a clean console', async ({ page }) => {
  const console = watchConsole(page);
  await page.goto('/');

  await expect(page.getByTestId('shell')).toBeVisible();
  await expect(page.getByText('RIFF-SPACED', { exact: true })).toBeVisible();
  await expect(page.getByTestId('status-bar')).toContainText('Bb Standard');

  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe('rgb(0, 0, 0)');

  await page.screenshot({ path: screenshotPath('phase-00', 'smoke'), fullPage: true });
  expect(console.errors).toEqual([]);
});
