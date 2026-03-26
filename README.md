# UI/UX QA Test Suite — Node.js / Playwright

## Overview

A comprehensive, strict UI/UX quality assurance suite built with **Playwright**.  
Covers **15 test categories** with **80+ individual assertions**.

---

## Test Categories

| #   | Category                      | Tests |
| --- | ----------------------------- | ----- |
| 1   | Layout & Visual Integrity     | 10    |
| 2   | Typography                    | 7     |
| 3   | Responsiveness                | 6     |
| 4   | Navigation & Routing          | 7     |
| 5   | Forms & Input Validation      | 10    |
| 6   | Accessibility (WCAG 2.1)      | 10    |
| 7   | Performance & Core Web Vitals | 8     |
| 8   | Interactions & Micro-UX       | 10    |
| 9   | Dark Mode & Theming           | 4     |
| 10  | Error States & Empty States   | 5     |
| 11  | Security & Meta Tags          | 6     |
| 12  | Cross-Browser Compatibility   | 3     |
| 13  | Localization (i18n)           | 4     |
| 14  | Print Styles                  | 2     |
| 15  | Scroll & Animation            | 4     |

---

## Setup

```bash
# 1. Install dependencies
npm install -D @playwright/test

# 2. Install browsers
npx playwright install

# 3. Set your app URL
export BASE_URL=http://localhost:3000

# 4. Start your app (in another terminal)
npm start
```

---

## Running Tests

```bash
# All tests, all browsers
npx playwright test

# Specific category only
npx playwright test --grep "5. Forms"

# Single browser
npx playwright test --project=chromium

# Mobile only
npx playwright test --project=mobile-chrome

# With HTML report
npx playwright test --reporter=html && npx playwright show-report

# Strict CI mode (no retries shown)
CI=true npx playwright test
```

---

## Key Standards Enforced

| Standard         | Threshold              |
| ---------------- | ---------------------- |
| WCAG AA Contrast | ≥ 4.5:1                |
| Touch Targets    | ≥ 44×44px (WCAG 2.5.5) |
| FCP              | < 1,800ms              |
| DOM Content Load | < 3,000ms              |
| TTFB             | < 800ms                |
| Page Weight      | < 5MB                  |
| H1 per page      | Exactly 1              |
| Body font        | ≥ 14px                 |
| Line height      | ≥ 1.4                  |
| Heading jumps    | No skipped levels      |

---

## Customization for Your Project

Search for these comments to add project-specific selectors:

- `[data-testid='open-modal']` → your modal trigger
- `[data-testid='theme-toggle']` → your dark mode button
- `[data-testid='empty-state']` → your empty list component
- `/login` → your authentication route
- `/about` → any secondary route for nav testing

---

## CI Integration (GitHub Actions)

```yaml
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run UI/UX QA Tests
  run: BASE_URL=http://localhost:3000 npx playwright test
  env:
    CI: true

- name: Upload Report
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```
