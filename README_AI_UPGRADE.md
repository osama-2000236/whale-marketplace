# Whale AI Upgrade README

This file is for AI coding agents (Codex/Claude/Cursor) to continue upgrading the project safely.

## 1) Product and Goal

Whale (الحوت) is a trust-first marketplace for Palestine and Arab cities.

Core promise (must never be removed):

> أموالك محفوظة حتى تؤكد الاستلام  
> Your money is protected until you confirm delivery.

Primary objective now: improve Whale UX/conversion quality while keeping backend stability and security.

---

## 2) Current Runtime State (March 17, 2026)

- `/` redirects to `/whale`
- Whale routes are primary runtime (`routes/whale.js`)
- Static info pages are active:
  - `/about`, `/contact`, `/safety`, `/pricing`, `/terms`, `/privacy`, `/forum`
- Language + theme preferences are active:
  - `POST /prefs/lang`
  - `POST /prefs/theme`
- Locale middleware injects:
  - `lang`, `dir`, `theme`, `t()`, `cities`, `bodyClass`

### Production launch modules now active

- OAuth social login (env-gated):
  - `/auth/google`, `/auth/google/callback`
  - `/auth/facebook`, `/auth/facebook/callback`
  - `/auth/apple`, `/auth/apple/callback` (POST callback, CSRF-bypassed path only)
- Transactional email service:
  - welcome, order placed/confirmed/shipped/completed, trial-ending, reset-password
  - provider abstraction: SendGrid or SMTP fallback
- SEO indexing:
  - listing slug support via `/whale/listing/:idOrSlug`
  - `/sitemap.xml`, `/robots.txt`
  - JSON-LD product block rendered from listing view data
- Session cart MVP:
  - `/whale/cart`
  - `/whale/cart/add`
  - `/whale/cart/remove`
  - `/whale/cart/checkout`
- Search autocomplete:
  - `/whale/search/suggestions?q=...`
- Legal pages:
  - `/terms`, `/privacy`, `/buyer-protection`, `/unsubscribe`

---

## 3) Architecture Rules (Do Not Violate)

1. Business logic in `services/` only.
2. Routes stay thin; call service methods.
3. CSRF is required on all state-changing forms.
4. Keep `optionalAuth` on browse pages and `requireAuth` on actions.
5. Keep `dir="auto"` on user content.
6. Keep cursor pagination on listing feeds.
7. Keep order state transitions valid (`PENDING -> SELLER_CONFIRMED -> SHIPPED -> COMPLETED`).

---

## 4) Key Files

Backend:
- [server.js](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/server.js)
- [routes/whale.js](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/routes/whale.js)
- [routes/pages.js](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/routes/pages.js)
- [routes/prefs.js](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/routes/prefs.js)
- [services/whaleService.js](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/services/whaleService.js)
- [middleware/locale.js](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/middleware/locale.js)
- [lib/i18n.js](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/lib/i18n.js)
- [lib/cities.js](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/lib/cities.js)
- [prisma/seed.js](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/prisma/seed.js)

Views/UI:
- [views/whale/index.ejs](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/views/whale/index.ejs)
- [views/whale/listing.ejs](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/views/whale/listing.ejs)
- [views/partials/head.ejs](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/views/partials/head.ejs)
- [views/partials/navbar.ejs](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/views/partials/navbar.ejs)
- [views/partials/footer.ejs](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/views/partials/footer.ejs)
- [views/partials/foot.ejs](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/views/partials/foot.ejs)
- [public/css/community.css](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/public/css/community.css)

---

## 5) Setup and Run

```bash
npm install
npm run prisma:generate
npm run seed
npm run dev
```

### OAuth Setup (Local)

Set these in `.env` before testing social login:

```env
OAUTH_CALLBACK_BASE=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
APPLE_CLIENT_ID=...
APPLE_TEAM_ID=...
APPLE_KEY_ID=...
APPLE_PRIVATE_KEY_PATH=./keys/AuthKey_XXXXXXXXXX.p8
```

Local callbacks:
- `http://localhost:3000/auth/google/callback`
- `http://localhost:3000/auth/facebook/callback`
- `http://localhost:3000/auth/apple/callback` (POST)

If provider keys are missing, local email/password auth still works and OAuth buttons are hidden.

### Email provider setup (local/dev)

Use SMTP for local testing:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=noreply@whale.ps
EMAIL_FROM_NAME=Whale · الحوت
```

Or SendGrid:

```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG....
EMAIL_FROM=noreply@whale.ps
EMAIL_FROM_NAME=Whale · الحوت
```

### Anthropic Claude setup (local/dev)

Set these in `.env`:

```env
CLAUDE_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_real_api_key
ANTHROPIC_MODEL=claude-sonnet-4-6
```

Notes:
- Keep the key server-side only.
- `.env` is already ignored by Git in this repo.
- Use the local CLI check to verify the key:

```bash
npm run claude:check -- "Explain the next upgrade for Whale in Arabic and English"
```

This uses [services/claudeService.js](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/services/claudeService.js) and does not expose the key to the browser.

### OpenRouter Claude setup (alternative)

If your key starts with `sk-or-v1-`, it belongs to OpenRouter, not Anthropic directly.

```env
CLAUDE_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=anthropic/claude-sonnet-4.6
```

The Claude service auto-detects OpenRouter keys, but setting `CLAUDE_PROVIDER=openrouter` is cleaner.

---

## 6) Test Commands (Required)

Backend:
```bash
npm run test
npm run test:unit
npm run test:component
npm run test:integration
npm run test:security
```

UI:
```bash
npm run test:ui
npx playwright test __uitests__/pages/whale-marketplace.spec.js --project="Desktop Chrome"
npx playwright test __uitests__/layout/spacing.spec.js --project="Desktop Chrome"
npx playwright test __uitests__/responsive/breakpoints.spec.js --project="Desktop Chrome"
npx playwright test __uitests__/interactions/components.spec.js --project="Desktop Chrome"
npx playwright test __uitests__/visual/typography.spec.js --project="Desktop Chrome"
```

---

## 7) Known Important Notes

- In some environments, remote font loading can be blocked. Typography test already includes fallback checks for `Plus Jakarta Sans`.
- Legacy route files still exist in repo; do not delete blindly without migration plan.
- If changing navbar classes, keep selector compatibility used by UI tests (`.whale-nav-links` and `.nav-links`).
- Apple OAuth callback is POST-only. Keep `/auth/apple/callback` flow and CSRF bypass exception aligned.

---

## 8) Launch Validation Quicklist

1. Run migrations and client:
```bash
npm run prisma:generate
npm run prisma:deploy
```
2. Confirm key runtime routes:
   - `/whale`, `/whale/listing/:idOrSlug`, `/whale/cart`
   - `/sitemap.xml`, `/robots.txt`
   - `/terms`, `/privacy`, `/buyer-protection`
3. Run full regression:
```bash
npm run test
npm run test:ui
```

---

## 9) Upgrade Priorities (Next)

1. Replace remaining hardcoded bilingual literals in Whale views with `t()` keys.
2. Add dedicated seller analytics widgets (views, wa-clicks, save-to-order conversion).
3. Improve listing detail visual hierarchy (trust blocks, review readability, CTA contrast).
4. Add full dark-mode QA sweep across all Whale views.
5. Add UI skeleton loading states for async actions.

---

## 10) AI Execution Prompt (Copy/Paste)

Use this with your AI agent:

```text
You are upgrading Whale marketplace. Read README_AI_UPGRADE.md first, then AI_HANDOFF.md.
Do not break CSRF/session/auth flows.
Keep business logic in services, routes thin.
Preserve trust promise text and bilingual behavior.
Implement requested UX improvements, run focused Playwright tests after each section, and report exact pass/fail counts.
```
