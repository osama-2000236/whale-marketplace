# AI_HANDOFF.md

This file is the operational guide for any AI upgrading Whale.

## 1) Mission

Whale is a trust-first marketplace. The most important business guarantee is:

> أموالك محفوظة حتى تؤكد الاستلام — Your money is protected until you confirm delivery.

Any change that weakens this guarantee is a blocker.

---

## 2) First 10 Minutes Checklist

1. Read:
- `README.md`
- `server.js`
- `routes/whale.js`
- `services/whaleService.js`
- `public/css/community.css`

2. Confirm runtime:
- `npm run prisma:generate`
- `npm run dev`

3. Confirm baseline:
- `npm run test`
- `npx playwright test __uitests__/pages/whale-marketplace.spec.js`

Only start feature work after baseline passes.

---

## 3) Where To Edit What

### Data model changes
- `prisma/schema.prisma`
- migration command: `npm run prisma:migrate -- --name <name>`
- seed updates: `prisma/seed.js`

### Business logic
- `services/*.js`

### Routing and guards
- `routes/*.js`
- Keep handlers thin, wrap in route-level `try/catch`

### UI and layout
- `views/whale/*.ejs`
- `public/css/community.css`
- `public/css/WHALE_UI_SYSTEM_V2.css`
- `public/js/whale-ui-v2.js`
- `public/WHALE_UI_COMPONENTS.html`

### Access/subscription/cron
- `middleware/subscription.js`

### Security/auth
- `routes/auth.js`
- `middleware/auth.js`
- `server.js` CSRF + session + middleware ordering

---

## 4) Hard Rules

1. No business logic in routes.
2. Keep CSRF for state-changing requests.
3. Keep bilingual strings (Arabic + English).
4. Keep `dir="auto"` for user text containers.
5. Keep order state transitions valid.
6. Use Prisma transactions for multi-entity writes.
7. Do not remove legacy models/routes without migration plan.

---

## 5) Safe Feature Workflow

For each feature:

1. **Schema**: add/adjust Prisma model/index.
2. **Service**: implement rules and validations.
3. **Route**: call service only.
4. **View**: add UI + CSRF fields.
5. **Tests**: add unit + route tests.
6. **UI tests**: add/adjust Playwright checks.
7. **Docs**: update `README.md` + this file if behavior changed.

---

## 6) Testing Gate

### Backend gate

```bash
npm run test
npm run test:coverage
```

### UI gate

```bash
npm run test:ui
```

### Fast targeted runs

```bash
npm run test:unit
npm run test:component
npm run test:integration
npm run test:security
npx playwright test __uitests__/pages/whale-marketplace.spec.js
```

Deployment should be blocked on failing test suites.

---

## 7) Known Stability Notes

1. In this environment, Playwright is configured for stability:
- `workers: 1`
- `navigationTimeout: 25000`
- `webServer.command: node server.js`

2. `npm run dev` uses nodemon and may be less stable in sandboxed environments.

3. Visual snapshot tests live in:
- `__uitests__/visual/screenshots.spec.js-snapshots/`

4. The static Whale UI component demo lives at:
- `/WHALE_UI_COMPONENTS.html`

5. Responsive listing/detail media now depend on:
- `utils/images.js`
- `server.js` view helper: `imageSet(url, options)`

When UI intentionally changes, update baselines with:

```bash
npx playwright test __uitests__/visual/screenshots.spec.js --update-snapshots
```

---

## 8) Current Route Reality (Important)

- App is Whale-first.
- `/`, `/marketplace`, `/market`, `/forum`, `/rooms`, `/posts`, `/products` all end up at `/whale`.
- Legacy route files exist but are not primary runtime behavior.

Do not assume old social/forum/store pages are active user flows.

---

## 9) Priority Upgrade Backlog

### P0
- Strengthen server-side validation boundaries for listing/order payloads.
- Add explicit dispute workflow UI for buyer/seller.
- Add better anti-fraud flags for suspicious order transitions.

### P1
- Refactor repeated bilingual literals into structured dictionaries.
- Add richer seller analytics in dashboard.
- Improve media compression and responsive image delivery.

### P2
- Cleanly deprecate legacy non-whale code paths and dead templates.
- Add migration scripts to archive legacy data safely.

---

## 10) Definition of Done

A task is done only if:

1. Behavior works in Whale routes.
2. No CSRF/auth regressions.
3. Jest + Playwright pass.
4. UI remains responsive on mobile/tablet/desktop.
5. Buyer-protection trust copy remains visible where required.
6. Docs are updated.
