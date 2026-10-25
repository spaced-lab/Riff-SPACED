import type { Page } from '@playwright/test';

/**
 * Open a top-level menu and click an item by its id, optionally through one submenu.
 * Submenus open on hover, so the parent item is hovered and the child waited for before
 * the click: on a slow CI runner the hover state is not always there yet when the click
 * lands straight after the parent's own click.
 */
export async function menuClick(
  page: Page,
  menu: string,
  itemId: string,
  subItemId?: string,
): Promise<void> {
  await page.locator(`[data-menu="${menu}"]`).click();
  const item = page.locator(`[data-menu-item="${itemId}"]`);
  await item.click();
  if (subItemId) {
    const sub = page.locator(`[data-menu-item="${subItemId}"]`);
    if (!(await sub.isVisible())) await item.hover();
    await sub.waitFor({ state: 'visible' });
    await sub.click();
  }
}

/** Whether a checkbox-style menu item is checked (opens and closes the menu). */
export async function menuChecked(page: Page, menu: string, itemId: string): Promise<boolean> {
  await page.locator(`[data-menu="${menu}"]`).click();
  const checked =
    (await page.locator(`[data-menu-item="${itemId}"]`).getAttribute('aria-checked')) === 'true';
  await page.keyboard.press('Escape');
  return checked;
}
