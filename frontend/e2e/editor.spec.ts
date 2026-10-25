import { expect, test } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';

/**
 * The Phase 3 editor flow end to end: new riff, dyad from the fretboard, typed fret,
 * drag, undo/redo, loop length, and autosave surviving a reload.
 */
test('write a riff by hand and have it survive a reload', async ({ page }) => {
  const console = watchConsole(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'new riff' }).click();
  const tab = page.getByTestId('tab-lanes');
  await expect(tab.locator('[data-tab-note]')).toHaveCount(0);
  const board = page.getByTestId('fretboard');

  // A dyad from the fretboard: click string 6 fret 3, shift-click string 5 fret 5.
  await board.locator('[data-cell][data-string="6"][data-fret="3"]').click();
  await board
    .locator('[data-cell][data-string="5"][data-fret="5"]')
    .click({ modifiers: ['Shift'] });
  await expect(tab.locator('[data-tab-note]')).toHaveCount(2);
  await expect(tab.locator('[data-chord-bracket]')).toHaveCount(1);
  await expect(page.getByTestId('dyad-info')).toHaveCount(0);
  await tab.locator('[data-tab-note]').first().click();
  await tab
    .locator('[data-tab-note]')
    .nth(1)
    .click({ modifiers: ['Shift'] });
  await expect(page.getByTestId('dyad-info')).toContainText('P5');
  await expect(page.getByTestId('dyad-info')).toContainText('root Db');
  await page.screenshot({ path: screenshotPath('phase-03', 'dyad'), fullPage: true });

  // Typed entry: move the cursor two sixteenths, type 5 on lane 6, Enter.
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('edit-cursor')).toHaveAttribute('data-tick', '240');
  await page.keyboard.press('5');
  await expect(page.getByTestId('status-pending')).toHaveText('fret: 5_');
  await page.keyboard.press('Enter');
  await expect(tab.locator('[data-tab-note][data-start="240"][data-string="6"]')).toHaveCount(1);

  // Drag that note one bar to the right.
  const pxPerBar = await page.evaluate(() => {
    const cursor = document.querySelector('[data-testid="edit-cursor"]')!;
    return Number(cursor.getAttribute('x1')) / (240 / 1920);
  });
  const note = tab.locator('[data-tab-note][data-start="240"]');
  const box = (await note.boundingBox())!;
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 4 + pxPerBar / 2, box.y + box.height / 2, { steps: 4 });
  await page.mouse.move(box.x + 4 + pxPerBar, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(tab.locator('[data-tab-note][data-start="2160"]')).toHaveCount(1);

  // Undo puts it back, redo moves it again.
  await page.keyboard.press('Control+z');
  await expect(tab.locator('[data-tab-note][data-start="240"]')).toHaveCount(1);
  await page.keyboard.press('Control+Shift+z');
  await expect(tab.locator('[data-tab-note][data-start="2160"]')).toHaveCount(1);

  // Loop length to 8 bars grows the ruler.
  await page.getByLabel('loop').selectOption('8');
  await expect(tab.locator('[data-bar-number="8"]')).toHaveCount(1);
  await page.screenshot({ path: screenshotPath('phase-03', 'editor'), fullPage: true });

  // Autosave: wait past the debounce, reload, and the riff is still there.
  await page.waitForTimeout(800);
  await expect(page.getByTestId('status-saved')).toContainText('saved');
  await page.reload();
  await expect(page.getByTestId('tab-lanes').locator('[data-tab-note]')).toHaveCount(3);
  await expect(page.getByTestId('tab-lanes').locator('[data-bar-number="8"]')).toHaveCount(1);
  await expect(page.getByLabel('riff')).toHaveValue(/.+/);

  expect(console.errors).toEqual([]);
});

test('shortening the loop asks before removing notes', async ({ page }) => {
  const console = watchConsole(page);
  await page.goto('/');
  await page.getByLabel('riff').selectOption({ label: 'Walkdown Turnaround' });
  await page.getByLabel('loop').selectOption('8');
  await page.getByLabel('loop').selectOption('4');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Put a note in bar 6 then try to shrink: the themed dialog appears, never window.confirm.
  await page.getByLabel('loop').selectOption('8');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('3');
  await page.keyboard.press('Enter');
  await page.getByLabel('loop').selectOption('4');
  await expect(page.getByRole('dialog')).toContainText('1 note after bar 4 will be removed.');
  await page.screenshot({ path: screenshotPath('phase-03', 'confirm-dialog'), fullPage: true });
  await page.getByRole('button', { name: 'keep' }).click();
  await expect(page.getByLabel('loop')).toHaveValue('8');
  await page.getByLabel('loop').selectOption('4');
  await page.getByRole('button', { name: 'remove and shorten' }).click();
  await expect(page.getByLabel('loop')).toHaveValue('4');
  expect(console.errors).toEqual([]);
});
