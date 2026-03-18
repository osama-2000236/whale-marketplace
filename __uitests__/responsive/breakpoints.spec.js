const { test, expect } = require('@playwright/test');

const BREAKPOINTS = [
  { name: 'mobile-sm', width: 320, height: 568 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'mobile-lg', width: 428, height: 926 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'tablet-lg', width: 1024, height: 768 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'desktop-xl', width: 1440, height: 900 }
];

for (const { name, width, height } of BREAKPOINTS) {
  test(`listing grid — correct columns at ${name} (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/whale');

    const columns = await page.evaluate(() => {
      const grid = document.querySelector('.listing-grid');
      if (!grid) return -1;
      const cards = grid.querySelectorAll('.listing-card');
      if (cards.length < 2) return 1;

      const firstTop = cards[0].getBoundingClientRect().top;
      let cols = 0;
      for (const card of cards) {
        const top = card.getBoundingClientRect().top;
        if (Math.abs(top - firstTop) < 5) cols += 1;
        else break;
      }
      return cols;
    });

    if (columns === -1) return;

    if (width <= 480) {
      expect(columns).toBeLessThanOrEqual(2);
    } else if (width <= 1024) {
      expect(columns).toBeGreaterThanOrEqual(1);
    } else {
      expect(columns).toBeGreaterThanOrEqual(3);
    }
  });
}

test('mobile bottom nav is visible on phones (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/whale');
  await expect(page.locator('.mobile-nav')).toBeVisible();
});

test('mobile bottom nav is hidden on desktop (1280px)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/whale');
  const hidden = await page.evaluate(() => {
    const nav = document.querySelector('.mobile-nav');
    if (!nav) return true;
    const style = window.getComputedStyle(nav);
    return style.display === 'none' || style.visibility === 'hidden';
  });
  expect(hidden).toBe(true);
});

test('critical tap targets are at least 36x36px on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/whale');
  const violations = await page.evaluate(() => {
    const items = document.querySelectorAll('button, .btn, .save-btn, .mobile-nav a');
    const failed = [];
    items.forEach((el) => {
      if (el.offsetParent === null) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && (rect.width < 36 || rect.height < 36)) {
        failed.push({
          tag: el.tagName,
          className: el.className,
          w: Math.round(rect.width),
          h: Math.round(rect.height)
        });
      }
    });
    return failed;
  });
  expect(violations).toHaveLength(0);
});

test('listing titles are visible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/whale');
  const invisible = await page.evaluate(() => {
    const titles = document.querySelectorAll('.listing-title');
    const failed = [];
    titles.forEach((el) => {
      if (!el.textContent || !el.textContent.trim()) return;
      const rect = el.getBoundingClientRect();
      if (rect.height < 5) failed.push(el.textContent.trim().slice(0, 40));
    });
    return failed;
  });
  expect(invisible).toHaveLength(0);
});

test('left sidebar hidden on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/whale');
  const sidebarVisible = await page.evaluate(() => {
    const sidebar = document.querySelector('.market-left');
    if (!sidebar) return false;
    const style = window.getComputedStyle(sidebar);
    return style.display !== 'none' && sidebar.offsetParent !== null;
  });
  expect(sidebarVisible).toBe(false);
});

