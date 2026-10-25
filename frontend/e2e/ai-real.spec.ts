import { expect, test } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';
import { menuClick } from './menu';

/**
 * The AI flow against the real backend running the fake client (P7.T7). Opt in with
 * RIFFSPACED_REAL_BACKEND=1 and `RIFFSPACED_AI_FAKE=1 make dev` on port 8000; CI runs the
 * mocked ai.spec.ts instead. With a key and no fake the same spec exercises the live model.
 */
test.skip(
  process.env.RIFFSPACED_REAL_BACKEND !== '1',
  'needs the backend on :8000 (RIFFSPACED_REAL_BACKEND=1)',
);

test('analyze, suggest, audition, accept and undo through the real backend', async ({ page }) => {
  const console = watchConsole(page);
  await page.goto('/');
  await menuClick(page, 'file', 'file.openLibrary', 'file.open:demo-riff-walkdown');
  await expect(page.getByTestId('status-backend')).toContainText('backend: ok', {
    timeout: 20_000,
  });

  await menuClick(page, 'ai', 'ai.analyze');
  const panel = page.getByTestId('analysis-panel');
  await expect(panel).toBeVisible({ timeout: 60_000 });
  await expect(panel.locator('.ai-analysis__dyad')).toHaveCount(23);
  await expect(panel).toContainText('P4 (inv)');
  await expect(panel).toContainText('turnaround yes');
  await expect(page.locator('.tab-dyad-label')).toHaveCount(23);
  await page.screenshot({ path: screenshotPath('phase-07', 'real-analysis'), fullPage: true });

  await menuClick(page, 'ai', 'ai.variations');
  const cards = page.getByTestId('suggestion-card');
  await expect(cards).toHaveCount(2, { timeout: 60_000 });
  await cards.first().getByRole('button', { name: 'audition' }).click();
  await expect(page.getByTestId('status-audition')).toContainText('auditioning:');
  await page.waitForTimeout(700);
  await expect(page.locator('.fb-note--sounding').first()).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase-07', 'real-audition'), fullPage: true });
  await cards.first().getByRole('button', { name: 'stop' }).click();
  await expect(page.getByTestId('status-audition')).toHaveCount(0);

  await cards.first().getByRole('button', { name: 'add as variation' }).click();
  await expect(page.getByTestId('sections-panel').locator('li')).toHaveCount(2);
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('sections-panel').locator('li')).toHaveCount(1);

  await menuClick(page, 'ai', 'ai.tunings');
  await expect(page.locator('[data-kind="tunings"]')).toHaveCount(3, { timeout: 60_000 });
  const names = await page.locator('[data-kind="tunings"] strong').allTextContents();
  expect(names.every((n) => /in .+ Standard|in Drop/.test(n))).toBe(true);
  await page.screenshot({ path: screenshotPath('phase-07', 'real-tunings'), fullPage: true });
  expect(console.errors).toEqual([]);
});
