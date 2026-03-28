import { expect, test } from '@playwright/test';
import {
  RUN_SELL_MUTATION,
  SELLER_EMAIL,
  SELLER_PASSWORD,
  SELL_IMAGE_PATH,
  loginAs,
  validationMessage,
} from '../helpers/auth.helper';

const hasVerifiedSeller = Boolean(SELLER_EMAIL && SELLER_PASSWORD);

test.describe('Marketplace sell', () => {
  test('Unauthenticated -> redirects to /auth/login', async ({ page }) => {
    // Intent: verify the sell entry route is protected and preserves the next target on the live deployment.
    await page.goto('/whale/sell');

    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fwhale%2Fsell$/);
    await expect(page.locator('input[name="next"]')).toHaveValue('/whale/sell');
  });

  test('Logged in -> form accessible', async ({ page }) => {
    // Intent: verify a verified seller account can reach the live sell form when explicit credentials are supplied for production testing.
    test.skip(!hasVerifiedSeller, 'Verified seller credentials were not provided in the environment.');

    await loginAs(page, SELLER_EMAIL, SELLER_PASSWORD);
    await page.goto('/whale/sell');

    await expect(page.locator('form[action="/whale/sell"]')).toBeVisible();
  });

  test('Form has all required fields', async ({ page }) => {
    // Intent: verify the live sell form exposes every required control once a verified seller reaches it.
    test.skip(!hasVerifiedSeller, 'Verified seller credentials were not provided in the environment.');

    await loginAs(page, SELLER_EMAIL, SELLER_PASSWORD);
    await page.goto('/whale/sell');

    await expect(page.locator('input[name="title"]')).toBeVisible();
    await expect(page.locator('textarea[name="description"]')).toBeVisible();
    await expect(page.locator('input[name="price"]')).toBeVisible();
    await expect(page.locator('select[name="categoryId"]')).toBeVisible();
    await expect(page.locator('select[name="city"]')).toBeVisible();
    await expect(page.locator('input[name="images"]')).toBeVisible();
  });

  test('Empty form shows validation errors', async ({ page }) => {
    // Intent: verify the required live sell controls enforce native validation when a verified seller submits an empty form.
    test.skip(!hasVerifiedSeller, 'Verified seller credentials were not provided in the environment.');

    await loginAs(page, SELLER_EMAIL, SELLER_PASSWORD);
    await page.goto('/whale/sell');
    await page.locator('form[action="/whale/sell"] button').click();

    await expect.poll(() => validationMessage(page, 'input[name="title"]')).not.toBe('');
    await expect.poll(() => validationMessage(page, 'textarea[name="description"]')).not.toBe('');
    await expect.poll(() => validationMessage(page, 'input[name="price"]')).not.toBe('');
  });

  test('Valid submission succeeds', async ({ page }) => {
    // Intent: verify the end-to-end live listing creation flow only when explicit seller credentials and mutation opt-in are both present.
    test.skip(!hasVerifiedSeller, 'Verified seller credentials were not provided in the environment.');
    test.skip(!RUN_SELL_MUTATION, 'Production sell mutations are disabled unless WHALE_ENABLE_PRODUCTION_SELL_TEST=1.');

    await loginAs(page, SELLER_EMAIL, SELLER_PASSWORD);
    await page.goto('/whale/sell');

    const title = `QA sell listing ${Date.now()}`;
    await page.locator('input[name="title"]').fill(title);
    await page.locator('textarea[name="description"]').fill('Automated production QA listing.');
    await page.locator('input[name="price"]').fill('123');
    await page.locator('select[name="condition"]').selectOption('GOOD');
    await page.locator('select[name="categoryId"]').selectOption({ index: 1 });
    await page.locator('select[name="city"]').selectOption('Gaza');
    await page.locator('input[name="images"]').setInputFiles(SELL_IMAGE_PATH);
    await page.locator('input[name="tags"]').fill('qa,automation');

    await Promise.all([
      page.waitForURL(/\/whale\/listing\/[^/]+$/),
      page.locator('form[action="/whale/sell"] button').click(),
    ]);

    await expect(page.locator('.listing-detail h1')).toContainText(title);
  });
});
