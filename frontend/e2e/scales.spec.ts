import { expect, test } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';
import { menuClick } from './menu';

/**
 * Scale mode (Phase 9): the overlay appears with the legend, colors follow the degree
 * groups, the root menu moves the scale, the swatches toggle colors, mono flattens them,
 * and the preference survives a reload.
 */
test('scale overlay: color, blues scale, root shift, toggles, mono, persistence', async ({
  page,
}) => {
  const console = watchConsole(page);
  await page.goto('/?demo=1');
  const board = page.getByTestId('fretboard');
  await expect(board.locator('[data-string-line]')).toHaveCount(6);
  await expect(page.getByTestId('scale-legend')).toHaveCount(0);

  // Full color on the default scale: Bb minor pentatonic follows the Bb Standard low string.
  await menuClick(page, 'scales', 'scales.mode:color');
  await expect(page.getByTestId('scale-title')).toHaveText('Bb Minor Pentatonic');
  const open6 = board.locator('[data-scale-dot][data-string="6"][data-fret="0"]');
  await expect(open6).toHaveAttribute('data-degree', 'R');
  await expect(open6).toHaveClass(/fb-scale--root/);
  await expect(board.locator('[data-scale-dot][data-degree="b5"]')).toHaveCount(0);
  await page.screenshot({ path: screenshotPath('phase-09', 'minor-pentatonic'), fullPage: true });

  // Blues adds the blue note, drawn in its own class.
  await menuClick(page, 'scales', 'scales.scale', 'scales.scale:blues');
  await expect(page.getByTestId('scale-title')).toHaveText('Bb Blues');
  const blue = board.locator('[data-scale-dot][data-string="6"][data-fret="6"]');
  await expect(blue).toHaveAttribute('data-degree', 'b5');
  await expect(blue).toHaveClass(/fb-scale--blue/);
  await expect(board.locator('[data-scale-dot][data-string="6"][data-fret="7"]')).toHaveClass(
    /fb-scale--fifth/,
  );
  await expect(board.locator('[data-scale-dot][data-string="6"][data-fret="10"]')).toHaveClass(
    /fb-scale--seventh-flat/,
  );
  await page.screenshot({ path: screenshotPath('phase-09', 'blues'), fullPage: true });

  // Shift the root to Eb: the root now sits at fret 5 on string 6.
  await menuClick(page, 'scales', 'scales.root', 'scales.root:3');
  await expect(page.getByTestId('scale-title')).toHaveText('Eb Blues');
  await expect(board.locator('[data-scale-dot][data-string="6"][data-fret="5"]')).toHaveAttribute(
    'data-degree',
    'R',
  );
  await expect(open6).toHaveAttribute('data-degree', '5');

  // Legend swatch switches the roots group off: still there, plain.
  await page.locator('[data-legend-degree="R"]').click();
  await expect(board.locator('[data-scale-dot][data-string="6"][data-fret="5"]')).toHaveClass(
    /fb-scale--plain/,
  );
  await expect(page.locator('[data-legend-degree="R"]')).toHaveAttribute('aria-pressed', 'false');
  await page.screenshot({ path: screenshotPath('phase-09', 'roots-off'), fullPage: true });
  await menuClick(page, 'scales', 'scales.color:roots');
  await expect(board.locator('[data-scale-dot][data-string="6"][data-fret="5"]')).toHaveClass(
    /fb-scale--root/,
  );

  // Mono: everything plain, legend swatches disabled.
  await page.locator('[data-scale-mode="mono"]').click();
  await expect(board.locator('[data-scale-dot]:not(.fb-scale--plain)')).toHaveCount(0);
  await expect(page.locator('[data-legend-degree="R"]')).toBeDisabled();
  await page.screenshot({ path: screenshotPath('phase-09', 'mono'), fullPage: true });

  // Harmonic minor in color, then reload: the preference comes back.
  await menuClick(page, 'scales', 'scales.mode:color');
  await menuClick(page, 'scales', 'scales.scale', 'scales.scale:harmonicMinor');
  await expect(page.getByTestId('scale-title')).toHaveText('Eb Harmonic Minor');
  await expect(board.locator('[data-scale-dot].fb-scale--sixth-flat').first()).toBeVisible();
  await expect(board.locator('[data-scale-dot].fb-scale--seventh').first()).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase-09', 'harmonic-minor'), fullPage: true });
  await page.reload();
  await expect(page.getByTestId('scale-title')).toHaveText('Eb Harmonic Minor');

  // CAGED positions (P9.T5): step up from the whole neck, dots outside the box dim.
  await expect(page.getByTestId('scale-position-name')).toHaveText('whole neck');
  await page.getByLabel('position up').click();
  await expect(page.getByTestId('scale-position-name')).toContainText('shape, frets 0-');
  await expect(board.locator('[data-scale-dot][data-in-position="false"]').first()).toHaveClass(
    /fb-scale--dimmed/,
  );
  await expect(board.locator('[data-scale-dot][data-in-position="true"]').first()).toBeVisible();
  // Keyboard: > moves up the neck; the menu lists the same positions.
  await page.keyboard.press('Shift+Period');
  await expect(page.getByTestId('scale-position-name')).toContainText('(2/');
  await menuClick(page, 'scales', 'scales.position', 'scales.position:3');
  await expect(page.getByTestId('scale-position-name')).toContainText('(4/');
  await page.screenshot({ path: screenshotPath('phase-09', 'position-caged'), fullPage: true });
  // A high position slides the 0-12 window up the neck, never past fret 24.
  await menuClick(page, 'scales', 'scales.position', 'scales.position:8');
  await expect(page.getByTestId('scale-position-name')).toContainText('(9/');
  const fretNumbers = async () =>
    (await board.locator('.fb-fret-number').allTextContents()).map(Number).filter((n) => !isNaN(n));
  const numbers = await fretNumbers();
  expect(Math.max(...numbers)).toBeGreaterThan(12);
  expect(Math.max(...numbers)).toBeLessThanOrEqual(24);
  expect(Math.max(...numbers) - Math.min(...numbers)).toBeLessThanOrEqual(12);
  await expect(board.locator('[data-scale-dot][data-in-position="true"]').first()).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase-09', 'position-high'), fullPage: true });

  // Full-screen fretboard: panels, transport and tab lanes go away; the neck grows.
  const heightBefore = (await board.boundingBox())!.height;
  await menuClick(page, 'view', 'view.fullscreen');
  await expect(page.getByTestId('shell')).toHaveAttribute('data-fullscreen', 'true');
  await expect(page.getByLabel('tab lanes')).toHaveCount(0);
  await expect(page.getByLabel('transport')).toHaveCount(0);
  await expect(page.locator('.shell__library')).toHaveCount(0);
  expect((await board.boundingBox())!.height).toBeGreaterThan(heightBefore * 1.8);
  await menuClick(page, 'view', 'view.letters');
  await expect(board.locator('[data-scale-dot] text').first()).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase-09', 'fullscreen'), fullPage: true });
  await page.getByTestId('scale-fullscreen').click();
  await expect(page.getByTestId('shell')).toHaveAttribute('data-fullscreen', 'false');
  await expect(page.getByLabel('tab lanes')).toBeVisible();
  await menuClick(page, 'view', 'view.letters');

  await page.getByTestId('scale-position-name').click();
  await expect(page.getByTestId('scale-position-name')).toHaveText('whole neck');
  await expect(board.locator('[data-scale-dot][data-in-position="false"]')).toHaveCount(0);

  // Split view carries the overlay to every quadrant.
  await menuClick(page, 'view', 'view.split');
  await expect(page.getByTestId('scale-dots')).toHaveCount(4);
  await menuClick(page, 'view', 'view.split');

  // Off removes the legend and the dots.
  await menuClick(page, 'scales', 'scales.mode:off');
  await expect(page.getByTestId('scale-legend')).toHaveCount(0);
  await expect(board.locator('[data-scale-dot]')).toHaveCount(0);
  expect(console.errors).toEqual([]);
});
