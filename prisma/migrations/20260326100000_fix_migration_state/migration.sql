-- Fix broken migration state caused by failed 20260326000000_add_social_oauth_stripe migration.
-- The PaymentProvider enum did not exist when that migration ran (the init migration had never
-- been applied), leaving a failed record in _prisma_migrations that blocks all future deploys.
-- Removing the record here allows `prisma migrate deploy` to re-apply both prior migrations
-- in order: first the init (creating all tables), then the social/oauth/stripe migration.
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260326000000_add_social_oauth_stripe';
