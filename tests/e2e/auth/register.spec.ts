import { expect, test } from '@playwright/test';
import {
  buildTestUser,
  createRegisteredUser,
  registerTestUser,
  validationMessage,
} from '../helpers/auth.helper';

test.describe('Auth register', () => {
  test('Page loads with correct heading', async ({ page }) => {
    // Intent: verify the deployed register page exposes the expected public form and heading.
    await page.goto('/auth/register');

    await expect(page.locator('h1')).toHaveText(/(إنشاء حساب|Create Account)/);
    await expect(page.locator('form[action="/auth/register"]')).toBeVisible();
  });

  test('Google sign-in button is visible on register when Google OAuth is configured', async ({ page }) => {
    // Intent: verify the registration page exposes the Google CTA with the local icon asset under the local Playwright server config.
    await page.goto('/auth/register?next=/whale/sell');

    const googleButton = page.locator('a[href="/auth/google?next=%2Fwhale%2Fsell"]').first();
    await expect(googleButton).toBeVisible();
    await expect(googleButton.locator('img[src="/icons/google.svg"]')).toBeVisible();
  });

  test('Empty form shows validation errors', async ({ page }) => {
    // Intent: verify native required validation is wired to the real live inputs before any submit reaches the server.
    await page.goto('/auth/register');
    await page.locator('form[action="/auth/register"] button').click();

    await expect.poll(() => validationMessage(page, 'input[name="username"]')).not.toBe('');
    await expect.poll(() => validationMessage(page, 'input[name="email"]')).not.toBe('');
    await expect.poll(() => validationMessage(page, 'input[name="password"]')).not.toBe('');
  });

  test('Mismatched passwords shows error', async ({ page }) => {
    // Intent: verify the register form rejects mismatched passwords with a visible flash error.
    const user = buildTestUser('mismatch');

    await page.goto('/auth/register');
    await page.locator('input[name="username"]').fill(user.username);
    await page.locator('input[name="email"]').fill(user.email);
    await page.locator('input[name="password"]').fill(user.password);
    await page.locator('input[name="confirmPassword"]').fill('DifferentPass2026!');

    await page.locator('form[action="/auth/register"] button').click();

    await expect(page).toHaveURL(/\/auth\/register(?:\?.*)?$/);
    await expect(page.locator('.flash.flash-danger')).toContainText(/Passwords do not match/);
  });

  test('Short password is rejected', async ({ page }) => {
    // Intent: verify the live register form enforces its password minlength constraint before submit.
    await page.goto('/auth/register');
    await page.locator('input[name="username"]').fill(buildTestUser().username);
    await page.locator('input[name="email"]').fill(buildTestUser().email);
    await page.locator('input[name="password"]').fill('short');
    await page.locator('input[name="confirmPassword"]').fill('short');
    await page.locator('form[action="/auth/register"] button').click();

    await expect.poll(() => validationMessage(page, 'input[name="password"]')).not.toBe('');
  });

  test('Valid registration redirects away from /auth/register', async ({ page }) => {
    // Intent: verify the live registration flow creates an account, logs the user in, and lands outside the register route.
    await registerTestUser(page);

    await expect(page).toHaveURL(/\/whale(?:\?.*)?$/);
    await expect(page.locator('.user-menu-trigger')).toBeVisible();
  });

  test('Duplicate email shows error', async ({ browser }) => {
    // Intent: verify duplicate account creation is rejected by the production backend with a visible flash error.
    const existing = buildTestUser();
    await createRegisteredUser(browser, existing);

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto('/auth/register');
      await page.locator('input[name="username"]').fill(buildTestUser('dup').username);
      await page.locator('input[name="email"]').fill(existing.email);
      await page.locator('input[name="password"]').fill(existing.password);
      await page.locator('input[name="confirmPassword"]').fill(existing.password);

      await page.locator('form[action="/auth/register"] button').click();

      await expect(page).toHaveURL(/\/auth\/register(?:\?.*)?$/);
      await expect(page.locator('.flash.flash-danger')).toContainText(
        'That email is already registered.',
      );
    } finally {
      await context.close();
    }
  });
});
