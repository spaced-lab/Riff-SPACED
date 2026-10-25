import { expect, test } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';
import { menuClick } from './menu';

test('play flashes the fretboard, moves the playhead, and stop resets it', async ({ page }) => {
  const console = watchConsole(page);
  await page.goto('/');
  await menuClick(page, 'file', 'file.openLibrary', 'file.open:demo-riff-walkdown');
  const playhead = page.getByTestId('playhead');
  const startX = Number(await playhead.getAttribute('x1'));

  await page.getByRole('button', { name: 'play' }).click();
  await page.waitForTimeout(600);
  await expect(page.getByRole('button', { name: 'stop', exact: true })).toBeVisible();
  const audioState = await page.evaluate(() => window.riffspaced?.audioState());
  expect(audioState).toBe('running');
  await expect(page.locator('.fb-note--sounding').first()).toBeVisible();
  await expect(page.locator('.tab-note--sounding').first()).toBeVisible();
  const movedX = Number(await playhead.getAttribute('x1'));
  expect(movedX).toBeGreaterThan(startX);
  await expect(page.getByTestId('position')).not.toHaveText('01.1.000');
  await page.screenshot({ path: screenshotPath('phase-04', 'playing'), fullPage: true });

  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'play' })).toBeVisible();
  await expect(page.locator('.fb-note--sounding')).toHaveCount(0);
  expect(Number(await playhead.getAttribute('x1'))).toBe(startX);
  await expect(page.getByTestId('position')).toHaveText('01.1.000');

  // Count-in shows in the readout before the loop starts.
  await page.getByLabel('count-in').check();
  await page.getByLabel('metronome').check();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('position')).toHaveText('count-in');
  await page.keyboard.press('Space');

  // Tempo changes during playback do not throw.
  await page.keyboard.press('Space');
  await page.getByRole('spinbutton', { name: 'bpm' }).fill('140');
  await page.waitForTimeout(300);
  await expect(page.getByTestId('status-sync')).toContainText('sync');
  await page.keyboard.press('Space');

  expect(console.errors).toEqual([]);
});
