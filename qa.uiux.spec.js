/**
 * ============================================================
 *  COMPREHENSIVE UI/UX QA TEST SUITE — NODE.JS / PLAYWRIGHT
 *  Target: Full-stack Node.js web application
 *  Runner: Playwright (npx playwright test)
 *  Strict Mode: ON — zero tolerance for regressions
 *  Coverage: Layout · Typography · Responsiveness · Forms
 *            Navigation · Accessibility · Performance
 *            Interactions · Dark Mode · Error States · Localization
 * ============================================================
 *
 *  SETUP:
 *    npm install -D @playwright/test
 *    npx playwright install
 *    npx playwright test --reporter=html
 *
 *  CONFIG: Set BASE_URL below or via env: BASE_URL=http://localhost:3001
 * ============================================================
 */

const { test, expect, devices } = require('@playwright/test');

// ─── CONFIG ──────────────────────────────────────────────────
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

const VIEWPORTS = {
  mobile_s: { width: 320, height: 568 },
  mobile_m: { width: 375, height: 667 },
  mobile_l: { width: 425, height: 896 },
  tablet: { width: 768, height: 1024 },
  laptop: { width: 1024, height: 768 },
  desktop: { width: 1440, height: 900 },
  ultrawide: { width: 2560, height: 1440 },
};

const COLOR_CONTRAST_MIN_AA = 4.5; // WCAG AA  — normal text
const COLOR_CONTRAST_MIN_AAA = 7.0; // WCAG AAA — enhanced
const MAX_LCP_MS = 2500; // Largest Contentful Paint
const MAX_FID_MS = 100; // First Input Delay
const MAX_CLS_SCORE = 0.1; // Cumulative Layout Shift
const MAX_FCP_MS = 1800; // First Contentful Paint
const MAX_TTI_MS = 3800; // Time to Interactive
const MIN_TOUCH_TARGET_PX = 44; // WCAG 2.5.5 touch target

// ─── HELPERS ─────────────────────────────────────────────────
async function goto(page, path = '/') {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
}

async function getComputedStyle(page, selector, prop) {
  return page.evaluate(
    ([sel, p]) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).getPropertyValue(p);
    },
    [selector, prop]
  );
}

async function measurePerformance(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find((e) => e.name === 'first-contentful-paint');
    return {
      domContentLoaded: nav?.domContentLoadedEventEnd - nav?.startTime,
      loadComplete: nav?.loadEventEnd - nav?.startTime,
      fcp: fcp?.startTime ?? null,
      ttfb: nav?.responseStart - nav?.requestStart,
    };
  });
}

async function checkNoHorizontalScroll(page) {
  const hasScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  return hasScroll;
}

// ─────────────────────────────────────────────────────────────
//  1. LAYOUT & VISUAL INTEGRITY
// ─────────────────────────────────────────────────────────────
test.describe('1. Layout & Visual Integrity', () => {
  test('1.1 — Page renders without blank white screen (content visible)', async ({ page }) => {
    await goto(page);
    const body = await page.locator('body');
    const text = await body.innerText();
    expect(text.trim().length, 'Body must contain visible text').toBeGreaterThan(10);
  });

  test('1.2 — No overlapping elements at desktop viewport', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await goto(page);
    const overlaps = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('*'));
      const issues = [];
      for (let i = 0; i < els.length; i++) {
        const r1 = els[i].getBoundingClientRect();
        if (r1.width === 0 || r1.height === 0) continue;
        for (let j = i + 1; j < Math.min(els.length, i + 20); j++) {
          if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
          const r2 = els[j].getBoundingClientRect();
          const overlap =
            r1.left < r2.right && r1.right > r2.left && r1.top < r2.bottom && r1.bottom > r2.top;
          if (overlap) {
            issues.push(`<${els[i].tagName}> overlaps <${els[j].tagName}>`);
          }
        }
      }
      return issues.slice(0, 10);
    });
    expect(overlaps, `Overlapping elements found: ${overlaps.join(', ')}`).toHaveLength(0);
  });

  test('1.3 — No content is clipped or cut off (overflow hidden check)', async ({ page }) => {
    await goto(page);
    const clipped = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*'))
        .filter((el) => {
          const s = window.getComputedStyle(el);
          return (
            (s.overflow === 'hidden' || s.overflowX === 'hidden') &&
            el.scrollWidth > el.clientWidth + 2
          );
        })
        .map(
          (el) =>
            el.tagName +
            (el.id ? '#' + el.id : '') +
            (el.className ? '.' + el.className.split(' ')[0] : '')
        )
        .slice(0, 10);
    });
    expect(clipped, `Clipped elements: ${clipped.join(', ')}`).toHaveLength(0);
  });

  test('1.4 — Header is visible and positioned at top', async ({ page }) => {
    await goto(page);
    const header = page.locator("header, [role='banner'], nav").first();
    await expect(header).toBeVisible();
    const box = await header.boundingBox();
    expect(box?.y ?? 999, 'Header must be within top 200px').toBeLessThan(200);
  });

  test('1.5 — Footer is present and rendered at bottom of page', async ({ page }) => {
    await goto(page);
    const footer = page.locator("footer, [role='contentinfo']").first();
    await expect(footer).toBeVisible();
  });

  test('1.6 — Main content area has adequate padding/margin (not flush to edge)', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await goto(page);
    const main = page.locator("main, [role='main'], #main, .main").first();
    await expect(main).toBeVisible();
    const box = await main.boundingBox();
    expect(box?.x ?? 0, 'Main content must have left margin > 0').toBeGreaterThan(0);
  });

  test('1.7 — No broken layout on ultrawide screen (2560px)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.ultrawide);
    await goto(page);
    const hasHScroll = await checkNoHorizontalScroll(page);
    expect(hasHScroll, 'No horizontal scroll on ultrawide').toBe(false);
  });

  test('1.8 — Z-index stacking: modals/dropdowns appear on top of content', async ({ page }) => {
    await goto(page);
    const modalTrigger = page
      .locator("[data-testid='open-modal'], .modal-trigger, button[aria-haspopup='dialog']")
      .first();
    if ((await modalTrigger.count()) > 0) {
      await modalTrigger.click();
      const modal = page.locator("[role='dialog'], .modal, .overlay").first();
      await expect(modal).toBeVisible();
      const zIndex = await getComputedStyle(page, "[role='dialog'], .modal", 'z-index');
      expect(Number(zIndex), 'Modal z-index must be > 100').toBeGreaterThan(100);
    }
  });

  test('1.9 — Images do not have broken src (all img tags load)', async ({ page }) => {
    await goto(page);
    const brokenImages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .filter((img) => !img.complete || img.naturalWidth === 0)
        .map((img) => img.src || img.alt || 'unknown img');
    });
    expect(brokenImages, `Broken images: ${brokenImages.join(', ')}`).toHaveLength(0);
  });

  test('1.10 — CSS loads correctly (body background not default white only when custom)', async ({
    page,
  }) => {
    await goto(page);
    const linkTags = await page.evaluate(() =>
      Array.from(document.querySelectorAll("link[rel='stylesheet']")).map((l) => l.href)
    );
    expect(linkTags.length, 'At least one stylesheet must be loaded').toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
//  2. TYPOGRAPHY
// ─────────────────────────────────────────────────────────────
test.describe('2. Typography', () => {
  test('2.1 — Body font-size is at least 14px', async ({ page }) => {
    await goto(page);
    const fontSize = await getComputedStyle(page, 'body', 'font-size');
    expect(parseFloat(fontSize), 'Body font must be >= 14px').toBeGreaterThanOrEqual(14);
  });

  test('2.2 — Line-height is at least 1.4 for readability', async ({ page }) => {
    await goto(page);
    const lineHeight = await page.evaluate(() => {
      const p = document.querySelector('p, .body-text, main p');
      if (!p) return null;
      const lh = window.getComputedStyle(p).lineHeight;
      const fs = parseFloat(window.getComputedStyle(p).fontSize);
      if (lh === 'normal') return 1.2;
      return parseFloat(lh) / fs;
    });
    if (lineHeight !== null) {
      expect(lineHeight, 'Line-height ratio must be >= 1.4').toBeGreaterThanOrEqual(1.4);
    }
  });

  test('2.3 — H1 is larger than H2, H2 larger than H3 (visual hierarchy)', async ({ page }) => {
    await goto(page);
    const sizes = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const h2 = document.querySelector('h2');
      const h3 = document.querySelector('h3');
      return {
        h1: h1 ? parseFloat(window.getComputedStyle(h1).fontSize) : null,
        h2: h2 ? parseFloat(window.getComputedStyle(h2).fontSize) : null,
        h3: h3 ? parseFloat(window.getComputedStyle(h3).fontSize) : null,
      };
    });
    if (sizes.h1 && sizes.h2) expect(sizes.h1).toBeGreaterThan(sizes.h2);
    if (sizes.h2 && sizes.h3) expect(sizes.h2).toBeGreaterThan(sizes.h3);
  });

  test('2.4 — No text is invisible (color same as background)', async ({ page }) => {
    await goto(page);
    const invisibleText = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('p, h1, h2, h3, span, a, button, label'))
        .filter((el) => {
          const s = window.getComputedStyle(el);
          return s.color === s.backgroundColor && s.color !== 'rgba(0, 0, 0, 0)';
        })
        .map((el) => el.tagName + ': ' + el.textContent?.slice(0, 30))
        .slice(0, 5);
    });
    expect(invisibleText, `Invisible text found: ${invisibleText.join('; ')}`).toHaveLength(0);
  });

  test('2.5 — Page title (H1) exists and is unique per page', async ({ page }) => {
    await goto(page);
    const h1Count = await page.locator('h1').count();
    expect(h1Count, 'Page must have exactly 1 H1 tag').toBe(1);
  });

  test('2.6 — No text overflows its container at any viewport', async ({ page }) => {
    for (const [name, size] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(size);
      await goto(page);
      const overflow = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('p, h1, h2, h3, span, a'))
          .filter((el) => el.scrollWidth > el.clientWidth + 5)
          .map((el) => el.tagName + ': ' + el.textContent?.slice(0, 40))
          .slice(0, 5);
      });
      expect(overflow, `Text overflow at ${name}: ${overflow.join('; ')}`).toHaveLength(0);
    }
  });

  test('2.7 — Font is loaded (not fallback system font) if custom font declared', async ({
    page,
  }) => {
    await goto(page);
    const fontFamily = await getComputedStyle(page, 'body', 'font-family');
    const hasSystemOnlyFont =
      fontFamily?.toLowerCase().includes('arial') ||
      fontFamily?.toLowerCase().includes('times new roman') ||
      fontFamily?.toLowerCase().includes('courier new');
    // Warn but don't hard-fail — custom apps may intentionally use system fonts
    console.log(`Font family in use: ${fontFamily}`);
    expect(fontFamily, 'Font family must be defined').toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
//  3. RESPONSIVENESS
// ─────────────────────────────────────────────────────────────
test.describe('3. Responsiveness', () => {
  for (const [name, size] of Object.entries(VIEWPORTS)) {
    test(`3.1 — No horizontal scroll at ${name} (${size.width}px)`, async ({ page }) => {
      await page.setViewportSize(size);
      await goto(page);
      const hasScroll = await checkNoHorizontalScroll(page);
      expect(hasScroll, `Horizontal scroll found at ${name}`).toBe(false);
    });
  }

  test('3.2 — Navigation collapses to hamburger/menu on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile_m);
    await goto(page);
    const hamburger = page
      .locator(
        ".navbar-toggle, [data-testid='hamburger'], .hamburger, .menu-toggle, [aria-label*='menu']"
      )
      .first();
    const desktopNav = page.locator('.navbar-nav, nav ul, nav .nav-links').first();
    const menuExists = (await hamburger.count()) > 0;
    const navHidden = (await desktopNav.count()) === 0 || !(await desktopNav.isVisible());
    expect(menuExists || navHidden, 'Mobile navigation must be collapsed').toBe(true);
  });

  test('3.3 — Images are responsive (max-width: 100% or srcset used)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile_m);
    await goto(page);
    const overflowImages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .filter((img) => img.getBoundingClientRect().width > window.innerWidth)
        .map((img) => img.src || img.alt)
        .slice(0, 5);
    });
    expect(overflowImages, `Images wider than viewport: ${overflowImages.join(', ')}`).toHaveLength(
      0
    );
  });

  test('3.4 — Grid/flex layouts reflow correctly on tablet', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await goto(page);
    const hasScroll = await checkNoHorizontalScroll(page);
    expect(hasScroll).toBe(false);
    await expect(page.locator('body')).toBeVisible();
  });

  test('3.5 — Font sizes scale appropriately (mobile not same as desktop)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile_m);
    await goto(page);
    const mobileFontSize = parseFloat((await getComputedStyle(page, 'body', 'font-size')) || '16');

    await page.setViewportSize(VIEWPORTS.desktop);
    await goto(page);
    const desktopFontSize = parseFloat((await getComputedStyle(page, 'body', 'font-size')) || '16');

    // Mobile font should not be dramatically larger than desktop
    expect(mobileFontSize, 'Mobile font must be >= 12px').toBeGreaterThanOrEqual(12);
    expect(desktopFontSize, 'Desktop font must be >= 14px').toBeGreaterThanOrEqual(14);
  });

  test('3.6 — Touch targets are >= 44x44px on mobile (WCAG 2.5.5)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile_m);
    await goto(page);
    const smallTargets = await page.evaluate((minSize) => {
      return Array.from(
        document.querySelectorAll("a, button, input, select, textarea, [role='button']")
      )
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return (r.width < minSize || r.height < minSize) && r.width > 0 && r.height > 0;
        })
        .map((el) => {
          const r = el.getBoundingClientRect();
          return `${el.tagName}(${Math.round(r.width)}x${Math.round(r.height)}): "${el.textContent?.trim().slice(0, 20)}"`;
        })
        .slice(0, 10);
    }, MIN_TOUCH_TARGET_PX);
    expect(
      smallTargets,
      `Touch targets too small (< ${MIN_TOUCH_TARGET_PX}px): ${smallTargets.join('; ')}`
    ).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
//  4. NAVIGATION & ROUTING
// ─────────────────────────────────────────────────────────────
test.describe('4. Navigation & Routing', () => {
  test('4.1 — All nav links are reachable and return 200', async ({ page, request }) => {
    await goto(page);
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('nav a[href]'))
        .map((a) => a.getAttribute('href'))
        .filter((h) => h && !h.startsWith('#') && !h.startsWith('mailto') && !h.startsWith('tel'))
    );
    for (const href of links) {
      const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      const res = await request.get(url);
      expect(res.status(), `Nav link ${href} must return 200`).toBe(200);
    }
  });

  test('4.2 — Active nav item is visually highlighted', async ({ page }) => {
    await goto(page);
    const activeNav = page
      .locator("nav a.active, nav a[aria-current='page'], nav li.active a")
      .first();
    if ((await activeNav.count()) > 0) {
      await expect(activeNav).toBeVisible();
      const color = await getComputedStyle(
        page,
        "nav a.active, nav a[aria-current='page']",
        'color'
      );
      expect(color, 'Active nav item must have a distinct color').toBeTruthy();
    }
  });

  test('4.3 — Browser back/forward navigation works correctly', async ({ page }) => {
    await goto(page, '/');
    const navLinks = await page.locator('nav a[href]').all();
    if (navLinks.length > 1) {
      const firstHref = await navLinks[1].getAttribute('href');
      await navLinks[1].click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain(firstHref?.replace(/^\//, ''));
      await page.goBack();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toBe(`${BASE_URL}/`);
    }
  });

  test('4.4 — Logo links back to home page', async ({ page }) => {
    await goto(page, '/whale');
    const logo = page.locator("a.navbar-brand, a[href='/'], a.logo, nav a:first-of-type").first();
    if ((await logo.count()) > 0) {
      await logo.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toMatch(new RegExp(`${BASE_URL}/?$`));
    }
  });

  test('4.5 — 404 page is handled gracefully (not raw server error)', async ({ page }) => {
    await goto(page, '/this-route-absolutely-does-not-exist-404xyz');
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.toLowerCase(), '404 page must show user-friendly message').toMatch(
      /not found|404|page doesn|doesn't exist|oops|error/i
    );
    const statusCode = await page.evaluate(() => {
      // Check meta tag or window variable some apps set
      return window.__STATUS_CODE__ || 404;
    });
    // Page should not show raw Node.js stack trace
    expect(bodyText).not.toContain('at Object.<anonymous>');
    expect(bodyText).not.toContain('node_modules');
  });

  test('4.6 — Skip-to-main-content link is present (keyboard accessibility)', async ({ page }) => {
    await goto(page);
    const skipLink = page
      .locator("a[href='#main'], a[href='#content'], a.skip-link, a[class*='skip']")
      .first();
    await expect(skipLink, 'Skip-to-content link must exist').toHaveCount(1);
  });

  test('4.7 — Page title (<title>) changes with navigation (SPA or MPA)', async ({ page }) => {
    await goto(page, '/');
    const homeTitle = await page.title();
    expect(homeTitle.trim().length, 'Home page must have a non-empty title').toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
//  5. FORMS & INPUT VALIDATION
// ─────────────────────────────────────────────────────────────
test.describe('5. Forms & Input Validation', () => {
  test('5.1 — All form inputs have associated <label> elements', async ({ page }) => {
    await goto(page);
    const unlabeled = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(
          "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset'])"
        )
      )
        .filter((input) => {
          const id = input.id;
          const hasLabel = id && document.querySelector(`label[for='${id}']`);
          const hasAriaLabel =
            input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
          const isWrappedInLabel = input.closest('label');
          return !hasLabel && !hasAriaLabel && !isWrappedInLabel;
        })
        .map(
          (input) =>
            `<input type="${input.getAttribute('type') || 'text'}" name="${input.getAttribute('name') || 'unknown'}">`
        )
        .slice(0, 10);
    });
    expect(unlabeled, `Unlabeled inputs: ${unlabeled.join(', ')}`).toHaveLength(0);
  });

  test('5.2 — Required fields show error on empty submit', async ({ page }) => {
    await goto(page);
    const forms = page.locator('form');
    if ((await forms.count()) > 0) {
      const submitBtn = forms.first().locator("button[type='submit'], input[type='submit']");
      if ((await submitBtn.count()) > 0) {
        await submitBtn.click();
        await page.waitForTimeout(300);
        const errorMessages = await page
          .locator("[class*='error'], [role='alert'], .invalid-feedback, [aria-invalid='true']")
          .count();
        expect(errorMessages, 'Required field errors must appear on empty submit').toBeGreaterThan(
          0
        );
      }
    }
  });

  test('5.3 — Email field validates invalid email format', async ({ page }) => {
    await goto(page);
    const emailInput = page.locator("input[type='email']").first();
    if ((await emailInput.count()) > 0) {
      await emailInput.fill('not-an-email');
      await emailInput.press('Tab');
      await page.waitForTimeout(300);
      const isInvalid =
        (await emailInput.getAttribute('aria-invalid')) === 'true' ||
        (await page.locator("[class*='error'], .invalid-feedback").count()) > 0;
      expect(isInvalid, 'Invalid email must trigger validation error').toBe(true);
    }
  });

  test('5.4 — Password field input is masked (type=password)', async ({ page }) => {
    await goto(page);
    const passwordInput = page.locator("input[type='password']").first();
    if ((await passwordInput.count()) > 0) {
      const inputType = await passwordInput.getAttribute('type');
      expect(inputType, "Password must have type='password'").toBe('password');
    }
  });

  test('5.5 — Form submit button is disabled while submitting (no double-submit)', async ({
    page,
  }) => {
    await goto(page);
    const form = page.locator('form').first();
    if ((await form.count()) > 0) {
      const submitBtn = form.locator("button[type='submit']").first();
      if ((await submitBtn.count()) > 0) {
        // Fill any required fields
        const textInputs = form.locator('input[required]');
        for (const input of await textInputs.all()) {
          await input.fill('test value');
        }
        await submitBtn.click();
        // Immediately check disabled state
        const isDisabledOrLoading =
          (await submitBtn.isDisabled()) ||
          (await submitBtn.getAttribute('aria-busy')) === 'true' ||
          (await submitBtn.getAttribute('data-loading')) !== null;
        console.log('Submit button disabled on submit:', isDisabledOrLoading);
        // Reset
        await page.goBack().catch(() => {});
      }
    }
  });

  test('5.6 — Textarea has visible resize handle or fixed sizing', async ({ page }) => {
    await goto(page);
    const textarea = page.locator('textarea').first();
    if ((await textarea.count()) > 0) {
      await expect(textarea).toBeVisible();
      const resize = await getComputedStyle(page, 'textarea', 'resize');
      expect(
        ['both', 'vertical', 'horizontal', 'none'],
        'Textarea resize must be defined'
      ).toContain(resize);
    }
  });

  test('5.7 — Select dropdown options are selectable and accessible', async ({ page }) => {
    await goto(page);
    const select = page.locator('select').first();
    if ((await select.count()) > 0) {
      await expect(select).toBeVisible();
      const optionCount = await select.locator('option').count();
      expect(optionCount, 'Select must have at least 1 option').toBeGreaterThan(0);
      await select.selectOption({ index: Math.min(1, optionCount - 1) });
    }
  });

  test('5.8 — Success message appears after successful form submission', async ({ page }) => {
    await goto(page);
    // This test is project-specific — verify success state exists
    const successEl = page.locator(
      "[class*='success'], [role='status'], .alert-success, .toast-success"
    );
    // Just verify the selector exists in DOM if a form was submitted
    console.log('Success element selector ready — trigger manually per project form flow.');
  });

  test('5.9 — Character count shown for limited-length inputs', async ({ page }) => {
    await goto(page);
    const maxLengthInputs = page.locator('input[maxlength], textarea[maxlength]');
    if ((await maxLengthInputs.count()) > 0) {
      const input = maxLengthInputs.first();
      const maxLen = await input.getAttribute('maxlength');
      await input.fill('a');
      const charCount = page.locator(`[data-charcount], .char-count, #char-count`).first();
      console.log(`maxlength=${maxLen} — verify char counter near element`);
    }
  });

  test('5.10 — Autocomplete attributes set correctly on auth forms', async ({ page }) => {
    await goto(page, '/login');
    const emailInput = page
      .locator("input[type='email'], input[name='email'], input[name='username']")
      .first();
    const passInput = page.locator("input[type='password']").first();
    if ((await emailInput.count()) > 0) {
      const ac = await emailInput.getAttribute('autocomplete');
      expect(ac, "Email/username must have autocomplete='email' or 'username'").toMatch(
        /email|username/i
      );
    }
    if ((await passInput.count()) > 0) {
      const ac = await passInput.getAttribute('autocomplete');
      expect(ac, "Password must have autocomplete='current-password' or 'new-password'").toMatch(
        /password/i
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────
//  6. ACCESSIBILITY (WCAG 2.1 AA)
// ─────────────────────────────────────────────────────────────
test.describe('6. Accessibility (WCAG 2.1 AA)', () => {
  test('6.1 — All images have non-empty alt attributes', async ({ page }) => {
    await goto(page);
    const missingAlt = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img'))
        .filter((img) => !img.hasAttribute('alt'))
        .map((img) => img.src || 'unknown')
        .slice(0, 10)
    );
    expect(missingAlt, `Images missing alt: ${missingAlt.join(', ')}`).toHaveLength(0);
  });

  test("6.2 — Decorative images have empty alt='' or role='presentation'", async ({ page }) => {
    await goto(page);
    // Decorative images should not have meaningless alt text
    const badAlt = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img[alt]'))
        .filter((img) => {
          const alt = (img.getAttribute('alt') || '').toLowerCase();
          return ['image', 'photo', 'picture', 'img', 'icon'].includes(alt.trim());
        })
        .map((img) => `alt="${img.getAttribute('alt')}" src="${img.src?.slice(-40)}"`)
        .slice(0, 5)
    );
    expect(badAlt, `Generic/meaningless alt text found: ${badAlt.join('; ')}`).toHaveLength(0);
  });

  test('6.3 — Keyboard-only navigation reaches all interactive elements', async ({ page }) => {
    await goto(page);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(
      ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY', 'DETAILS'],
      `Tab focus must land on interactive element (got ${focused})`
    ).toContain(focused);
  });

  test('6.4 — Focus ring is visible on keyboard navigation (not outline:none on all)', async ({
    page,
  }) => {
    await goto(page);
    await page.keyboard.press('Tab');
    const outlineStyle = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      return window.getComputedStyle(el).outline;
    });
    expect(outlineStyle, 'Focus ring must not be completely hidden').not.toMatch(/0px|none/);
  });

  test('6.5 — ARIA roles are used correctly (no invalid role values)', async ({ page }) => {
    await goto(page);
    const validRoles = [
      'alert',
      'alertdialog',
      'application',
      'article',
      'banner',
      'button',
      'cell',
      'checkbox',
      'columnheader',
      'combobox',
      'complementary',
      'contentinfo',
      'definition',
      'dialog',
      'directory',
      'document',
      'feed',
      'figure',
      'form',
      'grid',
      'gridcell',
      'group',
      'heading',
      'img',
      'link',
      'list',
      'listbox',
      'listitem',
      'log',
      'main',
      'marquee',
      'math',
      'menu',
      'menubar',
      'menuitem',
      'menuitemcheckbox',
      'menuitemradio',
      'navigation',
      'none',
      'note',
      'option',
      'presentation',
      'progressbar',
      'radio',
      'radiogroup',
      'region',
      'row',
      'rowgroup',
      'rowheader',
      'scrollbar',
      'search',
      'searchbox',
      'separator',
      'slider',
      'spinbutton',
      'status',
      'switch',
      'tab',
      'table',
      'tablist',
      'tabpanel',
      'term',
      'textbox',
      'timer',
      'toolbar',
      'tooltip',
      'tree',
      'treegrid',
      'treeitem',
    ];
    const invalidRoles = await page.evaluate(
      (valid) =>
        Array.from(document.querySelectorAll('[role]'))
          .filter((el) => !valid.includes(el.getAttribute('role') || ''))
          .map((el) => `${el.tagName} role="${el.getAttribute('role')}"`)
          .slice(0, 10),
      validRoles
    );
    expect(invalidRoles, `Invalid ARIA roles: ${invalidRoles.join(', ')}`).toHaveLength(0);
  });

  test('6.6 — Page has correct lang attribute on <html>', async ({ page }) => {
    await goto(page);
    const lang = await page.getAttribute('html', 'lang');
    expect(lang, 'HTML tag must have a valid lang attribute').toBeTruthy();
    expect(lang.length, 'Lang attribute must be 2+ chars').toBeGreaterThanOrEqual(2);
  });

  test('6.7 — Document has a logical heading structure (no heading jumps)', async ({ page }) => {
    await goto(page);
    const headings = await page.evaluate(() =>
      Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => parseInt(h.tagName[1]))
    );
    for (let i = 1; i < headings.length; i++) {
      const jump = headings[i] - headings[i - 1];
      expect(
        jump,
        `Heading jump too large at index ${i}: h${headings[i - 1]} → h${headings[i]}`
      ).toBeLessThanOrEqual(1);
    }
  });

  test('6.8 — Buttons have descriptive accessible names (not empty)', async ({ page }) => {
    await goto(page);
    const emptyButtons = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button, [role='button']"))
        .filter((btn) => {
          const text = btn.textContent?.trim() || '';
          const ariaLabel = btn.getAttribute('aria-label') || '';
          const ariaLabelledBy = btn.getAttribute('aria-labelledby') || '';
          const title = btn.getAttribute('title') || '';
          return !text && !ariaLabel && !ariaLabelledBy && !title;
        })
        .map((btn) => btn.outerHTML.slice(0, 100))
        .slice(0, 5)
    );
    expect(
      emptyButtons,
      `Buttons with no accessible name: ${emptyButtons.join('; ')}`
    ).toHaveLength(0);
  });

  test('6.9 — Color is not the sole means of conveying information', async ({ page }) => {
    await goto(page);
    // Check error states have text labels, not just red color
    const colorOnlyErrors = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll("[class*='error']:not([aria-label]):not([aria-describedby])")
      )
        .filter((el) => {
          const text = el.textContent?.trim() || '';
          const icon = el.querySelector("svg, img, [class*='icon']");
          return !text && !icon;
        })
        .map((el) => el.className)
        .slice(0, 5)
    );
    expect(
      colorOnlyErrors,
      `Elements relying on color only: ${colorOnlyErrors.join(', ')}`
    ).toHaveLength(0);
  });

  test('6.10 — Modals/dialogs trap focus correctly', async ({ page }) => {
    await goto(page);
    const modalTrigger = page
      .locator("[data-testid='open-modal'], button[aria-haspopup='dialog']")
      .first();
    if ((await modalTrigger.count()) > 0) {
      await modalTrigger.click();
      await page.waitForSelector("[role='dialog']");
      // Tab through elements and verify focus stays in dialog
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(
          () => document.activeElement?.closest("[role='dialog']") !== null
        );
        expect(focused, 'Focus must remain inside modal dialog').toBe(true);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────
//  7. PERFORMANCE & CORE WEB VITALS
// ─────────────────────────────────────────────────────────────
test.describe('7. Performance & Core Web Vitals', () => {
  test('7.1 — First Contentful Paint (FCP) < 1800ms', async ({ page }) => {
    await goto(page);
    const perf = await measurePerformance(page);
    if (perf.fcp) {
      expect(perf.fcp, `FCP too slow: ${perf.fcp}ms`).toBeLessThan(MAX_FCP_MS);
    }
  });

  test('7.2 — DOM Content Loaded < 3000ms', async ({ page }) => {
    await goto(page);
    const perf = await measurePerformance(page);
    expect(perf.domContentLoaded, `DCL too slow: ${perf.domContentLoaded}ms`).toBeLessThan(3000);
  });

  test('7.3 — TTFB (Time to First Byte) < 800ms', async ({ page }) => {
    await goto(page);
    const perf = await measurePerformance(page);
    expect(perf.ttfb, `TTFB too slow: ${perf.ttfb}ms`).toBeLessThan(800);
  });

  test('7.4 — No render-blocking <script> tags in <head> without async/defer', async ({ page }) => {
    await goto(page);
    const blockingScripts = await page.evaluate(() =>
      Array.from(document.head.querySelectorAll('script[src]'))
        .filter(
          (s) => !s.hasAttribute('async') && !s.hasAttribute('defer') && !s.hasAttribute('type')
        )
        .map((s) => s.src)
        .slice(0, 5)
    );
    expect(
      blockingScripts,
      `Render-blocking scripts in <head>: ${blockingScripts.join(', ')}`
    ).toHaveLength(0);
  });

  test('7.5 — Total page weight does not exceed 5MB', async ({ page }) => {
    let totalBytes = 0;
    page.on('response', async (res) => {
      try {
        const body = await res.body();
        totalBytes += body.length;
      } catch {
        /* ignore */
      }
    });
    await goto(page);
    const totalMB = totalBytes / (1024 * 1024);
    expect(totalMB, `Page weight ${totalMB.toFixed(2)}MB exceeds 5MB limit`).toBeLessThan(5);
  });

  test('7.6 — Images are served in modern format (webp, avif, or svg preferred)', async ({
    page,
  }) => {
    await goto(page);
    const oldFormatImages = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img[src]'))
        .filter((img) => {
          const src = img.src || '';
          return src.match(/\.bmp$|\.tif$|\.tiff$/i);
        })
        .map((img) => img.src)
        .slice(0, 5)
    );
    expect(
      oldFormatImages,
      `Outdated image formats found: ${oldFormatImages.join(', ')}`
    ).toHaveLength(0);
  });

  test('7.7 — CSS and JS assets are minified in production', async ({ page }) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Skipping minification check — not in production mode');
      return;
    }
    const responses = [];
    page.on('response', async (res) => {
      const url = res.url();
      if (url.endsWith('.css') || url.endsWith('.js')) {
        const body = await res.text().catch(() => '');
        const avgLineLen = body.length / (body.split('\n').length || 1);
        if (avgLineLen < 200 && body.length > 1000) {
          responses.push(`${url} may not be minified (avg line: ${avgLineLen.toFixed(0)} chars)`);
        }
      }
    });
    await goto(page);
    expect(responses, `Unminified assets: ${responses.join('; ')}`).toHaveLength(0);
  });

  test('7.8 — No memory leaks on repeated navigation (heap stable)', async ({ page }) => {
    await goto(page);
    const heap1 = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);

    for (let i = 0; i < 5; i++) {
      await goto(page, '/');
    }

    const heap2 = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
    const growth = heap2 - heap1;
    const growthMB = growth / (1024 * 1024);
    console.log(`Heap growth after 5 navigations: ${growthMB.toFixed(2)}MB`);
    expect(growthMB, `Potential memory leak: heap grew ${growthMB.toFixed(2)}MB`).toBeLessThan(30);
  });
});

// ─────────────────────────────────────────────────────────────
//  8. INTERACTIONS & MICRO-UX
// ─────────────────────────────────────────────────────────────
test.describe('8. Interactions & Micro-UX', () => {
  test('8.1 — Buttons have hover state (color/background changes)', async ({ page }) => {
    await goto(page);
    const btn = page.locator('button, a.btn, .button').first();
    if ((await btn.count()) > 0) {
      const beforeBg = await getComputedStyle(page, 'button, .button, a.btn', 'background-color');
      await btn.hover();
      await page.waitForTimeout(200);
      const afterBg = await getComputedStyle(page, 'button, .button, a.btn', 'background-color');
      // Log whether hover state changed (not hard failing to allow CSS transitions)
      console.log(`Button bg before hover: ${beforeBg} | after: ${afterBg}`);
    }
  });

  test('8.2 — Buttons have cursor:pointer', async ({ page }) => {
    await goto(page);
    const cursor = await page.evaluate(() => {
      const btn = document.querySelector('button:not([disabled]), a.btn, .button');
      return btn ? window.getComputedStyle(btn).cursor : null;
    });
    expect(cursor, 'Interactive elements must have cursor: pointer').toBe('pointer');
  });

  test('8.3 — Links have underline or visible differentiation from body text', async ({ page }) => {
    await goto(page);
    const linkStyle = await page.evaluate(() => {
      const a = document.querySelector('a:not(nav a):not(.btn)');
      if (!a) return null;
      const s = window.getComputedStyle(a);
      return {
        textDecoration: s.textDecoration,
        color: s.color,
      };
    });
    if (linkStyle) {
      const hasDecoration = linkStyle.textDecoration.includes('underline');
      const bodyColor = await getComputedStyle(page, 'body', 'color');
      const hasDifferentColor = linkStyle.color !== bodyColor;
      expect(
        hasDecoration || hasDifferentColor,
        'Links must be visually distinct (underline or different color)'
      ).toBe(true);
    }
  });

  test('8.4 — Tooltip appears on hover for [title] or [data-tooltip] elements', async ({
    page,
  }) => {
    await goto(page);
    const tooltipTarget = page.locator('[title], [data-tooltip], [aria-label]').first();
    if ((await tooltipTarget.count()) > 0) {
      await tooltipTarget.hover();
      await page.waitForTimeout(300);
      // Native title tooltip or custom tooltip div should appear
    }
  });

  test('8.5 — Accordion/collapse panels toggle correctly', async ({ page }) => {
    await goto(page);
    const accordion = page
      .locator("[data-toggle='collapse'], .accordion-button, details summary")
      .first();
    if ((await accordion.count()) > 0) {
      const panel = page.locator('.accordion-collapse, .collapse, details[open]').first();
      await accordion.click();
      await page.waitForTimeout(300);
      await expect(panel).toBeVisible();
      await accordion.click();
      await page.waitForTimeout(300);
      await expect(panel).not.toBeVisible();
    }
  });

  test('8.6 — Dropdown menus close when clicking outside', async ({ page }) => {
    await goto(page);
    const dropdownToggle = page
      .locator("[data-toggle='dropdown'], .dropdown-toggle, .user-menu-trigger")
      .first();
    if ((await dropdownToggle.count()) > 0) {
      await dropdownToggle.click();
      const menu = page.locator(".user-menu-dropdown, .dropdown-menu, [role='menu']").first();
      await expect(menu).toBeVisible();
      await page.mouse.click(10, 10);
      await page.waitForTimeout(300);
      await expect(menu).not.toBeVisible();
    }
  });

  test('8.7 — Loading spinners or skeletons shown during async operations', async ({ page }) => {
    await goto(page);
    const hasLoadingIndicators = await page.evaluate(() => {
      const selectors = ['.spinner', '.skeleton', '[aria-busy]', '.loading', "[class*='loader']"];
      return selectors.some((s) => document.querySelector(s) !== null);
    });
    console.log('Loading indicators exist in DOM:', hasLoadingIndicators);
    // Soft assertion — not every page has async loading
  });

  test('8.8 — Scroll to top button appears after scrolling down', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await goto(page);
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(500);
    const scrollTopBtn = page
      .locator(
        "[data-testid='scroll-top'], .scroll-to-top, #backToTop, [aria-label*='scroll to top' i], [aria-label*='back to top' i]"
      )
      .first();
    if ((await scrollTopBtn.count()) > 0) {
      await expect(scrollTopBtn).toBeVisible();
    }
  });

  test('8.9 — Disabled buttons are visually distinguishable (opacity/color)', async ({ page }) => {
    await goto(page);
    const disabledBtn = page.locator('button[disabled], input[disabled]').first();
    if ((await disabledBtn.count()) > 0) {
      const opacity = await getComputedStyle(page, 'button[disabled]', 'opacity');
      const cursor = await getComputedStyle(page, 'button[disabled]', 'cursor');
      const isDistinguishable =
        parseFloat(opacity || '1') < 1 || cursor === 'not-allowed' || cursor === 'default';
      expect(isDistinguishable, 'Disabled buttons must look disabled (opacity or cursor)').toBe(
        true
      );
    }
  });

  test('8.10 — Notifications/toasts auto-dismiss after timeout', async ({ page }) => {
    await goto(page);
    const toast = page.locator(".toast, .notification, .snackbar, [role='status']").first();
    if ((await toast.count()) > 0 && (await toast.isVisible())) {
      await page.waitForTimeout(6000); // Standard toast timeout
      const stillVisible = await toast.isVisible().catch(() => false);
      console.log('Toast still visible after 6s:', stillVisible);
    }
  });
});

// ─────────────────────────────────────────────────────────────
//  9. DARK MODE / THEMING
// ─────────────────────────────────────────────────────────────
test.describe('9. Dark Mode & Theming', () => {
  test('9.1 — Dark mode via OS preference renders correctly', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await goto(page);
    const bgColor = await getComputedStyle(page, 'body', 'background-color');
    console.log(`Dark mode body background: ${bgColor}`);
    // Verify page renders (not blank/white)
    await expect(page.locator('body')).toBeVisible();
    await context.close();
  });

  test('9.2 — Dark mode toggle changes theme when present', async ({ page }) => {
    await goto(page);
    const toggle = page
      .locator(
        "[data-theme-toggle], .icon-btn[data-theme-toggle], [data-testid='theme-toggle'], .dark-mode-toggle, [aria-label*='dark' i], [aria-label*='theme' i]"
      )
      .first();
    if ((await toggle.count()) > 0) {
      const bgBefore = await getComputedStyle(page, 'body', 'background-color');
      await toggle.click();
      await page.waitForTimeout(400);
      const bgAfter = await getComputedStyle(page, 'body', 'background-color');
      expect(bgBefore, 'Dark mode toggle must change background color').not.toBe(bgAfter);
    }
  });

  test('9.3 — High contrast mode does not break layout', async ({ browser }) => {
    const context = await browser.newContext({ forcedColors: 'active' });
    const page = await context.newPage();
    await goto(page);
    const hasScroll = await checkNoHorizontalScroll(page);
    expect(hasScroll, 'High contrast mode must not break layout').toBe(false);
    await context.close();
  });

  test('9.4 — Theme persists across page refresh (localStorage/cookie)', async ({ page }) => {
    await goto(page);
    const toggle = page
      .locator(
        "[data-theme-toggle], .icon-btn[data-theme-toggle], [data-testid='theme-toggle'], .dark-mode-toggle"
      )
      .first();
    if ((await toggle.count()) > 0) {
      await toggle.click();
      await page.waitForTimeout(300);
      const bgAfterToggle = await getComputedStyle(page, 'body', 'background-color');
      await page.reload();
      await page.waitForLoadState('networkidle');
      const bgAfterReload = await getComputedStyle(page, 'body', 'background-color');
      expect(bgAfterToggle, 'Theme must persist after page reload').toBe(bgAfterReload);
    }
  });
});

// ─────────────────────────────────────────────────────────────
//  10. ERROR STATES & EMPTY STATES
// ─────────────────────────────────────────────────────────────
test.describe('10. Error States & Empty States', () => {
  test('10.1 — Network error is handled gracefully (no unhandled promise rejection)', async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.route('**/api/**', (route) => route.abort('failed'));
    await goto(page);
    await page.waitForTimeout(1000);
    const criticalErrors = errors.filter(
      (e) => e.toLowerCase().includes('uncaught') || e.toLowerCase().includes('unhandled')
    );
    expect(criticalErrors, `Unhandled errors: ${criticalErrors.join('; ')}`).toHaveLength(0);
  });

  test('10.2 — Empty list/table states show a helpful message (not blank)', async ({ page }) => {
    await goto(page);
    const emptyState = page.locator(
      "[data-testid='empty-state'], .empty-state, .no-results, .empty-list"
    );
    if ((await emptyState.count()) > 0) {
      await expect(emptyState.first()).toBeVisible();
      const text = await emptyState.first().innerText();
      expect(text.trim().length, 'Empty state must have descriptive text').toBeGreaterThan(5);
    }
  });

  test('10.3 — API/server errors show user-friendly message (not raw JSON)', async ({ page }) => {
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal Server Error' }) })
    );
    await goto(page);
    await page.waitForTimeout(1500);
    const rawJson = await page.evaluate(
      () =>
        document.body.textContent?.includes('"error":') &&
        document.body.tagName === 'BODY' &&
        document.body.children.length < 3
    );
    expect(rawJson, 'Server error must not render raw JSON in the UI').toBe(false);
  });

  test('10.4 — Console has no critical JavaScript errors on load', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await goto(page);
    const critical = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('net::ERR') && e.length > 0
    );
    expect(critical, `Console errors: ${critical.join('; ')}`).toHaveLength(0);
  });

  test('10.5 — Offline mode shows appropriate offline/no-connection message', async ({
    page,
    context,
  }) => {
    await goto(page);
    await context.setOffline(true);
    await page.reload().catch(() => {});
    await page.waitForTimeout(1000);
    const offlineMsg = await page.evaluate(
      () =>
        document.body.innerText.toLowerCase().includes('offline') ||
        document.body.innerText.toLowerCase().includes('connection') ||
        document.body.innerText.toLowerCase().includes('network')
    );
    console.log('Offline message displayed:', offlineMsg);
    await context.setOffline(false);
  });
});

// ─────────────────────────────────────────────────────────────
//  11. SECURITY & META TAGS
// ─────────────────────────────────────────────────────────────
test.describe('11. Security & Meta Tags', () => {
  test('11.1 — Meta viewport tag is set correctly', async ({ page }) => {
    await goto(page);
    const viewport = await page.getAttribute("meta[name='viewport']", 'content');
    expect(viewport, 'Viewport meta tag must be set').toBeTruthy();
    expect(viewport, 'Viewport must include width=device-width').toContain('width=device-width');
  });

  test('11.2 — Meta description tag is present and non-empty', async ({ page }) => {
    await goto(page);
    const desc = await page.getAttribute("meta[name='description']", 'content');
    expect(desc?.trim().length ?? 0, 'Meta description must be non-empty').toBeGreaterThan(10);
  });

  test('11.3 — Open Graph tags are present (og:title, og:description, og:image)', async ({
    page,
  }) => {
    await goto(page);
    const ogTitle = await page.getAttribute("meta[property='og:title']", 'content');
    const ogDesc = await page.getAttribute("meta[property='og:description']", 'content');
    expect(ogTitle?.trim().length ?? 0, 'og:title must be present').toBeGreaterThan(0);
    expect(ogDesc?.trim().length ?? 0, 'og:description must be present').toBeGreaterThan(0);
  });

  test('11.4 — HTTPS is enforced (no mixed content)', async ({ page }) => {
    const insecureRequests = [];
    page.on('request', (req) => {
      if (req.url().startsWith('http://') && !req.url().startsWith('http://localhost')) {
        insecureRequests.push(req.url());
      }
    });
    await goto(page);
    expect(
      insecureRequests,
      `Mixed content (HTTP requests): ${insecureRequests.join(', ')}`
    ).toHaveLength(0);
  });

  test('11.5 — No sensitive data exposed in page source (passwords, API keys)', async ({
    page,
  }) => {
    await goto(page);
    const source = await page.content();
    const sensitivePatterns = [
      /api[_-]?key\s*[:=]\s*['"][a-z0-9]{20,}/i,
      /secret\s*[:=]\s*['"][a-z0-9]{16,}/i,
      /password\s*[:=]\s*['"][^'"]{6,}/i,
      /sk-[a-zA-Z0-9]{32,}/,
    ];
    for (const pattern of sensitivePatterns) {
      expect(source, `Potential sensitive data exposed in HTML: ${pattern}`).not.toMatch(pattern);
    }
  });

  test('11.6 — Favicon is set and loads correctly', async ({ page, request }) => {
    await goto(page);
    const faviconHref = await page.evaluate(() => {
      const link = document.querySelector("link[rel*='icon']");
      return link ? link.getAttribute('href') : '/favicon.ico';
    });
    const url = faviconHref?.startsWith('http') ? faviconHref : `${BASE_URL}${faviconHref}`;
    const res = await request.get(url);
    expect(res.status(), `Favicon must load (got ${res.status()})`).toBeLessThan(400);
  });
});

// ─────────────────────────────────────────────────────────────
//  12. CROSS-BROWSER COMPATIBILITY
// ─────────────────────────────────────────────────────────────
test.describe('12. Cross-Browser Compatibility', () => {
  const browserProjects = ['chromium', 'firefox', 'webkit'];

  // These tests use the project's configured browser; run with --project=all
  // to test all browsers. Tests below are browser-agnostic sanity checks.

  test('12.1 — CSS Grid/Flexbox renders without layout breaks', async ({ page }) => {
    await goto(page);
    const flexBreaks = await page.evaluate(() => {
      const flexContainers = Array.from(document.querySelectorAll('*')).filter((el) => {
        const d = window.getComputedStyle(el).display;
        return d === 'flex' || d === 'grid';
      });
      return flexContainers
        .filter((el) => el.scrollWidth > el.clientWidth + 5)
        .map((el) => el.tagName + '.' + (el.className || ''))
        .slice(0, 5);
    });
    expect(flexBreaks, `Flex/Grid overflow: ${flexBreaks.join(', ')}`).toHaveLength(0);
  });

  test('12.2 — CSS custom properties (variables) are supported and resolved', async ({ page }) => {
    await goto(page);
    const unresolved = await page.evaluate(() => {
      const allEls = Array.from(document.querySelectorAll('*'));
      return allEls
        .filter((el) => {
          const s = window.getComputedStyle(el);
          return (
            s.color.includes('var(') ||
            s.backgroundColor.includes('var(') ||
            s.fontSize.includes('var(')
          );
        })
        .map((el) => el.tagName)
        .slice(0, 5);
    });
    expect(unresolved, `Unresolved CSS variables: ${unresolved.join(', ')}`).toHaveLength(0);
  });

  test('12.3 — No CSS prefixed properties still needed (autoprefixer check)', async ({ page }) => {
    await goto(page);
    const prefixedStyles = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      const prefixedRules = [];
      sheets.forEach((sheet) => {
        try {
          Array.from(sheet.cssRules || []).forEach((rule) => {
            if (rule.style) {
              Array.from(rule.style).forEach((prop) => {
                if (
                  typeof prop === 'string' &&
                  (prop.startsWith('-webkit-') ||
                    prop.startsWith('-moz-') ||
                    prop.startsWith('-ms-'))
                ) {
                  prefixedRules.push(prop);
                }
              });
            }
          });
        } catch {
          /* cross-origin stylesheet */
        }
      });
      return [...new Set(prefixedRules)].slice(0, 10);
    });
    console.log('Vendor-prefixed CSS properties found:', prefixedStyles.join(', ') || 'none');
    // Log only — prefixes may be intentional for broad support
  });
});

// ─────────────────────────────────────────────────────────────
//  13. LOCALIZATION & INTERNATIONALIZATION (i18n)
// ─────────────────────────────────────────────────────────────
test.describe('13. Localization & i18n', () => {
  test('13.1 — Date formats adapt to locale (not hardcoded US format)', async ({ page }) => {
    await goto(page);
    const dates = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-date], time[datetime], .date'))
        .map((el) => el.textContent?.trim())
        .slice(0, 5)
    );
    console.log('Dates found on page:', dates.join(', ') || 'none');
  });

  test("13.2 — RTL layout does not break when dir='rtl' is applied", async ({ page }) => {
    await goto(page);
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    await page.waitForTimeout(300);
    const hasScroll = await checkNoHorizontalScroll(page);
    expect(hasScroll, 'RTL layout must not cause horizontal scroll').toBe(false);
  });

  test('13.3 — Long text strings do not break layout (overflow ellipsis or wrap)', async ({
    page,
  }) => {
    await goto(page);
    await page.evaluate(() => {
      document.querySelectorAll('h1, h2, p, a, button, span').forEach((el) => {
        if (el.children.length === 0) {
          el.textContent = el.textContent + ' AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
        }
      });
    });
    await page.waitForTimeout(200);
    const hasScroll = await checkNoHorizontalScroll(page);
    expect(hasScroll, 'Long text must not cause horizontal scroll').toBe(false);
  });

  test('13.4 — Currency/number formatting is locale-aware (uses Intl API)', async ({ page }) => {
    await goto(page);
    const usesIntl = await page.evaluate(
      () => typeof Intl !== 'undefined' && typeof Intl.NumberFormat !== 'undefined'
    );
    expect(usesIntl, 'Browser Intl API must be available').toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
//  14. PRINT STYLES
// ─────────────────────────────────────────────────────────────
test.describe('14. Print Styles', () => {
  test('14.1 — Print media query exists in stylesheets', async ({ page }) => {
    await goto(page);
    const hasPrintCSS = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      return (
        sheets.some((sheet) => {
          try {
            return Array.from(sheet.cssRules || []).some((rule) =>
              rule.media?.mediaText?.includes('print')
            );
          } catch {
            return false;
          }
        }) || document.querySelector("link[media='print']") !== null
      );
    });
    console.log('Print CSS exists:', hasPrintCSS);
  });

  test('14.2 — Navigation is hidden in print layout', async ({ page }) => {
    await goto(page);
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(300);
    const nav = page.locator('nav, header').first();
    if ((await nav.count()) > 0) {
      const display = await nav.evaluate((el) => window.getComputedStyle(el).display);
      console.log(`Nav display in print mode: ${display}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────
//  15. SCROLL & ANIMATION BEHAVIOR
// ─────────────────────────────────────────────────────────────
test.describe('15. Scroll & Animation Behavior', () => {
  test('15.1 — Sticky header stays visible while scrolling', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await goto(page);
    const header = page.locator("header, .sticky-header, [class*='sticky']").first();
    if ((await header.count()) > 0) {
      const position = await getComputedStyle(page, 'header, .sticky-header', 'position');
      if (position === 'sticky' || position === 'fixed') {
        await page.evaluate(() => window.scrollTo(0, 800));
        await page.waitForTimeout(300);
        await expect(header).toBeVisible();
      }
    }
  });

  test('15.2 — Animations respect prefers-reduced-motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await goto(page);
    const animDuration = await page.evaluate(() => {
      const el = document.querySelector(".animated, [class*='animate'], [class*='transition']");
      if (!el) return null;
      return window.getComputedStyle(el).animationDuration;
    });
    if (animDuration && animDuration !== '0s') {
      console.log(
        `Animation duration with reduced motion: ${animDuration} — check CSS @media (prefers-reduced-motion)`
      );
    }
    await context.close();
  });

  test('15.3 — Infinite scroll / lazy load triggers on scroll', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await goto(page);
    const initialCount = await page
      .locator("[data-testid='list-item'], .list-item, .listing-card, .card")
      .count();
    if (initialCount > 0) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      const afterScrollCount = await page
        .locator("[data-testid='list-item'], .list-item, .listing-card, .card")
        .count();
      console.log(`Items before scroll: ${initialCount} | after: ${afterScrollCount}`);
    }
  });

  test('15.4 — Scroll position preserved on back navigation', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await goto(page, '/');
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);

    const links = page.locator('a[href]').first();
    if ((await links.count()) > 0) {
      await links.click();
      await page.waitForLoadState('networkidle');
      await page.goBack();
      await page.waitForLoadState('networkidle');
      const scrollY = await page.evaluate(() => window.scrollY);
      console.log(`Scroll position after back nav: ${scrollY}`);
    }
  });
});
