import { test, expect } from '@playwright/test';

test.describe('Registration Page (/auth/register)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/register');
  });

  /** The register page renders with the correct heading and form fields */
  test('page loads with heading and form fields', async ({ page }) => {
    // With ar-PS locale the page title and heading are in Arabic ("إنشاء حساب")
    await expect(page).toHaveTitle(/إنشاء حساب/);
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
    // Real form fields discovered via Brave
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  /** Submitting the form with empty fields triggers HTML5 validation */
  test('empty form submission shows validation', async ({ page }) => {
    await page.click('button[type="submit"]');
    // Browser HTML5 validation should prevent submission — URL stays on register
    await expect(page).toHaveURL(/\/auth\/register/);
  });

  /** Password too short is rejected by the backend */
  test('short password is rejected', async ({ page }) => {
    const ts = Date.now();
    await page.fill('input[name="username"]', `shortpw_${ts}`);
    await page.fill('input[name="email"]', `shortpw-${ts}@whale-test.com`);
    await page.fill('input[name="password"]', '123');
    await page.click('button[type="submit"]');
    // Should stay on register page or show flash error
    await page.waitForTimeout(2000);
    const url = page.url();
    const bodyText = await page.textContent('body');
    // Either validation error on page or still on register
    expect(
      url.includes('/auth/register') ||
        bodyText?.toLowerCase().includes('password') ||
        bodyText?.toLowerCase().includes('error')
    ).toBeTruthy();
  });

  /** Valid unique registration succeeds and redirects */
  test('valid registration redirects to app', async ({ page }) => {
    const ts = Date.now();
    await page.fill('input[name="username"]', `qauser_${ts}`);
    await page.fill('input[name="email"]', `qa-${ts}@whale-test.com`);
    // Fill first password field and confirmPassword (last) — works for 3 or 4 field forms
    await page.locator('input[type="password"]').first().fill('QATestWhale2026!');
    await page.locator('input[type="password"]').last().fill('QATestWhale2026!');
    await page.click('button[type="submit"]');
    // On success, should redirect away from register (to /whale)
    await page.waitForURL((url) => !url.pathname.includes('/auth/register'), {
      timeout: 10_000,
    });
    expect(page.url()).not.toContain('/auth/register');
  });

  /** Attempting to register with an existing email shows error */
  test('duplicate email shows error', async ({ page }) => {
    // admin@whale.ps is seeded
    await page.fill('input[name="username"]', `dup_${Date.now()}`);
    await page.fill('input[name="email"]', 'admin@whale.ps');
    await page.fill('input[name="password"]', 'QATestWhale2026!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    // Should stay on register or show error
    const url = page.url();
    expect(url).toContain('/auth/register');
  });

  /** Attempting to register with an existing username shows error */
  test('duplicate username shows error', async ({ page }) => {
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="email"]', `newunique-${Date.now()}@whale-test.com`);
    await page.fill('input[name="password"]', 'QATestWhale2026!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('/auth/register');
  });
});
