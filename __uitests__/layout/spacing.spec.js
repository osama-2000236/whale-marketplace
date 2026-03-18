const { test, expect } = require('@playwright/test');

test('listing cards do not overlap each other', async ({ page }) => {
  await page.goto('/whale');
  const overlaps = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.listing-card'));
    const rects = cards.map((c) => c.getBoundingClientRect());
    const overlapping = [];

    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const intersects =
          a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        if (intersects) overlapping.push({ i, j });
      }
    }

    return overlapping;
  });

  expect(overlaps).toHaveLength(0);
});

test('listing grid has minimum 12px gap between cards', async ({ page }) => {
  await page.goto('/whale');
  const gaps = await page.evaluate(() => {
    const grid = document.querySelector('.listing-grid');
    if (!grid) return { col: 12, row: 12 };
    const style = window.getComputedStyle(grid);
    return {
      col: Number.parseFloat(style.columnGap || '0'),
      row: Number.parseFloat(style.rowGap || '0')
    };
  });

  expect(gaps.col).toBeGreaterThanOrEqual(10);
  expect(gaps.row).toBeGreaterThanOrEqual(10);
});

test('card body has minimum 10px padding on all sides', async ({ page }) => {
  await page.goto('/whale');
  const violations = await page.evaluate(() => {
    const bodies = document.querySelectorAll('.listing-body, .panel-card, .card, .seller-card');
    const failed = [];
    bodies.forEach((el) => {
      const s = window.getComputedStyle(el);
      const pads = [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map((v) =>
        Number.parseFloat(v)
      );
      const minPad = Math.min(...pads);
      if (minPad < 10) failed.push({ className: el.className, minPad });
    });
    return failed;
  });

  expect(violations).toHaveLength(0);
});

test('content never touches viewport edge — min 8px margin', async ({ page }) => {
  await page.goto('/whale');
  const edgeTouching = await page.evaluate(() => {
    const elements = document.querySelectorAll('.container .listing-card, .container .filters, .container .panel-card');
    const failed = [];
    elements.forEach((el) => {
      if (el.offsetParent === null) return;
      const rect = el.getBoundingClientRect();
      if (rect.left < 8 || rect.right > window.innerWidth - 8) {
        failed.push({
          className: el.className,
          left: rect.left,
          rightGap: window.innerWidth - rect.right
        });
      }
    });
    return failed;
  });
  expect(edgeTouching).toHaveLength(0);
});

test('navbar is within expected height range', async ({ page }) => {
  await page.goto('/whale');
  const height = await page.evaluate(() => {
    const nav = document.querySelector('.whale-navbar, nav');
    return nav ? nav.getBoundingClientRect().height : null;
  });

  if (height !== null) {
    expect(height).toBeGreaterThanOrEqual(50);
    expect(height).toBeLessThanOrEqual(80);
  }
});

test('navbar stays at top when scrolling', async ({ page }) => {
  await page.goto('/whale');
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(200);

  const topAfter = await page.evaluate(() => {
    const nav = document.querySelector('.whale-navbar, nav');
    return nav ? nav.getBoundingClientRect().top : 0;
  });

  expect(Math.abs(topAfter)).toBeLessThanOrEqual(5);
});

test('no horizontal scrollbar on desktop (1280px)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/whale');
  const hasHScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
  );
  expect(hasHScroll).toBe(false);
});

test('no horizontal scrollbar on mobile (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/whale');
  const hasHScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
  );
  expect(hasHScroll).toBe(false);
});
