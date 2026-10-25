import { expect, test } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';
import { menuClick } from './menu';

/** Tuning > Find easier tuning (P8.T2): scored rows, preview on the fretboard, apply, undo. */
test('finds Drop Ab easier for the walkdown, previews it, applies it as one undo step', async ({
  page,
}) => {
  const console = watchConsole(page);
  await page.goto('/');
  await menuClick(page, 'file', 'file.openLibrary', 'file.open:demo-riff-walkdown');
  await menuClick(page, 'tuning', 'tuning.easier');
  const dialog = page.getByTestId('easier-tuning-dialog');
  await expect(dialog).toBeVisible();
  const rows = page.getByTestId('easier-row');
  // The five best plus the current tuning for reference.
  await expect(rows).toHaveCount(6);
  await expect(page.locator('[data-testid="easier-row"][data-current="true"]')).toHaveCount(1);
  const dropAb = rows.filter({ hasText: 'Drop Ab' }).first();
  await expect(dropAb).toContainText('32 39 44 49 53 58');
  await dropAb.getByRole('button', { name: 'preview' }).click();
  await expect(page.getByTestId('status-preview')).toHaveText('previewing: Drop Ab');
  await expect(page.getByTestId('tuning-status')).toContainText('Bb Standard');
  await page.screenshot({ path: screenshotPath('phase-08', 'easier-tuning'), fullPage: true });
  await dropAb.getByRole('button', { name: 'apply' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('status-preview')).toHaveCount(0);
  await expect(page.getByTestId('tuning-status')).toContainText('Drop Ab: 32 39 44 49 53 58');
  await expect(page.locator('[data-tab-note="wd-n02"] text')).toHaveText('5');
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('tuning-status')).toContainText('Bb Standard');
  expect(console.errors).toEqual([]);
});
