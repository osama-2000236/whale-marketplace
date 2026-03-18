const fs = require('fs/promises');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');
const { loginAs } = require('../helpers/auth');

test('UI consistency rules report is generated with pass/fail statuses', async ({ page }) => {
  const checks = [];

  const addCheck = (name, pass, detail = '') => {
    checks.push({ name, pass: Boolean(pass), detail });
  };

  await page.goto('/whale');
  await page.waitForLoadState('domcontentloaded');

  const whaleStats = await page.evaluate(() => {
    const bodyStyle = window.getComputedStyle(document.body);
    const navbarLogoVisible = Boolean(document.querySelector('.whale-logo svg'));
    const hasNis = /₪/.test(document.body.textContent || '');
    const tinyTextCount = Array.from(document.querySelectorAll('p, span, a, button, label'))
      .filter((el) => el.offsetParent !== null)
      .filter((el) => Number.parseFloat(window.getComputedStyle(el).fontSize) < 12).length;
    const hasDirAuto = document.querySelectorAll('.listing-title[dir="auto"]').length > 0;
    const hasHorizontalScroll =
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    const primaryBtn = document.querySelector('.btn-primary');
    const primaryBtnColor = primaryBtn ? window.getComputedStyle(primaryBtn).backgroundColor : '';
    const priceEl = document.querySelector('.listing-price');
    const priceWeight = priceEl ? Number.parseInt(window.getComputedStyle(priceEl).fontWeight, 10) : 700;
    const logoText = (document.body.textContent || '').includes('Whale');
    const cardPaddingOk = Array.from(document.querySelectorAll('.listing-body')).every((el) => {
      const s = window.getComputedStyle(el);
      return (
        Number.parseFloat(s.paddingTop) >= 10 &&
        Number.parseFloat(s.paddingRight) >= 10 &&
        Number.parseFloat(s.paddingBottom) >= 10 &&
        Number.parseFloat(s.paddingLeft) >= 10
      );
    });

    return {
      bodyBackground: bodyStyle.backgroundColor,
      navbarLogoVisible,
      hasNis,
      tinyTextCount,
      hasDirAuto,
      hasHorizontalScroll,
      primaryBtnColor,
      priceWeight,
      logoText,
      cardPaddingOk
    };
  });

  addCheck(
    'COLORS: Background uses controlled palette',
    /242,\s*247,\s*250|255,\s*255,\s*255/.test(whaleStats.bodyBackground),
    whaleStats.bodyBackground
  );
  addCheck(
    'COLORS: Primary buttons use ocean/wave palette',
    /10,\s*75,\s*110|20,\s*114,\s*163/.test(whaleStats.primaryBtnColor),
    whaleStats.primaryBtnColor
  );
  addCheck('TYPOGRAPHY: No visible text below 12px', whaleStats.tinyTextCount === 0, String(whaleStats.tinyTextCount));
  addCheck('TYPOGRAPHY: Price values are bold', whaleStats.priceWeight >= 700, String(whaleStats.priceWeight));
  addCheck('TYPOGRAPHY: dir="auto" on listing user content', whaleStats.hasDirAuto);
  addCheck('SPACING: Listing cards have padding >= 10px', whaleStats.cardPaddingOk);
  addCheck('WHALE BRAND: Logo visible in navbar', whaleStats.navbarLogoVisible);
  addCheck('WHALE BRAND: Whale naming appears on page', whaleStats.logoText);
  addCheck('WHALE BRAND: Prices include ₪ symbol', whaleStats.hasNis);
  addCheck('MOBILE/DESKTOP: No horizontal scroll on default view', !whaleStats.hasHorizontalScroll);

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/whale');
  const mobileStats = await page.evaluate(() => {
    const hasHorizontalScroll =
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    const mobileNav = document.querySelector('.mobile-nav');
    const mobileNavVisible = !!mobileNav && window.getComputedStyle(mobileNav).display !== 'none';
    const minButtonHeight = Math.min(
      ...Array.from(document.querySelectorAll('button, .btn, .mobile-nav a'))
        .filter((el) => el.offsetParent !== null)
        .map((el) => el.getBoundingClientRect().height)
    );
    return { hasHorizontalScroll, mobileNavVisible, minButtonHeight };
  });

  addCheck('MOBILE: No content cut off at 320px', !mobileStats.hasHorizontalScroll);
  addCheck('MOBILE: Bottom nav is visible', mobileStats.mobileNavVisible);
  addCheck('MOBILE: Buttons are at least 36px tall', mobileStats.minButtonHeight >= 36, String(mobileStats.minButtonHeight));

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/auth/login');
  const loginStats = await page.evaluate(() => {
    const formInputs = Array.from(
      document.querySelectorAll('input:not([type="hidden"]):not([type="submit"])')
    );
    const unlabeled = formInputs.filter((input) => {
      const id = input.id;
      const label = id ? document.querySelector(`label[for="${id}"]`) : null;
      const placeholder = input.getAttribute('placeholder');
      return !label && !placeholder && !input.getAttribute('aria-label');
    }).length;
    const navLinks = document.querySelectorAll('.whale-nav-links a').length;
    return { unlabeled, navLinks };
  });

  addCheck('ACCESSIBILITY: Login fields have labels/placeholders', loginStats.unlabeled === 0, String(loginStats.unlabeled));
  addCheck('RULE 1: Login page has no full navigation menu', loginStats.navLinks <= 2, String(loginStats.navLinks));

  await loginAs(page, 'uitest_pro', 'uitestpass');
  const prisma = new PrismaClient();
  try {
    const proUser = await prisma.user.findUnique({
      where: { username: 'uitest_pro' },
      select: { id: true }
    });

    const orders = proUser
      ? await prisma.order.findMany({
          where: {
            OR: [{ sellerId: proUser.id }, { buyerId: proUser.id }]
          },
          take: 20,
          select: { orderNumber: true }
        })
      : [];

    const hasOrders = orders.length > 0;
    const allMatch = hasOrders && orders.every((o) => /^WH-\d{4}-\d{5}$/.test(o.orderNumber));
    addCheck(
      'RULE 8: Order numbers use WH-YYYY-NNNNN format',
      allMatch,
      hasOrders ? String(orders.length) : 'no orders'
    );
  } finally {
    await prisma.$disconnect();
  }

  const reportLines = [];
  reportLines.push('UI Consistency Report');
  reportLines.push(`Generated: ${new Date().toISOString()}`);
  reportLines.push('');
  for (const check of checks) {
    reportLines.push(`[${check.pass ? 'PASS' : 'FAIL'}] ${check.name}${check.detail ? ` (${check.detail})` : ''}`);
  }

  const failed = checks.filter((c) => !c.pass);
  reportLines.push('');
  reportLines.push(`Summary: ${checks.length - failed.length}/${checks.length} passed`);

  const reportPath = path.join(process.cwd(), 'ui-consistency-report.txt');
  await fs.writeFile(reportPath, reportLines.join('\n'), 'utf8');

  expect(checks.length).toBeGreaterThan(0);
  expect(failed).toHaveLength(0);
  expect(await fs.readFile(reportPath, 'utf8')).toContain('UI Consistency Report');
});
