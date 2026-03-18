# AGENTS.md (Repository Rules)

## Scope

This repository is Whale-first. Treat `/whale` as the primary product surface.

## Required Engineering Rules

1. Keep business logic in `services/`.
2. Keep routes thin and wrapped with route-level `try/catch`.
3. Keep CSRF protection on all state-changing routes.
4. Keep bilingual UI (Arabic + English).
5. Keep `dir="auto"` on user-generated content.
6. Preserve buyer-protection messaging:
   - "أموالك محفوظة حتى تؤكد الاستلام — Your money is protected until you confirm delivery."

## Data and Migrations

- Edit schema only in `prisma/schema.prisma`.
- Use Prisma migrations for all schema changes.
- Update `prisma/seed.js` if new reference data is needed.

## Testing Protocol

After any meaningful change run:

```bash
npm run test
npx playwright test __uitests__/pages/whale-marketplace.spec.js
```

Before merge/deploy run:

```bash
npm run test:coverage
npm run test:ui
```

## Legacy Notes

- Legacy routes/models still exist for compatibility.
- Do not delete legacy pieces without a clear migration and rollback plan.

## Documentation

- If behavior changes, update `README.md` and `AI_HANDOFF.md` in the same PR.
