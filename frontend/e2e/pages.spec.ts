import { expect, test } from '@playwright/test';
import { screenshotPath, watchConsole } from './helpers';
import { menuClick } from './menu';

/**
 * The deployed GitHub Pages site (P8.T8), opt in with RIFFSPACED_PAGES=1: it loads with
 * ?demo=1, plays, and the letters toggle works. Not part of the CI gate (it needs the
 * network and the deploy to have finished).
 */
test.skip(process.env.RIFFSPACED_PAGES !== '1', 'needs RIFFSPACED_PAGES=1 and the network');

test('the Pages build loads the demo, plays, and toggles letters', async ({ page }) => {
  const console = watchConsole(page);
  await page.goto('https://spaced-lab.github.io/Riff-SPACED/?demo=1');
  await expect(page.getByTestId('riff-name')).toHaveText('Walkdown Turnaround');
  await expect(page.getByTestId('status-backend')).toContainText('backend: unreachable');
  await page.getByRole('button', { name: 'play' }).click();
  await page.waitForTimeout(600);
  await expect(page.locator('.fb-note--sounding').first()).toBeVisible();
  await page.keyboard.press('Space');
  await menuClick(page, 'view', 'view.letters');
  await expect(page.locator('.fb-note text').first()).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase-08', 'pages'), fullPage: true });
  // The public site has no backend: Chrome logs the blocked loopback health poll as a CORS
  // error (Private Network Access). That is the expected state, not an app error.
  expect(console.errors.filter((e) => !e.includes('localhost:8000/health'))).toEqual([]);
});
