// @ts-check
'use strict';

/**
 * Whale Marketplace — No-DB E2E Tests
 * Tests that require NO authentication and NO database writes.
 * Safe to run against production at any time.
 * Config: playwright.e2e.config.ts
 */

const { test, expect } = require('@playwright/test');

// ════════════════════════════════════════════════════════════════════════════
// FLOW 3 — PROTECTED ROUTES (unauthenticated redirect checks, no DB needed)
// ════════════════════════════════════════════════════════════════════════════
test.describe('Flow 3: Protected routes (unauthenticated)', () => {
  test('unauthenticated user cannot access /whale/sell', async ({ page }) => {
    await page.goto('/whale/sell');

    await expect(page).toHaveURL(/\/auth\/login/);
    expect(page.url()).toContain('next=%2Fwhale%2Fsell');
  });

  // PRODUCTION BUG: /whale/my-listings is accessible without auth on production.
  // The requireAuth fix was added to routes/whale.js locally but not yet deployed.
  // test.fail() passes when the assertion fails (documents the known production bug).
  test.fail('unauthenticated user cannot access /whale/my-listings — PRODUCTION BUG: missing requireAuth', async ({ page }) => {
    await page.goto('/whale/my-listings');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('unauthenticated user cannot access /whale/orders', async ({ page }) => {
    await page.goto('/whale/orders');

    await expect(page).toHaveURL(/\/auth\/login/);
    expect(page.url()).toContain('next=');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FLOW 4 — MARKETPLACE BROWSING (public, no login)
// ════════════════════════════════════════════════════════════════════════════
test.describe('Flow 4: Marketplace browsing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/whale');
  });

  test('marketplace page loads with correct Arabic content', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('تصفح المنتجات');

    await expect(page.locator('aside.filter-sidebar')).toBeVisible();

    const hasListings = await page.locator('.grid-listings').isVisible().catch(() => false);
    const hasEmpty = await page.locator('.empty-state').isVisible().catch(() => false);
    expect(hasListings || hasEmpty).toBe(true);
  });

  test('city filter dropdown contains all Palestinian cities', async ({ page }) => {
    const citySelect = page.locator('select[name="city"]');
    await expect(citySelect).toBeVisible();

    const cities = ['Gaza', 'Ramallah', 'Nablus', 'Hebron', 'Jenin', 'Jerusalem'];
    for (const city of cities) {
      await expect(citySelect.locator(`option[value="${city}"]`)).toHaveCount(1);
    }
  });

  test('condition filter options are all present', async ({ page }) => {
    const conditionSelect = page.locator('select[name="condition"]');
    await expect(conditionSelect).toBeVisible();

    const conditionValues = ['NEW', 'LIKE_NEW', 'GOOD', 'USED', 'FAIR', 'FOR_PARTS'];
    for (const val of conditionValues) {
      await expect(conditionSelect.locator(`option[value="${val}"]`)).toHaveCount(1);
    }
  });

  test('sort options are all present', async ({ page }) => {
    const sortSelect = page.locator('select[name="sort"]');
    await expect(sortSelect).toBeVisible();

    const sortValues = ['newest', 'oldest', 'price_asc', 'price_desc', 'popular'];
    for (const val of sortValues) {
      await expect(sortSelect.locator(`option[value="${val}"]`)).toHaveCount(1);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FLOW 6 — PRICING PAGE (GET only, no auth)
// ════════════════════════════════════════════════════════════════════════════
test.describe('Flow 6: Pricing page (no auth)', () => {
  // PENDING DEPLOY: /pricing route was added to routes/index.js locally but not deployed.
  // test.fail() passes while production returns 404; will flip to normal pass after deploy.
  test.fail('pricing page loads successfully — PENDING DEPLOY', async ({ page }) => {
    const resp = await page.goto('/pricing');
    expect(resp?.status()).toBe(200);
  });

  test('/upgrade redirects unauthenticated user to login (no 500)', async ({ page }) => {
    // /upgrade requires auth — unauthenticated user must be redirected, not error-paged.
    await page.goto('/upgrade');

    // Must redirect to login (not crash with 500)
    await expect(page).toHaveURL(/\/auth\/login/);

    const body = (await page.textContent('body')) ?? '';
    expect(body).not.toContain('500');
    expect(body).not.toContain('Something went wrong');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FLOW 7 — BROKEN LINKS CHECK (no auth)
// ════════════════════════════════════════════════════════════════════════════
test.describe('Flow 7: Broken links', () => {
  // PENDING DEPLOY: /buyer-protection route was added to routes/index.js locally but not deployed.
  // test.fail() passes while production returns 404; will flip to normal pass after deploy.
  test.fail('/buyer-protection must not return 404 — PENDING DEPLOY', async ({ page }) => {
    const resp = await page.goto('/buyer-protection');
    expect(resp?.status()).toBe(200);

    const body = (await page.textContent('body')) ?? '';
    expect(body).toContain('حماية المشتري');
  });

  test('all footer links return 200', async ({ page }) => {
    const actualFooterLinks = [
      { path: '/pages/about', label: 'About' },
      { path: '/pages/terms', label: 'Terms' },
      { path: '/pages/privacy', label: 'Privacy' },
      { path: '/pages/safety', label: 'Safety' },
    ];

    const broken = [];

    for (const { path, label } of actualFooterLinks) {
      const resp = await page.goto(path);
      const status = resp?.status();
      if (status !== 200) {
        broken.push(`${label} (${path}) → HTTP ${status}`);
      }
    }

    expect(broken, `Broken footer links:\n${broken.join('\n')}`).toHaveLength(0);
  });

  test('/pages/safety loads without error', async ({ page }) => {
    const resp = await page.goto('/pages/safety');
    expect(resp?.status()).toBe(200);

    const body = (await page.textContent('body')) ?? '';
    expect(body).not.toContain('500');
    expect(body).not.toContain('404');
  });

  test('/contact does not 500', async ({ page }) => {
    // /contact may not be implemented (404 expected) but must never 500.
    const resp = await page.goto('/contact');
    const status = resp?.status();
    expect(status).not.toBe(500);
    console.log(`/contact → HTTP ${status}`);
  });

  test('/forum does not 500', async ({ page }) => {
    // /forum may not be implemented (404 expected) but must never 500.
    const resp = await page.goto('/forum');
    const status = resp?.status();
    expect(status).not.toBe(500);
    console.log(`/forum → HTTP ${status}`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FLOW 8 — NAVIGATION & UI (no auth)
// ════════════════════════════════════════════════════════════════════════════
test.describe('Flow 8: Navigation & UI', () => {
  test('header renders correctly on all main pages', async ({ page }) => {
    const pagesToCheck = ['/whale', '/pages/safety', '/pages/about'];

    for (const path of pagesToCheck) {
      await page.goto(path);

      // Logo
      await expect(page.locator('a.navbar-brand[href="/"]')).toContainText('الحوت');

      // Login and register links attached to DOM
      await expect(page.locator('a[href="/auth/login"]').first()).toBeAttached();
      await expect(page.locator('a[href="/auth/register"]').first()).toBeAttached();

      // Language toggle (EN button visible in Arabic mode)
      await expect(page.locator('button[data-locale="en"]')).toBeVisible();

      // Dark mode toggle
      await expect(page.locator('button[data-theme-toggle]')).toBeVisible();
    }
  });

  test('mobile hamburger menu appears at 375px width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/whale');

    const hamburger = page.locator('.navbar-toggle');
    await expect(hamburger).toBeVisible();
    await expect(hamburger).toContainText('☰');

    // Nav links are in the DOM
    await expect(page.locator('.navbar-nav a[href="/whale"]')).toBeAttached();

    // Click hamburger — adds .open class, making nav links visible
    await hamburger.click();

    await expect(page.locator('.navbar-nav')).toBeVisible({ timeout: 5_000 });
  });
});
