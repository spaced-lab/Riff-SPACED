import { expect, test } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';
import { menuClick } from './menu';

/** Transpose and retune through the menus (P8.T1): dialogs, one undo step each, flags. */
test('transpose +2, retune keeping pitches, custom retune, and undo each', async ({ page }) => {
  const console = watchConsole(page);
  await page.goto('/');
  await menuClick(page, 'file', 'file.openLibrary', 'file.open:demo-riff-walkdown');
  const firstChug = page.locator('[data-tab-note="wd-n02"] text');
  await expect(firstChug).toHaveText('3');

  // Edit > Transpose: +2 keeps everything playable, so no second question.
  await menuClick(page, 'edit', 'edit.transpose');
  await expect(page.getByRole('dialog')).toContainText('transpose');
  await page.getByLabel('semitones (-12 to 12)').fill('2');
  await page.getByRole('button', { name: 'preview' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Eb2 lands on the open fifth string (the cheapest shape from the open C2 before it).
  await expect(firstChug).toHaveText('0');
  await expect(page.locator('[data-tab-note="wd-n02"]')).toHaveAttribute('data-string', '5');
  await expect(page.getByTestId('tuning-status')).toContainText('Bb Standard');
  await expect(page.locator('.tab-note--unplayable')).toHaveCount(0);
  await page.screenshot({ path: screenshotPath('phase-08', 'transpose'), fullPage: true });
  await page.keyboard.press('Control+z');
  await expect(firstChug).toHaveText('3');

  // Transposing down an octave flags everything and asks first.
  await menuClick(page, 'edit', 'edit.transpose');
  await page.getByLabel('semitones (-12 to 12)').fill('-12');
  await page.getByRole('button', { name: 'preview' }).click();
  await expect(page.getByRole('dialog')).toContainText('56 of 56 notes have no fingering');
  await page.getByRole('button', { name: 'cancel' }).click();
  await expect(firstChug).toHaveText('3');

  // Tuning > Retune mode: keep pitches, then Drop Ab: the low string moves two frets up.
  await menuClick(page, 'tuning', 'tuning.mode');
  await menuClick(page, 'tuning', 'tuning.drop', 'tuning:Drop Ab');
  await expect(page.getByTestId('tuning-status')).toContainText('Drop Ab: 32 39 44 49 53 58');
  await expect(firstChug).toHaveText('5');
  await expect(page.locator('[data-tab-note="wd-n03"] text')).toHaveText('5');
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('tuning-status')).toContainText('Bb Standard');
  await expect(firstChug).toHaveText('3');

  // Custom retune: drop string 6 by two semitones (keep pitches still on).
  await menuClick(page, 'tuning', 'tuning.custom');
  await expect(page.getByRole('dialog')).toContainText('custom retune');
  await page.getByLabel('string 6 (Bb1)').fill('-2');
  await page.getByRole('button', { name: 'retune' }).click();
  await expect(page.getByTestId('tuning-status')).toContainText('Custom: 32 39 44 49 53 58');
  await expect(firstChug).toHaveText('5');
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('tuning-status')).toContainText('Bb Standard');
  expect(console.errors).toEqual([]);
});

test('adding a riff in another tuning to an arrangement offers to retune it', async ({ page }) => {
  const console = watchConsole(page);
  await page.goto('/');
  // Put the tritone chug in Drop Ab (keep shapes), then try to add it to the demo verse.
  await menuClick(page, 'file', 'file.openLibrary', 'file.open:demo-riff-tritone');
  await menuClick(page, 'tuning', 'tuning.drop', 'tuning:Drop Ab');
  await expect(page.getByTestId('tuning-status')).toContainText('Drop Ab');
  await page.getByText('Demo verse').click();
  await page.getByLabel('add riff to arrangement').selectOption({ label: 'Tritone Chug' });
  await expect(page.getByRole('dialog')).toContainText('retune to match the arrangement?');
  await page.getByRole('button', { name: 'retune and add' }).click();
  await expect(page.getByTestId('arrangement-meta')).toContainText('3 entries');
  await page.getByText('Tritone Chug').first().click();
  await expect(page.getByTestId('tuning-status')).toContainText('Bb Standard');
  expect(console.errors).toEqual([]);
});
