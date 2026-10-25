import { expect, test } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';
import { menuClick } from './menu';

test('split view shows four quadrants with exactly one active during playback', async ({
  page,
}) => {
  const console = watchConsole(page);
  await page.goto('/');
  await menuClick(page, 'file', 'file.openLibrary', 'file.open:demo-riff-walkdown');
  // Make a 16-bar riff from the demo: 4 bars per quadrant.
  await page.getByLabel('loop length').selectOption('16');
  await menuClick(page, 'view', 'view.split');
  await expect(page.getByTestId('split-view')).toBeVisible();
  await expect(page.getByTestId('fretboard')).toHaveCount(4);
  await expect(page.getByTestId('quadrant-0')).toContainText('bars 1-4');
  await expect(page.getByTestId('quadrant-3')).toContainText('bars 13-16');
  await expect(page.locator('[data-active="true"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'play' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('[data-active="true"]')).toHaveCount(1);
  await expect(page.getByTestId('quadrant-0')).toHaveAttribute('data-active', 'true');
  await page.screenshot({ path: screenshotPath('phase-04', 'split-view'), fullPage: true });
  await page.keyboard.press('Space');
  await expect(page.locator('[data-active="true"]')).toHaveCount(0);
  await menuClick(page, 'view', 'view.split');
  await expect(page.getByTestId('fretboard')).toHaveCount(1);
  expect(console.errors).toEqual([]);
});
