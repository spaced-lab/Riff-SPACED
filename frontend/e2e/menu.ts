import type { Page } from '@playwright/test';

/** Open a top-level menu and click an item by its id, optionally through one submenu. */
export async function menuClick(
  page: Page,
  menu: string,
  itemId: string,
  subItemId?: string,
): Promise<void> {
  await page.locator(`[data-menu="${menu}"]`).click();
  await page.locator(`[data-menu-item="${itemId}"]`).click();
  if (subItemId) await page.locator(`[data-menu-item="${subItemId}"]`).click();
}

/** Whether a checkbox-style menu item is checked (opens and closes the menu). */
export async function menuChecked(page: Page, menu: string, itemId: string): Promise<boolean> {
  await page.locator(`[data-menu="${menu}"]`).click();
  const checked =
    (await page.locator(`[data-menu-item="${itemId}"]`).getAttribute('aria-checked')) === 'true';
  await page.keyboard.press('Escape');
  return checked;
}
