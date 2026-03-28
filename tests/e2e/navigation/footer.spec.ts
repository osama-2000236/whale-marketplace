import { expect, test } from '@playwright/test';

const staticPages = [
  { path: '/pages/about', heading: 'عن الحوت' },
  { path: '/pages/terms', heading: 'شروط الاستخدام' },
  { path: '/pages/privacy', heading: 'سياسة الخصوصية' },
  { path: '/pages/safety', heading: 'نصائح الأمان' },
];

test.describe('Navigation footer', () => {
  test('Footer visible on homepage', async ({ page }) => {
    // Intent: verify the live homepage renders the global footer container and links.
    await page.goto('/');

    await expect(page.locator('footer.footer')).toBeVisible();
  });

  for (const { path, heading } of staticPages) {
    test(`${path} loads with content`, async ({ page, request }) => {
      // Intent: verify each footer destination returns a healthy response and renders markdown content inside the live prose container.
      const response = await request.get(path);
      expect(response.status()).toBe(200);

      await page.goto(path);
      await expect(page.locator('.prose')).toBeVisible();
      await expect(page.locator('.prose h1')).toHaveText(heading);
    });
  }
});
