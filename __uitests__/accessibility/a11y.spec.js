const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const PAGES_TO_CHECK = [
  { name: 'Login', url: '/auth/login' },
  { name: 'Register', url: '/auth/register' },
  { name: 'Marketplace', url: '/whale' },
  { name: 'Homepage', url: '/' },
  { name: 'ForumRedirect', url: '/forum' }
];

for (const { name, url } of PAGES_TO_CHECK) {
  test(`@accessibility ${name} page: no critical axe violations`, async ({ page }) => {
    await page.goto(url);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const critical = results.violations.filter((v) => ['critical', 'serious'].includes(v.impact || ''));
    expect(critical).toHaveLength(0);
  });
}

test('@accessibility all listing images have alt text', async ({ page }) => {
  await page.goto('/whale');
  const missingAlt = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs
      .filter((img) => {
        const alt = img.getAttribute('alt');
        const role = img.getAttribute('role');
        const ariaLabel = img.getAttribute('aria-label');
        return !alt && !ariaLabel && role !== 'presentation';
      })
      .map((img) => img.src);
  });
  expect(missingAlt).toHaveLength(0);
});

test('@accessibility all form inputs have labels or placeholders', async ({ page }) => {
  await page.goto('/auth/login');
  const unlabeled = await page.evaluate(() => {
    const inputs = Array.from(
      document.querySelectorAll('input:not([type="hidden"]):not([type="submit"])')
    );
    return inputs
      .filter((input) => {
        const id = input.id;
        const label = id ? document.querySelector(`label[for="${id}"]`) : null;
        const ariaLabel = input.getAttribute('aria-label');
        const placeholder = input.getAttribute('placeholder');
        return !label && !ariaLabel && !placeholder;
      })
      .map((i) => ({ name: i.name, type: i.type }));
  });
  expect(unlabeled).toHaveLength(0);
});

test('@accessibility page has a main landmark', async ({ page }) => {
  await page.goto('/whale');
  const hasMain = await page.evaluate(() => {
    return Boolean(document.querySelector('main') || document.querySelector('[role="main"]'));
  });
  expect(hasMain).toBe(true);
});

test('@accessibility keyboard focusable elements exist', async ({ page }) => {
  await page.goto('/whale');
  const firstFocusable = await page.evaluate(() => {
    const el = document.querySelector('a, button, input, [tabindex]');
    return Boolean(el);
  });
  expect(firstFocusable).toBe(true);
});

test('@accessibility color is not sole status indicator', async ({ page }) => {
  await page.goto('/whale');
  const colorOnlyBadges = await page.evaluate(() => {
    const badges = document.querySelectorAll('.status-badge, .badge, .status-pill');
    return Array.from(badges).filter((b) => (b.textContent || '').trim().length === 0).length;
  });
  expect(colorOnlyBadges).toBe(0);
});

