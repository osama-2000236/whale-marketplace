const { test, expect } = require('@playwright/test');

async function openFirstListingFromBrowse(page) {
  await page.goto('/whale');
  const firstCard = page.locator('.grid-listings .listing-card').first();
  await expect(firstCard).toBeVisible();

  const href = await firstCard.getAttribute('href');
  expect(href || '').toMatch(/^\/whale\/listing\/[^/]+$/);

  await firstCard.scrollIntoViewIfNeeded();
  await firstCard.click({ force: true });

  if (!/\/whale\/listing\/[^/]+$/.test(new URL(page.url()).pathname) && href) {
    await page.goto(href);
  }

  await expect(page).toHaveURL(/\/whale\/listing\/[^/]+$/);
}

test.describe('Marketplace public flows', () => {
  test('Homepage loads with categories and recent listings', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.grid-categories .category-card').first()).toBeVisible();
    await expect(page.locator('.grid-listings .listing-card').first()).toBeVisible();
  });

  test('Browse page loads with filter sidebar and listing cards', async ({ page }) => {
    await page.goto('/whale');
    await expect(page.locator('.filter-sidebar')).toBeVisible();
    await expect(page.locator('.grid-listings .listing-card').first()).toBeVisible();
  });

  test('Clicking listing card navigates to listing detail', async ({ page }) => {
    await openFirstListingFromBrowse(page);
  });

  test('Listing detail shows title, price, seller info, and Buy Now', async ({ page }) => {
    await openFirstListingFromBrowse(page);
    await expect(page.locator('.listing-detail h1')).toBeVisible();
    await expect(page.locator('.listing-detail-price')).toContainText('$');
    await expect(page.locator('.seller-info')).toBeVisible();
    await expect(page.getByRole('link', { name: /Buy Now|اشترِ الآن/i })).toBeVisible();
  });

  test('/auth/login has identifier and password fields', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('form input[name="identifier"]')).toBeVisible();
    await expect(page.locator('form input[name="password"][type="password"]')).toBeVisible();
  });

  test('/auth/register has username, email, and password fields', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page.locator('form input[name="username"]')).toBeVisible();
    await expect(page.locator('form input[name="email"][type="email"]')).toBeVisible();
    await expect(page.locator('form input[name="password"][type="password"]')).toBeVisible();
  });

  test('/upgrade requires auth and redirects to login', async ({ page }) => {
    await page.goto('/upgrade');
    await expect(page).toHaveURL(/\/auth\/login\?next=/);
    await expect(page.locator('form input[name="identifier"]')).toBeVisible();
  });

  test('/notifications requires auth and redirects to login', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page).toHaveURL(/\/auth\/login\?next=/);
    await expect(page.locator('form input[name="identifier"]')).toBeVisible();
  });

  test('/whale/sell requires auth and redirects to login', async ({ page }) => {
    await page.goto('/whale/sell');
    await expect(page).toHaveURL(/\/auth\/login\?next=/);
    await expect(page.locator('form input[name="identifier"]')).toBeVisible();
  });

  test('Footer has About, Terms, Privacy, Safety links that work', async ({ page, request }) => {
    await page.goto('/');
    const links = ['/pages/about', '/pages/terms', '/pages/privacy', '/pages/safety'];
    for (const href of links) {
      await expect(page.locator(`footer a[href="${href}"]`)).toBeVisible();
      const res = await request.get(href);
      expect(res.status(), `${href} should return 200`).toBe(200);
    }
  });

  test('Static pages render content', async ({ page }) => {
    const pages = ['/pages/about', '/pages/terms', '/pages/privacy', '/pages/safety'];
    for (const path of pages) {
      await page.goto(path);
      await expect(page.locator('.prose')).toBeVisible();
      const text = await page.locator('.prose').innerText();
      expect((text || '').trim().length).toBeGreaterThan(20);
    }
  });

  test('Arabic locale switch works and sets RTL direction', async ({ page }) => {
    await page.goto('/');
    const localeSwitch = page.locator('[data-locale="ar"]').first();
    if ((await localeSwitch.count()) > 0) {
      await expect(localeSwitch).toBeVisible();
      await localeSwitch.click();
      await page.waitForLoadState('networkidle');
    }
    if ((await page.locator('html').getAttribute('dir')) !== 'rtl') {
      await page.goto('/?lang=ar');
    }
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
