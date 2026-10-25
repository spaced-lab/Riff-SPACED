import { expect, test } from '@playwright/test';
import { watchConsole } from './helpers';
import { menuClick } from './menu';

/** File > Export > MusicXML downloads a well-formed tablature score (P8.T3). */
test('MusicXML export downloads a part-wise score with a TAB staff', async ({ page }) => {
  const console = watchConsole(page);
  await page.goto('/');
  await page.evaluate(() => {
    delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });
  await menuClick(page, 'file', 'file.openLibrary', 'file.open:demo-riff-walkdown');
  const downloadPromise = page.waitForEvent('download');
  await menuClick(page, 'file', 'file.export', 'file.export.musicxml');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Walkdown-Turnaround.musicxml');
  const fs = await import('node:fs/promises');
  const xml = await fs.readFile((await download.path())!, 'utf8');
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  expect(xml).toContain('<score-partwise version="4.0">');
  expect(xml).toContain('<sign>TAB</sign>');
  expect((xml.match(/<other-technical>palm mute<\/other-technical>/g) ?? []).length).toBe(55);
  await expect(page.getByTestId('toasts')).toContainText('exported Walkdown-Turnaround.musicxml');
  expect(console.errors).toEqual([]);
});
