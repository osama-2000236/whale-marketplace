import { expect, test } from '@playwright/test';

const categories = [
  'electronics',
  'vehicles',
  'real-estate',
  'fashion',
  'home-garden',
  'sports',
];

test.describe('Marketplace category filters', () => {
  for (const category of categories) {
    test(`/whale?category=${category} loads`, async ({ page }) => {
      // Intent: verify each live category filter route responds successfully and renders a stable browse page.
      await page.goto(`/whale?category=${category}`);

      await expect(page).toHaveURL(new RegExp(`category=${category}`));
      await expect(page.locator('.grid-listings, .empty-state')).toBeVisible();
    });
  }

  test('Unknown category does not crash', async ({ page }) => {
    // Intent: verify unexpected category params still render a stable page instead of surfacing an application error.
    await page.goto('/whale?category=not-a-real-category');

    await expect(page.locator('.grid-listings, .empty-state')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });
});
