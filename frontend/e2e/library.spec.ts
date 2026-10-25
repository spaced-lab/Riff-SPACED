import { expect, test } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';
import { menuClick } from './menu';

/**
 * The Phase 5 library story: make a riff, name and tag it, find it, sequence it into an
 * arrangement, play the arrangement, export the library, and import it into a fresh
 * browser profile where everything comes back identical.
 */
test('create, tag, search, arrange, play, export, and re-import a library', async ({
  page,
  browser,
}) => {
  const console = watchConsole(page);
  await page.goto('/');
  await page.evaluate(() => {
    delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
    delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });

  // New riff, two notes, a name and a tag.
  await menuClick(page, 'file', 'file.newRiff');
  await page
    .getByTestId('fretboard')
    .locator('[data-cell][data-string="6"][data-fret="1"]')
    .click();
  await page
    .getByTestId('fretboard')
    .locator('[data-cell][data-string="5"][data-fret="2"]')
    .click({ modifiers: ['Shift'] });
  await page.getByLabel('riff name').fill('Tritone Stab');
  await page.getByLabel('add tag').fill('stab');
  await page.getByLabel('add tag').press('Enter');
  await expect(page.getByTestId('riff-panel').locator('[data-tag="stab"]')).toBeVisible();
  await expect(page.getByTestId('library-riffs')).toContainText('Tritone Stab');

  // Search by the tag and by part of the name.
  await page.getByLabel('search library').fill('stab');
  await expect(page.getByTestId('library-riffs')).toContainText('Tritone Stab');
  await expect(page.getByTestId('library-riffs')).not.toContainText('Walkdown Turnaround');
  await page.getByLabel('search library').fill('');

  // An arrangement with two entries, then play it.
  await menuClick(page, 'file', 'file.newArrangement');
  await page.getByLabel('arrangement name').fill('Stab build');
  await page.getByLabel('add riff to arrangement').selectOption({ label: 'Tritone Stab' });
  await page.getByLabel('add riff to arrangement').selectOption({ label: 'Walkdown Turnaround' });
  await expect(page.getByTestId('arrangement-meta')).toContainText('2 entries · 8 bars');
  await expect(page.getByTestId('tab-svg')).toHaveAttribute('data-read-only', 'true');
  await page.getByRole('button', { name: 'play' }).click();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('position')).not.toHaveText('01.1.000');
  await page.screenshot({ path: screenshotPath('phase-05', 'arrangement'), fullPage: true });
  await page.keyboard.press('Space');

  // Export the whole library.
  const downloadPromise = page.waitForEvent('download');
  await menuClick(page, 'file', 'file.exportLibrary');
  const download = await downloadPromise;
  const fs = await import('node:fs/promises');
  const text = await fs.readFile((await download.path())!, 'utf8');
  const bundle = JSON.parse(text);
  expect(bundle.riffs.map((r: { name: string }) => r.name)).toEqual([
    'Walkdown Turnaround',
    'Tritone Chug',
    'Tritone Stab',
  ]);
  expect(bundle.arrangements.map((a: { name: string }) => a.name)).toEqual([
    'Demo verse',
    'Stab build',
  ]);

  // A fresh profile starts with the demo library; importing the bundle replaces by id and adds the rest.
  const fresh = await browser.newContext();
  const page2 = await fresh.newPage();
  const console2 = watchConsole(page2);
  await page2.goto('/');
  await page2.evaluate(() => {
    delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  await expect(page2.getByTestId('library-riffs')).not.toContainText('Tritone Stab');
  const chooser = page2.waitForEvent('filechooser');
  await menuClick(page2, 'file', 'file.importLibrary');
  await (
    await chooser
  ).setFiles({
    name: 'library.riffspaced.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  await expect(page2.getByRole('dialog')).toContainText('already in the library');
  await page2.getByRole('button', { name: 'replace' }).click();
  const names = await page2.evaluate(() =>
    window.riffspaced!.store.getState().library.riffs.map((r) => r.name),
  );
  expect(names).toEqual(['Walkdown Turnaround', 'Tritone Chug', 'Tritone Stab']);
  const imported = await page2.evaluate(() => window.riffspaced!.store.getState().library);
  expect(imported.riffs[2]!.notes).toHaveLength(2);
  expect(imported.riffs[2]!.tags).toEqual(['stab']);
  expect(imported.arrangements[1]!.entries.map((e: { riffId: string }) => e.riffId)).toEqual(
    bundle.arrangements[1].entries.map((e: { riffId: string }) => e.riffId),
  );
  await page2.screenshot({ path: screenshotPath('phase-05', 'library'), fullPage: true });
  expect(console2.errors).toEqual([]);
  await fresh.close();

  // Help > Keyboard shortcuts renders the table.
  await menuClick(page, 'help', 'help.shortcuts');
  await expect(page.getByRole('dialog')).toContainText('play / stop');
  await page.keyboard.press('Escape');
  expect(console.errors).toEqual([]);
});
