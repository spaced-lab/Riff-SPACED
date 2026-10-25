import { expect, test } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';
import { menuClick } from './menu';

/**
 * Headless Chromium has no File System Access pickers, so this exercises the fallbacks:
 * Export library downloads a blob, Import library goes through a file chooser.
 */
test('export library downloads a valid bundle and import brings items back', async ({ page }) => {
  const console = watchConsole(page);
  await page.goto('/');
  await page.evaluate(() => {
    // Force the fallback paths even if a future headless build grows pickers.
    delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
    delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });

  const downloadPromise = page.waitForEvent('download');
  await menuClick(page, 'file', 'file.exportLibrary');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('library.riffspaced.json');
  const path = await download.path();
  const fs = await import('node:fs/promises');
  const text = await fs.readFile(path!, 'utf8');
  const bundle = JSON.parse(text);
  expect(bundle.format).toBe('riff-spaced/library');
  expect(bundle.riffs.map((r: { name: string }) => r.name)).toEqual([
    'Walkdown Turnaround',
    'Tritone Chug',
  ]);
  await expect(page.getByTestId('toasts')).toContainText('exported library');

  // Save the current riff: falls back to a download named after the riff.
  const riffDownload = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  expect((await riffDownload).suggestedFilename()).toBe('Walkdown-Turnaround.riff.json');
  await expect(page.getByTestId('file-name')).toHaveText('Walkdown-Turnaround.riff.json');

  // Import the bundle back with changed ids so no duplicate dialog appears.
  const modified = {
    ...bundle,
    riffs: bundle.riffs.map((r: { id: string; name: string }) => ({
      ...r,
      id: `${r.id}-import`,
      name: `${r.name} (file)`,
    })),
    arrangements: [],
    songs: [],
  };
  const chooser = page.waitForEvent('filechooser');
  await menuClick(page, 'file', 'file.importLibrary');
  const fileChooser = await chooser;
  await fileChooser.setFiles({
    name: 'back.riffspaced.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(modified)),
  });
  await expect(page.getByTestId('library-riffs')).toContainText('Walkdown Turnaround (file)');
  await expect(page.getByTestId('library-riffs')).toContainText('Tritone Chug (file)');
  await page.screenshot({ path: screenshotPath('phase-05', 'import'), fullPage: true });

  // Recent now lists the saved file and the import.
  await page.locator('[data-menu="file"]').click();
  await page.locator('[data-menu-item="file.recent"]').click();
  await expect(page.locator('[data-menu-item^="file.recent:"]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  expect(console.errors).toEqual([]);
});
