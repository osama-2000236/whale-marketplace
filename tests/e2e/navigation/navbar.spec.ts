import { expect, test } from '@playwright/test';
import { createRegisteredUser, loginAs } from '../helpers/auth.helper';

test.describe('Navigation navbar', () => {
  test('Logo links to /', async ({ page }) => {
    // Intent: verify the navbar brand uses the correct live home route.
    await page.goto('/');

    await expect(page.locator('.navbar-brand')).toHaveAttribute('href', '/');
  });

  test('Browse link goes to /whale', async ({ page }) => {
    // Intent: verify the primary browse navigation link targets the live browse route.
    await page.goto('/');

    if (await page.locator('.navbar-toggle').isVisible()) {
      await page.locator('.navbar-toggle').click();
    }

    await expect(page.locator('.navbar-nav a[href="/whale"]')).toBeVisible();
  });

  test('Login and Register visible when logged out', async ({ page }) => {
    // Intent: verify the public navbar state exposes the live login and register entry points.
    await page.goto('/');

    await expect(page.locator('.navbar-actions a[href="/auth/login"]')).toBeVisible();
    await expect(page.locator('.navbar-actions a[href="/auth/register"]')).toBeVisible();
  });

  test('Hamburger appears at 375px viewport', async ({ page }) => {
    // Intent: verify the responsive navbar renders the real mobile toggle control at the mobile breakpoint.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    await expect(page.locator('.navbar-toggle')).toBeVisible();
  });

  test('Hamburger opens nav links', async ({ page }) => {
    // Intent: verify the mobile toggle adds the open state used by the live navbar JavaScript.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('.navbar-toggle').click();

    await expect(page.locator('.navbar-nav')).toHaveClass(/open/);
    await expect(page.locator('.navbar-nav a[href="/whale"]')).toBeVisible();
  });

  test('After login, nav shows logged-in state', async ({ browser, page }) => {
    // Intent: verify the authenticated navbar swaps public actions for the user menu after a successful live login.
    const user = await createRegisteredUser(browser);

    await loginAs(page, user.email, user.password);

    await expect(page.locator('.user-menu-trigger')).toBeVisible();
    await expect(page.locator('.navbar-actions a[href="/auth/login"]')).toHaveCount(0);
    await expect(page.locator('.navbar-actions a[href="/auth/register"]')).toHaveCount(0);
  });
});
