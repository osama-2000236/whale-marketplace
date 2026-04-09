import { test, expect } from '@playwright/test';
import { loginAs, DEMO_SELLER } from '../helpers/auth.helper';

test.describe('Login Page (/auth/login)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });

  /** Login page renders with correct heading and form fields */
  test('page loads with heading and form', async ({ page }) => {
    // With ar-PS locale the page title and heading are in Arabic
    await expect(page).toHaveTitle(/تسجيل الدخول/);
    const heading = page.locator('h1, h2').first();
    await expect(heading).toContainText(/تسجيل الدخول/);
    // Real form fields: input[name="identifier"] and input[name="password"]
    await expect(page.locator('input[name="identifier"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    // "Forgot Password?" link observed in Brave
    await expect(page.locator('a[href="/auth/forgot-password"]')).toBeVisible();
  });

  /** Empty submission triggers HTML5 validation (stays on page) */
  test('empty form does not submit', async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  /** Wrong password keeps user on login page with flash error */
  test('wrong password shows error', async ({ page }) => {
    await page.fill('input[name="identifier"]', 'admin');
    await page.fill('input[name="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    // Should redirect back to login (flash sets then redirects)
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  /** Non-existent user shows error */
  test('non-existent user shows error', async ({ page }) => {
    await page.fill('input[name="identifier"]', 'nonexistentuser99999');
    await page.fill('input[name="password"]', 'SomePassword123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  /** Valid credentials log in and redirect to /whale */
  test('valid login redirects to app', async ({ page }) => {
    await page.fill('input[name="identifier"]', DEMO_SELLER.identifier);
    await page.fill('input[name="password"]', DEMO_SELLER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
      timeout: 10_000,
    });
    // Should be on /whale or dashboard
    expect(page.url()).not.toContain('/auth/login');
  });

  /** After login, nav shows logged-in state (no Login/Register links) */
  test('nav updates after login', async ({ page }) => {
    await loginAs(page, DEMO_SELLER.identifier, DEMO_SELLER.password);
    // Dashboard link exists in DOM — on mobile it's inside a collapsed hamburger menu
    // so we check attachment (present in DOM) rather than visibility.
    await expect(page.locator('nav a[href="/whale/dashboard"]')).toBeAttached();
    // Login link should NOT be present (logged-in state removes it from DOM)
    await expect(page.locator('nav a[href="/auth/login"]')).toBeHidden();
  });
});
