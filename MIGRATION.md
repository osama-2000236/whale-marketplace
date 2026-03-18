# MIGRATION GUIDE: JSON -> PostgreSQL + Prisma

This guide moves PC Gaming from file-based JSON storage to a scalable PostgreSQL architecture.

## 1. Backup existing JSON data
1. Create a backup folder:
   ```bash
   mkdir backup-json
   ```
2. Copy old data files:
   ```bash
   cp -r data backup-json/
   ```

## 2. Configure environment
1. Copy env template:
   ```bash
   cp .env.example .env
   ```
2. Set these required variables in `.env`:
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `CLOUDINARY_URL` (optional)
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `PORT`

## 3. Install dependencies
```bash
npm install
```

## 4. Generate Prisma client
```bash
npm run prisma:generate
```

## 5. Create and apply first migration
```bash
npm run prisma:migrate -- --name init_social_platform
```

## 6. Seed the new database
```bash
npm run seed
```
Seed does the following:
- Upserts admin account using env credentials.
- Seeds official game rooms.
- Migrates store products from `data/products.json` (fallback sample data if empty).
- Creates sample users and 3 marketplace listings.

## 7. Full-text search notes (Arabic + English)
This implementation uses PostgreSQL `to_tsvector('simple', ...)` and `plainto_tsquery('simple', ...)` with raw SQL in `services/searchService.js`.

Recommended DB indexes for production:
```sql
CREATE INDEX IF NOT EXISTS idx_post_search
ON "Post" USING GIN (to_tsvector('simple', coalesce(content, '')));

CREATE INDEX IF NOT EXISTS idx_listing_search
ON "MarketplaceListing" USING GIN (
  to_tsvector('simple',
    coalesce(title, '') || ' ' || coalesce("titleAr", '') || ' ' ||
    coalesce(description, '') || ' ' || coalesce("descriptionAr", '')
  )
);

CREATE INDEX IF NOT EXISTS idx_product_search
ON "Product" USING GIN (
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce("nameAr", '') || ' ' || coalesce(description, ''))
);
```

## 8. Start the app
Development:
```bash
npm run dev
```
Production:
```bash
npm start
```

## 9. Verify core paths
- Web:
  - `/` (feed for logged-in users, storefront for guests)
  - `/rooms`
  - `/marketplace`
  - `/notifications`
- Auth:
  - `/auth/register`
  - `/auth/login`
- Admin:
  - `/admin`
- API:
  - `/api/auth/*`
  - `/api/users/*`
  - `/api/rooms/*`
  - `/api/posts/*`
  - `/api/comments/*`
  - `/api/listings/*`
  - `/api/search`
  - `/api/notifications/*`

## 10. Decommission old JSON write paths
After confirming production stability:
1. Keep `data/config.json` if you still edit static site config from admin.
2. Remove any remaining JSON write flows not needed.
3. Keep backup for rollback window.

## Rollback strategy
If needed:
1. Stop app.
2. Restore backup JSON files.
3. Switch routes/services back to legacy JSON branches.
4. Keep PostgreSQL snapshot for recovery.
