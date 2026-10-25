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

/** File > Export > WAV renders offline through the engine and downloads a real WAV (P8.T4). */
test('WAV export renders the heavy voice offline and downloads a 16-bit file', async ({ page }) => {
  const console = watchConsole(page);
  await page.goto('/');
  await page.evaluate(() => {
    delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });
  await menuClick(page, 'file', 'file.openLibrary', 'file.open:demo-riff-walkdown');
  await menuClick(page, 'file', 'file.export', 'file.export.wav');
  await expect(page.getByRole('dialog')).toContainText('export WAV');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('voice').selectOption('heavy');
  await dialog.getByLabel('loop passes (1 to 8)').fill('1');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'render' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Walkdown-Turnaround.wav');
  const fs = await import('node:fs/promises');
  const bytes = await fs.readFile((await download.path())!);
  expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(bytes.subarray(8, 12).toString('ascii')).toBe('WAVE');
  expect(bytes.readUInt16LE(34)).toBe(16);
  expect(bytes.readUInt32LE(24)).toBe(44100);
  // Four bars at 92 BPM is about 10.4 s plus the tail: over 900 kB of 16-bit mono.
  expect(bytes.length).toBeGreaterThan(900_000);
  await expect(page.getByTestId('toasts')).toContainText('exported Walkdown-Turnaround.wav');
  expect(console.errors).toEqual([]);
});
