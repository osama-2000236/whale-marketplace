// @ts-check
'use strict';

/**
 * Shared auth helpers for E2E tests.
 * Selectors verified against live /auth/register and /auth/login source.
 */

/**
 * Register a new user via the /auth/register form.
 * NOTE: The form has NO confirmPassword field — only username, email, password.
 * @param {import('@playwright/test').Page} page
 * @param {{ username: string; email: string; password: string }} user
 */
async function registerUser(page, user) {
  await page.goto('/auth/register');
  await page.waitForSelector('input[name="username"]');
  await page.fill('input[name="username"]', user.username);
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  // Wait for redirect away from /auth/register
  await page.waitForURL((url) => !url.pathname.includes('/auth/register'), {
    timeout: 15_000,
  });
}

/**
 * Log in via the /auth/login form.
 * The identifier field accepts email or username.
 * @param {import('@playwright/test').Page} page
 * @param {{ email?: string; identifier?: string; username?: string; password: string }} user
 */
async function loginUser(page, user) {
  await page.goto('/auth/login');
  await page.waitForSelector('input[name="identifier"]');
  const id = user.email || user.identifier || user.username || '';
  await page.fill('input[name="identifier"]', id);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
    timeout: 15_000,
  });
}

/**
 * Log out by submitting the logout form that lives in the user-menu dropdown.
 * @param {import('@playwright/test').Page} page
 */
async function logoutUser(page) {
  const logoutForm = page.locator('form[action="/auth/logout"]');
  if ((await logoutForm.count()) > 0) {
    await logoutForm.locator('button[type="submit"]').click();
    await page.waitForURL('/', { timeout: 10_000 });
  }
}

module.exports = { registerUser, loginUser, logoutUser };
