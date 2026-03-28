import { expect, test } from '@playwright/test';

const staticPages = ['/pages/about', '/pages/terms', '/pages/privacy', '/pages/safety'];

test.describe('Navigation footer', () => {
  test('Footer visible on homepage', async ({ page }) => {
    // Intent: verify the live homepage renders the global footer container and links.
    await page.goto('/');

    await expect(page.locator('footer.footer')).toBeVisible();
  });

  for (const path of staticPages) {
    test(`${path} loads with content`, async ({ page, request }) => {
      // Intent: verify each footer destination returns a healthy response and renders markdown content inside the live prose container.
      const response = await request.get(path);
      expect(response.status()).toBe(200);

      await page.goto(path);
      await expect(page.locator('.prose')).toBeVisible();
      await expect(page.locator('.prose h1')).toContainText(/.+/);
    });
  }
});
