import { expect, test } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';

test('the app loads with the themed heading and a clean console', async ({ page }) => {
  const console = watchConsole(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('RIFF-SPACED');
  await expect(page.getByText('phase 0: bootstrap')).toBeVisible();

  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe('rgb(0, 0, 0)');

  await page.screenshot({ path: screenshotPath('phase-00', 'smoke'), fullPage: true });
  expect(console.errors).toEqual([]);
});
