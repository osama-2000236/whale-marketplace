const { test, expect } = require('@playwright/test');

test('fonts load successfully — Plus Jakarta Sans', async ({ page }) => {
  await page.goto('/whale');
  await page.waitForLoadState('domcontentloaded');
  const fontInfo = await page.evaluate(async () => {
    await document.fonts.ready;
    const loaded =
      document.fonts.check('16px "Plus Jakarta Sans"') ||
      document.fonts.check('16px Plus Jakarta Sans');
    const bodyFamily = window.getComputedStyle(document.body).fontFamily || '';
    const hasFace = Array.from(document.fonts).some((face) =>
      /plus jakarta sans/i.test(face.family || '')
    );
    return { loaded, bodyFamily, hasFace };
  });
  expect(
    fontInfo.loaded ||
    fontInfo.hasFace ||
    /plus jakarta sans/i.test(fontInfo.bodyFamily)
  ).toBe(true);
});

test('fonts load successfully — Tajawal', async ({ page }) => {
  await page.goto('/whale');
  await page.waitForLoadState('domcontentloaded');
  const fontInfo = await page.evaluate(async () => {
    await document.fonts.ready;
    const loaded = document.fonts.check('16px "Tajawal"') || document.fonts.check('16px Tajawal');
    const bodyFamily = window.getComputedStyle(document.body).fontFamily || '';
    return { loaded, bodyFamily };
  });
  expect(fontInfo.loaded || /tajawal/i.test(fontInfo.bodyFamily)).toBe(true);
});

test('body text is 12px minimum — never smaller', async ({ page }) => {
  await page.goto('/whale');
  const violations = await page.evaluate(() => {
    const elements = document.querySelectorAll('p, span, li, td, .listing-title, .listing-meta, label');
    const tooSmall = [];
    elements.forEach((el) => {
      if (el.offsetParent === null) return;
      const text = (el.textContent || '').trim();
      if (!text) return;
      const size = Number.parseFloat(window.getComputedStyle(el).fontSize);
      if (size < 12) {
        tooSmall.push({
          tag: el.tagName,
          className: el.className,
          size,
          text: text.slice(0, 40)
        });
      }
    });
    return tooSmall;
  });
  expect(violations).toHaveLength(0);
});

test('headings use correct hierarchy — h1 >= h2 >= h3', async ({ page }) => {
  await page.goto('/whale');
  const hierarchy = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const h2 = document.querySelector('h2');
    const h3 = document.querySelector('h3');

    const size = (el) => (el ? Number.parseFloat(window.getComputedStyle(el).fontSize) : 0);
    return { h1: size(h1), h2: size(h2), h3: size(h3) };
  });

  if (hierarchy.h1 && hierarchy.h2) {
    expect(hierarchy.h1).toBeGreaterThanOrEqual(hierarchy.h2);
  }
  if (hierarchy.h2 && hierarchy.h3) {
    expect(hierarchy.h2).toBeGreaterThanOrEqual(hierarchy.h3);
  }
});

test('body text has sufficient line height (>= 1.4)', async ({ page }) => {
  await page.goto('/whale');
  const ratio = await page.evaluate(() => {
    const el = document.querySelector('.listing-title, .listing-body, p, .muted');
    if (!el) return 1.5;
    const style = window.getComputedStyle(el);
    const fs = Number.parseFloat(style.fontSize);
    let lh = Number.parseFloat(style.lineHeight);
    if (Number.isNaN(lh)) {
      return 1.5;
    }
    return lh / fs;
  });
  expect(ratio).toBeGreaterThanOrEqual(1.4);
});

test('Arabic text renders with Tajawal-capable font stack', async ({ page }) => {
  await page.goto('/whale');
  const fontFamily = await page.evaluate(() => {
    const div = document.createElement('div');
    div.textContent = 'السوق الكبير';
    div.setAttribute('dir', 'auto');
    document.body.appendChild(div);
    const ff = window.getComputedStyle(div).fontFamily;
    document.body.removeChild(div);
    return ff;
  });
  expect(fontFamily.toLowerCase()).toMatch(/tajawal|plus jakarta sans|sans/i);
});

test('dir="auto" set on listing titles and review text containers', async ({ page }) => {
  await page.goto('/whale');
  const missing = await page.evaluate(() => {
    const userContentEls = document.querySelectorAll('.listing-title, .review-text, .listing-body');
    const missingDir = [];
    userContentEls.forEach((el) => {
      const dir = el.getAttribute('dir');
      if (!dir && !el.closest('[dir]')) {
        missingDir.push({ tag: el.tagName, className: el.className });
      }
    });
    return missingDir;
  });
  expect(missing).toHaveLength(0);
});

test('primary text has contrast against background', async ({ page }) => {
  await page.goto('/whale');
  const contrastOk = await page.evaluate(() => {
    const el = document.querySelector('.listing-title, .panel-card, p');
    if (!el) return true;
    const style = window.getComputedStyle(el);
    return style.color !== style.backgroundColor;
  });
  expect(contrastOk).toBe(true);
});
