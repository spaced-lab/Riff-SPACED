import { expect, test } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';
import { menuClick } from './menu';

/** P8.T5: the CRT toggle, preference persistence, the demo reset parameter, keyboard focus. */
test('CRT toggles a body class, survives a reload, and ?demo=1 resets the library', async ({
  page,
}) => {
  const console = watchConsole(page);
  await page.goto('/');
  await expect(page.locator('body')).not.toHaveClass(/crt/);
  await menuClick(page, 'view', 'view.crt');
  await expect(page.locator('body')).toHaveClass(/crt/);
  await page.screenshot({ path: screenshotPath('phase-08', 'crt'), fullPage: true });
  // Preferences persist; the riff edit persists too, until the demo reset clears both.
  await page.getByLabel('riff name').fill('Renamed by the test');
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator('body')).toHaveClass(/crt/);
  await expect(page.getByTestId('riff-name')).toHaveText('Renamed by the test');
  await page.goto('/?demo=1');
  await expect(page.getByTestId('riff-name')).toHaveText('Walkdown Turnaround');
  await expect(page.locator('body')).not.toHaveClass(/crt/);
  expect(new URL(page.url()).search).toBe('');
  await page.reload();
  await expect(page.getByTestId('riff-name')).toHaveText('Walkdown Turnaround');
  expect(console.errors).toEqual([]);
});

test('interactive controls are focusable and the theme draws a green focus ring', async ({
  page,
}) => {
  // Tab itself is the note-letters shortcut (SPEC 5.8), so keyboard traversal is checked by
  // focusing controls directly and by the stylesheet rule that draws the ring.
  const console = watchConsole(page);
  await page.goto('/');
  const controls = [
    page.getByRole('menuitem', { name: 'File' }),
    page.getByRole('menuitem', { name: 'View' }),
    page.getByRole('button', { name: 'play', exact: true }),
    page.getByRole('button', { name: 'loop', exact: true }),
    page.getByLabel('search library'),
  ];
  for (const el of controls) {
    await el.focus();
    await expect(el).toBeFocused();
  }
  const ring = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSStyleRule && rule.selectorText === ':focus-visible')
          return rule.style.outline;
      }
    }
    return null;
  });
  expect(ring).toContain('2px solid');
  expect(console.errors).toEqual([]);
});

test.describe('visual regression', () => {
  // Font rendering differs by platform; baselines are made on the owner's machine.
  test.skip(Boolean(process.env.CI), 'visual baselines are kept for the local platform only');

  test('main screen with and without CRT', async ({ page }) => {
    await page.goto('/?demo=1');
    await expect(page.getByTestId('riff-name')).toHaveText('Walkdown Turnaround');
    await expect(page).toHaveScreenshot('main.png', { maxDiffPixelRatio: 0.02, fullPage: true });
    await menuClick(page, 'view', 'view.crt');
    await expect(page.locator('body')).toHaveClass(/crt/);
    await expect(page).toHaveScreenshot('main-crt.png', {
      maxDiffPixelRatio: 0.02,
      fullPage: true,
    });
  });
});
