# QA Test Report — Whale Marketplace
**Date:** 2026-03-29
**Tester:** Codex (GPT-5.4) + GitHub MCP
**Target:** http://127.0.0.1:3000
**Branch:** codex/qa-playwright-suite

## Results Summary
| Total | Passed | Failed | Skipped |
|-------|--------|--------|---------|
| 124 | 124 | 0 | 0 |

The suite now runs end to end on localhost through Playwright's `webServer` support. This branch also fixes the previously identified gaps:
- register now validates confirm-password
- listing detail now renders category metadata
- locale switching no longer stays pinned by a stale `?lang=` query
- sell coverage runs without external verified-seller credentials

## Routes Tested
| Route | Status Code | Auth Required | Notes |
|-------|-------------|---------------|-------|
| `/` | 200 | No | Homepage loads normally. |
| `/whale` | 200 | No | Browse page loads normally. |
| `/whale?category=electronics` | 200 | No | Category filter loads. |
| `/whale?category=vehicles` | 200 | No | Category filter loads. |
| `/whale?category=real-estate` | 200 | No | Category filter loads. |
| `/whale?category=fashion` | 200 | No | Category filter loads. |
| `/whale?category=home-garden` | 200 | No | Category filter loads. |
| `/whale?category=sports` | 200 | No | Category filter loads. |
| `/whale/listing/playstation-5-bundle-vio2x` | 200 | No | Listing detail loads with category metadata. |
| `/whale/listing/apartment-for-sale-in-ramallah-g900n` | 200 | No | Listing detail loads normally. |
| `/whale/listing/mountain-bike-trek-2cb6o` | 200 | No | Listing detail loads normally. |
| `/auth/login` | 200 | No | Login page loads normally. |
| `/auth/register` | 200 | No | Register page loads with confirm-password field. |
| `/whale/sell` | 302 | Yes | Redirects to `/auth/login?next=%2Fwhale%2Fsell` when anonymous. |
| `/pages/about` | 200 | No | Static content page loads. |
| `/pages/terms` | 200 | No | Static content page loads. |
| `/pages/privacy` | 200 | No | Static content page loads. |
| `/pages/safety` | 200 | No | Static content page loads. |
| `/whale/listing/fake-slug-does-not-exist` | 404 | No | Invalid slug returns error page without crashing. |

## Bug Log
| # | File | Test | Severity | Expected | Actual |
|---|------|------|----------|----------|--------|
| None | - | - | - | - | No failing E2E cases remain in the localhost verification run. |

## Selector Notes
- Login form: `form[action="/auth/login"]`, `input[name="identifier"]`, `input[name="password"]`
- Register form: `form[action="/auth/register"]`, `input[name="username"]`, `input[name="email"]`, `input[name="password"]`, `input[name="confirmPassword"]`
- Browse filters: `.filter-sidebar`, `.filter-form`, `select[name="category"]`, `select[name="city"]`, `select[name="condition"]`, `select[name="sort"]`
- Listing cards: `.grid-listings .listing-card`
- Theme toggle: `[data-theme-toggle]`
- Locale toggle: `[data-locale]`
- Mobile nav toggle: `.navbar-toggle`
- Sell form: `form[action^="/whale/sell"]`
- Listing category metadata: `.listing-detail-category`
- Static content wrapper: `.prose`
- Listing 404 state: `.empty-state h3`

## Recommendations
- Deploy this branch before using the updated suite against a hosted environment.
- Keep the localhost-first Playwright workflow as the default and override `PLAYWRIGHT_BASE_URL` only when a deployment is intentionally under test.
- If a real database is not available, preserve the no-database fallback runtime so core flows remain testable in development and CI.

## How to Run Locally
```bash
npm install
npx prisma generate
npx playwright install --with-deps chromium
npx playwright test
npx playwright show-report
```

## How to Run Against Hosted
```bash
PLAYWRIGHT_BASE_URL=https://whale-marketplace-production.up.railway.app npx playwright test
npx playwright show-report
```
