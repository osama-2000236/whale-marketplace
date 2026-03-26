const { test, expect } = require('@playwright/test');

test.describe('v2.0 core flows', () => {
  test('checkout flow requires auth and preserves next target', async ({ page }) => {
    await page.goto('/whale/checkout/listing-test-id');
    await expect(page).toHaveURL(/\/auth\/login\?next=/);

    const next = page.locator('input[name="next"]');
    await expect(next).toHaveValue('/whale/checkout/listing-test-id');
  });

  test('upgrade flow requires auth and preserves next target', async ({ page }) => {
    await page.goto('/upgrade');
    await expect(page).toHaveURL(/\/auth\/login\?next=/);

    const next = page.locator('input[name="next"]');
    await expect(next).toHaveValue('/upgrade');
  });

  test('login flow renders local auth form controls', async ({ page }) => {
    await page.goto('/auth/login?next=%2Fupgrade');

    await expect(page.locator('form[action="/auth/login"]')).toBeVisible();
    await expect(page.locator('input[name="identifier"]')).toBeVisible();
    await expect(page.locator('input[name="password"][type="password"]')).toBeVisible();
    await expect(page.locator('input[name="next"]')).toHaveValue('/upgrade');
  });

  test('oauth login entry points render conditionally without breaking page', async ({ page }) => {
    await page.goto('/auth/login');

    const oauthContainer = page.locator('.oauth-buttons');
    const oauthLinks = page.locator('.oauth-buttons a');
    const hasOAuthButtons = (await oauthLinks.count()) > 0;

    if (hasOAuthButtons) {
      await expect(oauthContainer).toBeVisible();

      const googleCount = await page.locator('a[href="/auth/google"]').count();
      const facebookCount = await page.locator('a[href="/auth/facebook"]').count();
      const appleCount = await page.locator('a[href="/auth/apple"]').count();
      expect(googleCount + facebookCount + appleCount).toBeGreaterThan(0);
    } else {
      await expect(oauthContainer).toHaveCount(0);
      await expect(page.locator('form[action="/auth/login"]')).toBeVisible();
    }
  });
});
