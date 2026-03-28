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

    await expect(page.locator('h1')).toHaveText('إنشاء حساب');
    await expect(page.locator('form[action="/auth/register"]')).toBeVisible();
  });

  test('Empty form shows validation errors', async ({ page }) => {
    // Intent: verify native required validation is wired to the real live inputs before any submit reaches the server.
    await page.goto('/auth/register');
    await page.locator('form[action="/auth/register"] button').click();

    await expect.poll(() => validationMessage(page, 'input[name="username"]')).not.toBe('');
    await expect.poll(() => validationMessage(page, 'input[name="email"]')).not.toBe('');
    await expect.poll(() => validationMessage(page, 'input[name="password"]')).not.toBe('');
  });

  test('Mismatched passwords shows error', async () => {
    // Intent: record that this scenario is not applicable to the deployed app because the live register form has no confirm-password field.
    test.skip(true, 'The production register form exposes username, email, and password only.');
  });

  test('Short password is rejected', async ({ page }) => {
    // Intent: verify the live register form enforces its password minlength constraint before submit.
    await page.goto('/auth/register');
    await page.locator('input[name="username"]').fill(buildTestUser().username);
    await page.locator('input[name="email"]').fill(buildTestUser().email);
    await page.locator('input[name="password"]').fill('short');
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

      await Promise.all([
        page.waitForURL(/\/auth\/register$/),
        page.locator('form[action="/auth/register"] button').click(),
      ]);

      await expect(page.locator('.flash.flash-danger')).toContainText('Email already registered');
    } finally {
      await context.close();
    }
  });
});
