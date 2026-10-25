import { expect, test } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';

test.describe('fretboard', () => {
  test('shows the demo riff, toggles letters and sharps, and widens the range', async ({
    page,
  }) => {
    const console = watchConsole(page);
    await page.goto('/');
    const board = page.getByTestId('fretboard');
    await expect(board.locator('[data-string-line]')).toHaveCount(6);
    await expect(board.locator('[data-cell][data-string="6"]')).toHaveCount(13);
    await expect(board.locator('[data-note-id]').first()).toBeVisible();
    await page.screenshot({ path: screenshotPath('phase-02', 'app-dots'), fullPage: true });

    await page.getByLabel('Note letters').check();
    await expect(
      board.locator('[data-testid="notes"] text', { hasText: /^Db$/ }).first(),
    ).toBeVisible();
    await expect(
      board.locator('[data-testid="notes"] text', { hasText: /^Ab$/ }).first(),
    ).toBeVisible();
    await page.screenshot({ path: screenshotPath('phase-02', 'app-letters'), fullPage: true });

    await page.getByLabel('Sharps').check();
    await expect(
      board.locator('[data-testid="notes"] text', { hasText: /^C#$/ }).first(),
    ).toBeVisible();
    await expect(board.locator('[data-testid="notes"] text', { hasText: /^Db$/ })).toHaveCount(0);

    await page.getByLabel('fret range').selectOption('0-24');
    await expect(board.locator('[data-cell][data-string="6"]')).toHaveCount(25);

    await page.getByLabel('tuning').selectOption('Drop Ab');
    await expect(page.getByTestId('tuning-status')).toHaveText('Drop Ab: 32 39 44 49 53 58');
    // Keep shapes: the open low string now reads Ab (G# in sharps mode).
    await expect(
      board.locator('[data-note-id][data-string="6"][data-fret="0"] text').first(),
    ).toHaveText('G#');

    // Every note is drawn in Phase 2 (no time filter yet), so dots stack; hover the top one.
    await board.locator('[data-note-id][data-string="6"][data-fret="3"]').last().hover();
    await expect(page.getByRole('tooltip')).toHaveText('string 6 fret 3 = B1');

    expect(console.errors).toEqual([]);
  });

  test('renders the four-board dev harness', async ({ page }) => {
    const console = watchConsole(page);
    await page.goto('/#/dev/fretboard');
    await expect(page.getByTestId('fretboard-harness')).toBeVisible();
    await expect(page.getByTestId('fretboard')).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await page.getByTestId(`harness-board-${i}`).screenshot({
        path: screenshotPath('phase-02', `harness-${i}`),
      });
    }
    await expect(page.getByTestId('harness-board-3').locator('[data-string-line]')).toHaveCount(7);
    expect(console.errors).toEqual([]);
  });
});
