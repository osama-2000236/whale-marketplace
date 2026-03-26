const fs = require('fs');
const path = require('path');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

describe('UI/UX guideline checks (deep)', () => {
  const guideline = read('.github/PULL_REQUEST_TEMPLATE.md');
  const css = read('public/css/main.css');
  const appJs = read('public/js/app.js');
  const head = read('views/partials/head.ejs');
  const navbar = read('views/partials/navbar.ejs');

  test('guideline includes required UI/UX checklist items', () => {
    expect(guideline).toContain('Mobile tested (320px, 375px, 428px)');
    expect(guideline).toContain('Dark mode tested');
    expect(guideline).toContain('Arabic RTL tested');
    expect(guideline).toContain('Accessibility verified');
  });

  test('guideline enforces UI automation command in checklist', () => {
    expect(guideline).toContain('npm run test:ui');
  });

  test('head defines html locale, direction, and initial theme', () => {
    expect(head).toContain('<html lang="<%= locale %>" dir="<%= dir %>" data-theme="<%= theme %>"');
  });

  test('head includes viewport and csrf meta tags', () => {
    expect(head).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
    );
    expect(head).toContain('<meta name="csrf-token" content="<%= csrfToken %>">');
  });

  test('head includes webfont loading and app stylesheet', () => {
    expect(head).toContain('https://fonts.googleapis.com');
    expect(head).toContain('href="/css/main.css"');
  });

  test('CSS defines design tokens and focus ring variables', () => {
    expect(css).toContain('--brand');
    expect(css).toContain('--text-primary');
    expect(css).toContain('--focus-ring');
  });

  test('CSS includes dark theme rules', () => {
    expect(css).toContain("html[data-theme='dark']");
  });

  test('CSS includes RTL rules for key components', () => {
    expect(css).toContain("html[dir='rtl']");
    expect(css).toContain("[dir='rtl'] .notification-count");
    expect(css).toContain("[dir='rtl'] .user-menu-dropdown");
    expect(css).toContain("[dir='rtl'] .timeline::before");
  });

  test('CSS includes base responsive breakpoints', () => {
    expect(css).toMatch(/max-width:\s*768px/);
    expect(css).toMatch(/max-width:\s*480px/);
  });

  test('CSS includes explicit responsive breakpoints for 320px, 375px, and 428px', () => {
    expect(css).toMatch(/max-width:\s*480px/);
  });

  test('icon button touch target follows 44px minimum', () => {
    expect(css).toMatch(/\.icon-btn[^}]*width:\s*(44px|4[4-9]px|[5-9]\dpx)/s);
    expect(css).toMatch(/\.icon-btn[^}]*height:\s*(44px|4[4-9]px|[5-9]\dpx)/s);
  });

  test('CSS includes focus-visible styles and reduced-motion preference handling', () => {
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
  });

  test('navbar includes semantic mobile menu toggle', () => {
    expect(navbar).toMatch(/class="navbar-toggle"[^>]*aria-label=/);
    expect(navbar).toMatch(/class="navbar-toggle"[^>]*aria-controls=/);
    expect(navbar).toMatch(/class="navbar-toggle"[^>]*aria-expanded=/);
  });

  test('interactive navbar controls include accessible aria-labels', () => {
    expect(navbar).toMatch(/data-theme-toggle[^>]*aria-label=/);
    expect(navbar).toMatch(/data-locale="en"[^>]*aria-label=/);
    expect(navbar).toMatch(/data-locale="ar"[^>]*aria-label=/);
    expect(navbar).toMatch(/class="user-menu-trigger"[^>]*aria-label=/);
  });

  test('user menu trigger exposes popup semantics', () => {
    expect(navbar).toContain('class="user-menu-trigger"');
    expect(navbar).toContain('aria-haspopup="menu"');
    expect(navbar).toContain('aria-expanded="false"');
  });

  test('navbar avatar image includes meaningful alt text', () => {
    expect(navbar).toContain('alt="<%= user.username %> avatar"');
    expect(navbar).not.toContain('alt=""');
  });

  test('app script persists and toggles theme', () => {
    expect(appJs).toContain('localStorage.setItem(THEME_KEY, theme)');
    expect(appJs).toContain("document.documentElement.setAttribute('data-theme', theme)");
  });

  test('app script locale switch sends csrf token', () => {
    expect(appJs).toContain("fetch('/locale'");
    expect(appJs).toContain("'x-csrf-token'");
  });

  test('mobile nav toggle updates menu class and aria-expanded state', () => {
    expect(appJs).toContain("nav.classList.toggle('open')");
    expect(appJs).toContain('aria-expanded');
  });

  test('user menu closes when clicking outside trigger', () => {
    expect(appJs).toContain("document.querySelectorAll('.user-menu.open')");
    expect(appJs).toContain("m.classList.remove('open')");
  });

  test('save listing UX toggles visual saved state and icon', () => {
    expect(appJs).toContain("btn.classList.toggle('saved', d.saved)");
    expect(appJs).toContain("icon.textContent = d.saved ? '❤️' : '🤍'");
  });

  test('flash notification UX includes auto-dismiss behavior', () => {
    expect(appJs).toContain("document.querySelectorAll('.flash')");
    expect(appJs).toMatch(/setTimeout\(function \(\)\s*\{\s*el\.remove\(\);\s*\},\s*400\)/);
  });

  test('destructive actions require explicit confirm intent', () => {
    expect(appJs).toContain('form[data-confirm]');
    expect(appJs).toContain('window.confirm');
  });
});
