# CLAUDE.md — Whale Marketplace

This file provides AI assistants (Claude, Copilot, etc.) with the information needed to work effectively in this codebase.

---

## Project Overview

**Whale Marketplace** is a trust-first peer-to-peer marketplace built for Palestine and Arab cities.
Core promise: _"Your money is protected until you confirm delivery."_

- Runtime: Node.js 20 + Express.js
- Template engine: EJS (server-rendered, no React/Vue)
- Database: PostgreSQL 16+ via Prisma 6 ORM
- Deployed on Railway via Docker (node:20-alpine)
- Primary runtime is **Whale v2** — all legacy routes redirect to `/whale`

---

## Repository Structure

```
/routes          – Express route handlers (thin; dispatch to services only)
/services        – All business logic (whaleService.js is the primary)
/middleware      – auth, subscription, locale
/views           – EJS templates organised by feature (whale/, auth/, admin/, forum/, etc.)
/public          – Static assets (CSS, JS, images, uploads)
/lib             – Singletons: Prisma client, Passport strategies, i18n, cities
/utils           – Pure utility functions: sanitize, text, images, cache, pagination, upload
/prisma          – schema.prisma + migrations + seed.js
/data            – Static JSON: config, categories, products (seed fallback)
/__tests__       – Jest tests (unit, component, integration, security, smoke, deep)
/__uitests__     – Playwright E2E tests
/.github         – GitHub Actions CI/CD
server.js        – Express app entry point (security, sessions, CSRF, template locals)
entrypoint.js    – Docker entrypoint (runs prisma migrate deploy then server.js)
```

---

## Technology Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js 20 |
| Web framework | Express.js 4 |
| Templates | EJS 3 |
| ORM | Prisma 6 (PostgreSQL) |
| Auth | Passport.js — local + Google / Facebook / Apple OAuth |
| Sessions | express-session (7-day cookie) |
| Security | Helmet, csurf, express-rate-limit, bcryptjs, isomorphic-dompurify |
| Payments | Paymob (primary) / PayPal (fallback) |
| Email | SendGrid (primary) / Nodemailer SMTP (fallback) |
| Media | Cloudinary (optional) / local `/public/uploads` fallback |
| AI | Anthropic SDK (claude-sonnet-4-6) / OpenRouter fallback |
| Unit tests | Jest 30 + Supertest |
| E2E tests | Playwright 1.58 (Chrome, Firefox, Safari, Android) |
| Dev reload | Nodemon |

---

## Architecture Rules — Read Before Changing Code

1. **Routes stay thin.** Route handlers call services and render/redirect. Zero business logic in routes.
2. **All business logic lives in services.** Use Prisma transactions for multi-entity writes.
3. **Never break the order state machine.** Valid transitions are enforced in `services/whaleService.js`. Do not bypass them.
4. **Keep CSRF on all state-changing forms.** The only exceptions are webhook endpoints and the Apple OAuth callback (already configured in `server.js`).
5. **Always ship bilingual.** Every user-visible string needs both Arabic (`nameAr`, `titleAr`) and English variants. Use `res.locals.t()` for UI strings.
6. **Always use `dir="auto"` on user-generated content.** Never hardcode `dir="rtl"` or `dir="ltr"`.
7. **Sanitise all inputs.** Use `utils/sanitize.js` helpers (`sanitizeText`, `sanitizeInt`, `sanitizeTags`). Never trust raw `req.body` values in service calls.
8. **No N+1 queries.** Use Prisma `include`/`select`. Add indexes for new query paths.
9. **No secrets in code.** All secrets go in `.env` only.
10. **Do not remove legacy routes without a migration.** Old routes redirect to `/whale` — keep redirects in place.

---

## Key Files by Role

### Entry Points
- `server.js` — App bootstrap: Helmet, CORS, sessions, CSRF, rate-limit, template locals, home route
- `entrypoint.js` — Docker start: runs `prisma migrate deploy` then `server.js`

### Primary Business Logic
- `routes/whale.js` — Browse, listing detail, cart, orders, reviews, seller actions
- `services/whaleService.js` — All marketplace logic: filters, order state transitions, payments, anti-fraud

### Other Services
- `services/userService.js` — Registration, profile, verification, admin setup
- `services/emailService.js` — Transactional email (SendGrid/SMTP)
- `services/paymentService.js` — Payment status and webhook handling
- `services/claudeService.js` — AI integration (Anthropic or OpenRouter)
- `services/forumService.js` — Thread/reply CRUD and moderation
- `services/notificationService.js` — Notification persistence
- `services/cartService.js` — Session-based cart

### Middleware
- `middleware/auth.js` — `optionalAuth`, `requireAuth`, `requirePro` guards
- `middleware/subscription.js` — Subscription plan injection and auto-renew cron
- `middleware/locale.js` — Language (`ar`/`en`) and theme (`light`/`dark`) injection

### Libraries & Utilities
- `lib/prisma.js` — Prisma client singleton
- `lib/passport.js` — Passport strategy configuration
- `lib/i18n.js` — Translation strings (Arabic + English, ~84 KB)
- `lib/cities.js` — City/region data
- `utils/sanitize.js` — Input validation
- `utils/images.js` — Responsive image URLs (Cloudinary or local)
- `utils/text.js` — Direction detection, `timeAgo`, Arabic detection

### Database
- `prisma/schema.prisma` — 30+ models, enums, indexes
- `prisma/migrations/` — 4 migration files (init → subscriptions → whale v2 → OAuth/slugs)
- `prisma/seed.js` — Upserts admin, seeds categories, game rooms, sample data

---

## Database & Prisma

### Common Operations
```bash
# Apply pending migrations (dev)
npx prisma migrate dev --name <description>

# Apply migrations (production / CI)
npx prisma migrate deploy

# Open Prisma Studio
npx prisma studio

# Regenerate client after schema change
npm run prisma:generate

# Seed database
npm run seed
```

### Schema Conventions
- Bilingual fields: `name` (English) + `nameAr` (Arabic)
- Order states enum: `PENDING → SELLER_CONFIRMED → SHIPPED → DELIVERED → BUYER_CONFIRMED → COMPLETED` (+ `CANCELLED`, `DISPUTED`)
- Listing conditions enum: `NEW`, `LIKE_NEW`, `USED`, `GOOD`, `FAIR`, `FOR_PARTS`
- Always add indexes for fields used in `WHERE` / `ORDER BY` on large tables
- Use `@db.Text` for long user content fields
- Use transactions (`prisma.$transaction`) for any multi-model writes

### Safe Feature Workflow
1. Update `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <feature>`
3. Add/update service function in the relevant service file
4. Add/update route handler (thin — calls service only)
5. Add/update EJS view with bilingual strings
6. Write or update tests
7. Update this file if architecture changes

---

## Development Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Copy and fill environment variables
cp .env.example .env

# Seed database
npm run seed

# Start dev server (auto-reload)
npm run dev
```

Required `.env` variables for local development:
```
DATABASE_URL=postgresql://user:pass@localhost:5432/whale_dev
SESSION_SECRET=<64-char random string>
```

---

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session secret (min 64 chars in prod) |
| `CLOUDINARY_URL` | Optional; falls back to `/public/uploads` |
| `CLAUDE_PROVIDER` | `anthropic` or `openrouter` |
| `ANTHROPIC_API_KEY` | Claude API key |
| `ANTHROPIC_MODEL` | Defaults to `claude-sonnet-4-6` |
| `PAYMENT_PROVIDER` | `paymob` or `paypal` |
| `EMAIL_PROVIDER` | `sendgrid` or `smtp` |
| `ADMIN_EMAIL` / `ADMIN_PASS` | Used for seed/startup admin creation |
| `DEFAULT_LANG` | `ar` (default) or `en` |
| `DEFAULT_THEME` | `light` (default) or `dark` |

Production DATABASE_URL should include pool settings:
```
?connection_limit=10&pool_timeout=30
```

---

## Testing

### Jest (Unit / Component / Integration / Security)

```bash
npm test                    # All Jest tests
npm run test:unit           # services/, utils/
npm run test:component      # route handlers
npm run test:integration    # end-to-end flows (seller registration, purchase)
npm run test:security       # auth security, CSRF
npm run test:coverage       # with coverage report
npm run test:watch          # watch mode
```

**Test database safety:** The Jest setup file (`jest.setup.js`) refuses to run unless `DATABASE_URL` contains the string `_test`. Never point tests at a production database.

Test files live in `__tests__/` organised as:
```
helpers/        shared db and http utilities
unit/           services and utils
component/      route handler tests
integration/    multi-step flow tests
smoke/          all-routes endpoint checks
deep/           edge cases
security/       auth and CSRF
```

### Playwright (E2E UI Tests)

```bash
npm run test:ui             # All browsers
npm run test:ui:headed      # With visible browser
npm run test:ui:debug       # Debug mode
npm run test:ui:a11y        # Accessibility (@accessibility tag)
npm run test:ui:mobile      # Mobile browsers only
npm run test:ui:visual      # Visual/screenshot tests
npm run test:ui:perf        # Performance (Lighthouse, @performance tag)
```

Browsers: Desktop Chrome, Firefox; Mobile Safari, Chrome; Tablet Chrome.
UI test files live in `__uitests__/` organised by concern (pages, layout, responsive, interactions, visual, accessibility, performance, cross-browser).

### CI Gate
Both Jest and Playwright must pass before any merge. GitHub Actions runs on every push to `develop`.

---

## Code Conventions

### Naming
- `camelCase` — functions, variables, object properties
- `PascalCase` — classes, Prisma model names
- `snake_case` — database enum values
- `kebab-case` — URL slugs, CSS class names, filenames

### Services Pattern
```js
// Good — service function signature
async function createListing(userId, data) {
  // validate inputs via sanitize utils
  // use prisma transaction if touching multiple models
  // return plain object or throw Error with message
}
```

### Routes Pattern
```js
// Good — thin route handler
router.post('/whale/listings', requireAuth, async (req, res) => {
  try {
    const listing = await whaleService.createListing(req.user.id, req.body);
    res.redirect(`/whale/listing/${listing.slug}`);
  } catch (err) {
    res.render('whale/error', { message: err.message });
  }
});
```

### Template Locals Available in All Views
Injected by `server.js` and middleware:
- `user` — current user object (or null)
- `t(key)` — i18n translation function
- `config` — site config from `data/config.json`
- `notifications` — unread notifications count
- `getDirection(text)` — returns `'rtl'` or `'ltr'`
- `startsWithArabic(text)` — boolean
- `timeAgo(date)` — relative time string
- `imageSet(path, sizes)` — responsive srcset string

### i18n
- All UI strings must use `t('key')` in EJS templates
- Keys are defined in `lib/i18n.js` with `ar` and `en` entries
- User-generated content uses `dir="auto"` — never hardcode direction

### Security Checklist for New Features
- [ ] CSRF token on all POST/PUT/DELETE forms (`<input name="_csrf" value="<%- csrfToken %>">`)
- [ ] Inputs sanitised via `sanitizeText` / `sanitizeInt` / `sanitizeTags`
- [ ] Auth guards: `optionalAuth` for browsing, `requireAuth` for actions, `requirePro` for seller features
- [ ] Rate limiting already applied globally — verify it is not bypassed
- [ ] No raw user content rendered without sanitisation (`<%=` not `<%-` unless deliberately rendering HTML)

---

## Order State Machine

Valid transitions (enforced in `whaleService.js`):

```
PENDING
  → SELLER_CONFIRMED  (seller accepts)
  → CANCELLED         (seller rejects or buyer cancels before confirmation)

SELLER_CONFIRMED
  → SHIPPED           (seller marks shipped)
  → CANCELLED         (either party)

SHIPPED
  → DELIVERED         (shipping company / auto)
  → DISPUTED          (buyer opens dispute)

DELIVERED
  → BUYER_CONFIRMED   (buyer confirms receipt)
  → DISPUTED          (buyer opens dispute)

BUYER_CONFIRMED
  → COMPLETED         (funds released to seller)

DISPUTED
  → COMPLETED         (admin resolves in seller's favour)
  → CANCELLED         (admin resolves in buyer's favour)
```

Never write code that jumps to a state outside these transitions.

---

## Payment Flow

1. Buyer places order → `PENDING`
2. `paymentService.js` creates a payment intent (Paymob or PayPal)
3. On webhook success → order moves to `SELLER_CONFIRMED`
4. Funds are held until `COMPLETED` state
5. Commission is deducted via `MARKETPLACE_COMMISSION` env var

---

## AI Integration (claudeService.js)

- Provider selected via `CLAUDE_PROVIDER=anthropic|openrouter`
- Model set via `ANTHROPIC_MODEL` (default: `claude-sonnet-4-6`)
- All AI calls are **server-side only** — API keys never reach the browser
- Used for: listing description suggestions, moderation, search improvements

---

## Deployment

### Railway
- `Dockerfile` builds with `node:20-alpine`, runs `npm ci`, generates Prisma client
- `entrypoint.js` runs `prisma migrate deploy` before starting the server
- `railway.toml` configures health check at `/health` (120 s timeout)
- Restart policy: `ON_FAILURE` (max 5 retries)

### Production Checklist
- [ ] `SESSION_SECRET` is a 64-char random string
- [ ] `DATABASE_URL` includes pool settings (`?connection_limit=10&pool_timeout=30`)
- [ ] Cloudinary configured or `/public/uploads` volume mounted
- [ ] OAuth redirect URIs updated to production domain
- [ ] `NODE_ENV=production` set
- [ ] CORS `ALLOWED_ORIGINS` set to production domain

---

## Known Gotchas

- **Playwright config** — `webServer.reuseExistingServer: true` in `playwright.config.js`; the test runner reuses a running dev server. Stop the dev server before running UI tests in CI.
- **Apple OAuth** — Uses a POST callback; CSRF is explicitly excluded for this route in `server.js`.
- **Font loading** — Custom fonts are loaded via CSS `@font-face`; ensure `/public/fonts` is served correctly in production.
- **Visual snapshots** — Playwright screenshot tests may need baseline refresh after intentional UI changes (`npx playwright test --update-snapshots`).
- **Nodemon** — Does not restart on changes to `.env`; restart manually after env changes.
- **Legacy routes** — Routes outside `/whale` redirect to their `/whale` equivalents. Do not remove these redirects.

---

## Priority Backlog (as of March 2026)

| Priority | Item |
|---|---|
| P0 | Server-side form validation improvements |
| P0 | Dispute resolution UI for buyers/sellers |
| P0 | Anti-fraud heuristics (suspicious order detection) |
| P1 | i18n key refactor (reduce duplication in lib/i18n.js) |
| P1 | Seller analytics dashboard |
| P2 | Deprecate non-whale legacy routes entirely |

---

## Definition of Done

A task is complete when:
1. All new/changed logic has corresponding unit or integration tests
2. `npm test` passes with no failures
3. `npm run test:ui` passes (or failing UI tests are explicitly tracked)
4. Bilingual strings added for all new UI copy
5. This file updated if architecture or conventions changed
