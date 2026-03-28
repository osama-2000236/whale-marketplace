import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

test.describe('UI responsive layout', () => {
  for (const viewport of viewports) {
    test(`${viewport.name}: no horizontal overflow, navbar functional, listing cards visible`, async ({
      page,
    }) => {
      // Intent: verify the live homepage remains usable across the requested breakpoints without horizontal overflow or hidden core UI.
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth - document.documentElement.clientWidth;
      });

      expect(overflow).toBeLessThanOrEqual(1);
      await expect(page.locator('.grid-listings .listing-card').first()).toBeVisible();

      if (await page.locator('.navbar-toggle').isVisible()) {
        await page.locator('.navbar-toggle').click();
        await expect(page.locator('.navbar-nav')).toHaveClass(/open/);
      } else {
        await expect(page.locator('.navbar-nav a[href="/whale"]')).toBeVisible();
      }

      const viewportWidth = viewport.width;
      const overflowingElements = await page.evaluate((currentWidth) => {
        return Array.from(document.querySelectorAll('body *'))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.right - currentWidth > 1;
          })
          .slice(0, 5)
          .map((element) => {
            const className = (element as HTMLElement).className || '';
            return `${element.tagName}.${String(className).trim()}`;
          });
      }, viewportWidth);

      expect(overflowingElements).toEqual([]);
    });
  }
});
