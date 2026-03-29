import { expect, test } from '@playwright/test';

test.describe('UI dark mode', () => {
  test('Toggle button exists', async ({ page }) => {
    // Intent: verify the live navbar exposes the theme toggle control used by the production JavaScript.
    await page.goto('/');

    await expect(page.locator('[data-theme-toggle]')).toBeVisible();
  });

  test('Clicking changes theme attribute on html', async ({ page }) => {
    // Intent: verify toggling theme updates the html data-theme attribute that drives the live CSS theme state.
    await page.goto('/');

    const html = page.locator('html');
    const before = await html.getAttribute('data-theme');
    await page.locator('[data-theme-toggle]').click();
    await expect(html).not.toHaveAttribute('data-theme', before ?? 'light');
  });

  test('Theme persists after page reload', async ({ page }) => {
    // Intent: verify the production theme toggle persists through localStorage and survives a full reload.
    await page.goto('/');

    await page.locator('[data-theme-toggle]').click();
    const afterToggle = await page.locator('html').getAttribute('data-theme');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', afterToggle ?? 'dark');
  });

  test('Theme toggle icon changes after switching themes', async ({ page }) => {
    // Intent: verify the live theme control updates its icon state alongside the underlying theme attribute.
    await page.goto('/');

    const icon = page.locator('.theme-toggle-icon');
    const before = await icon.textContent();
    await page.locator('[data-theme-toggle]').click();
    await expect(icon).not.toHaveText(before ?? '');
  });
});
