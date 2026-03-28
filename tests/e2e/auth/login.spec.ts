import { expect, test } from '@playwright/test';
import {
  createRegisteredUser,
  loginAs,
  openUserMenu,
  validationMessage,
} from '../helpers/auth.helper';

test.describe('Auth login', () => {
  test('Page loads with email and password fields', async ({ page }) => {
    // Intent: verify the live login form exposes the shared identifier field and password field expected by the deployed app.
    await page.goto('/auth/login');

    await expect(page.locator('input[name="identifier"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('Empty submission shows validation errors', async ({ page }) => {
    // Intent: verify the browser-native required validation blocks empty login submits on the production form.
    await page.goto('/auth/login');
    await page.locator('form[action="/auth/login"] button').click();

    await expect.poll(() => validationMessage(page, 'input[name="identifier"]')).not.toBe('');
    await expect.poll(() => validationMessage(page, 'input[name="password"]')).not.toBe('');
  });

  test('Wrong password shows error', async ({ browser, page }) => {
    // Intent: verify a real user cannot authenticate with an incorrect password and receives a visible error state.
    const user = await createRegisteredUser(browser);

    await page.goto('/auth/login');
    await page.locator('input[name="identifier"]').fill(user.email);
    await page.locator('input[name="password"]').fill(`${user.password}-wrong`);

    await Promise.all([
      page.waitForURL(/\/auth\/login$/),
      page.locator('form[action="/auth/login"] button').click(),
    ]);

    await expect(page.locator('.flash.flash-danger')).toBeVisible();
  });

  test('Non-existent email shows error', async ({ page }) => {
    // Intent: verify the backend rejects unknown identifiers cleanly instead of crashing or redirecting incorrectly.
    await page.goto('/auth/login');
    await page.locator('input[name="identifier"]').fill(`missing-${Date.now()}@whale-test.com`);
    await page.locator('input[name="password"]').fill('QATestWhale2026!');

    await Promise.all([
      page.waitForURL(/\/auth\/login$/),
      page.locator('form[action="/auth/login"] button').click(),
    ]);

    await expect(page.locator('.flash.flash-danger')).toBeVisible();
  });

  test('Valid credentials log in and redirect', async ({ browser, page }) => {
    // Intent: verify a production account created through the live UI can authenticate on a fresh session and reach the target route.
    const user = await createRegisteredUser(browser);

    await loginAs(page, user.email, user.password);

    await expect(page).toHaveURL(/\/whale(?:\?.*)?$/);
    await expect(page.locator('.user-menu-trigger')).toBeVisible();
  });

  test('Nav reflects logged-in state after login', async ({ browser, page }) => {
    // Intent: verify the public login/register navbar actions disappear and the authenticated user menu appears after login.
    const user = await createRegisteredUser(browser);

    await loginAs(page, user.email, user.password);
    await openUserMenu(page);

    await expect(page.locator('.user-menu-dropdown a[href="/profile"]')).toBeVisible();
    await expect(page.locator('.navbar-actions a[href="/auth/login"]')).toHaveCount(0);
    await expect(page.locator('.navbar-actions a[href="/auth/register"]')).toHaveCount(0);
  });
});
