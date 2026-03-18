const { test, expect } = require('@playwright/test');

const PERFORMANCE_BUDGET = {
  '/': 2000,
  '/whale': 2500,
  '/auth/login': 1500,
  '/forum': 2000
};

for (const [url, maxMs] of Object.entries(PERFORMANCE_BUDGET)) {
  test(`@performance ${url} loads within ${maxMs}ms`, async ({ page }) => {
    const start = Date.now();
    await page.goto(url);
    await page.waitForLoadState('domcontentloaded');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(maxMs);
  });
}

test('@performance marketplace: no significant layout shift (CLS < 0.15)', async ({ page }) => {
  await page.goto('/whale');
  await page.waitForLoadState('networkidle');
  const cls = await page.evaluate(() => {
    return new Promise((resolve) => {
      if (!('PerformanceObserver' in window)) {
        resolve(0);
        return;
      }

      let total = 0;
      let observer;
      try {
        observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (!entry.hadRecentInput) total += entry.value;
          });
        });
        observer.observe({ type: 'layout-shift', buffered: true });
      } catch (_err) {
        resolve(0);
        return;
      }

      setTimeout(() => {
        observer.disconnect();
        resolve(total);
      }, 1200);
    });
  });
  expect(cls).toBeLessThan(0.15);
});

test('@performance listing images use lazy loading', async ({ page }) => {
  await page.goto('/whale');
  const result = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('.listing-card img, .listing-img'));
    if (!imgs.length) return { total: 0, lazy: 0 };
    const lazy = imgs.filter((img) => img.getAttribute('loading') === 'lazy').length;
    return { total: imgs.length, lazy };
  });
  if (result.total > 0) {
    expect(result.lazy).toBeGreaterThan(0);
  }
});

test('@performance no synchronous blocking scripts in <head>', async ({ page }) => {
  await page.goto('/whale');
  const blockingScripts = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('head script'));
    return scripts
      .filter((s) => s.src && !s.async && !s.defer)
      .map((s) => s.src);
  });
  expect(blockingScripts).toHaveLength(0);
});

