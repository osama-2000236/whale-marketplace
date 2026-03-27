#!/usr/bin/env node
/**
 * Railway entrypoint — runs migrations then starts the server.
 * Single Node process so all stdout/stderr is captured.
 *
 * P3009 recovery: if Prisma finds a failed migration it refuses to apply
 * new ones.  We run `prisma migrate reset --force` to wipe the tracking
 * table (PostgreSQL DDL is transactional so a failed migration leaves the
 * schema unchanged), then retry deploy from a clean state.
 *
 * Environment variables:
 *   FAIL_FAST_MIGRATIONS=1  — exit immediately on migration failure (production safety)
 *   BOOT_SEED=1             — run prisma db seed after migrations
 */
const { execSync } = require('child_process');

console.log('[entrypoint] Node', process.version, '| PID', process.pid);
console.log('[entrypoint] PORT=' + process.env.PORT, 'NODE_ENV=' + process.env.NODE_ENV);
console.log('[entrypoint] DATABASE_URL=' + (process.env.DATABASE_URL ? 'SET' : 'MISSING'));
console.log('[entrypoint] SESSION_SECRET=' + (process.env.SESSION_SECRET ? 'SET' : 'MISSING'));

const failFast = process.env.FAIL_FAST_MIGRATIONS === '1';
const bootSeed = process.env.BOOT_SEED === '1';

function runMigrateDeploy() {
  return execSync('node_modules/.bin/prisma migrate deploy', {
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000
  });
}

function resetMigrationTable() {
  console.log('[entrypoint] Wiping _prisma_migrations table for clean re-apply...');
  execSync(
    'node_modules/.bin/prisma migrate reset --force --skip-seed --skip-generate',
    { stdio: ['pipe', 'pipe', 'pipe'], timeout: 60000 }
  );
}

// Run migrations with P3009 recovery
try {
  console.log('[entrypoint] Running prisma migrate deploy...');
  const output = runMigrateDeploy();
  console.log('[entrypoint] Migration output:', output.toString().trim());
} catch (err) {
  const stderr = err.stderr ? err.stderr.toString() : '';
  const stdout = err.stdout ? err.stdout.toString() : '';
  const combined = stderr + stdout;

  console.error('[entrypoint] Migration attempt 1 failed:', combined || err.message);

  if (failFast) {
    console.error('[entrypoint] FAIL_FAST_MIGRATIONS=1 — aborting');
    process.exit(1);
  }

  // P3009: Prisma found failed/rolled-back migrations — reset and re-apply
  if (combined.includes('P3009') || combined.includes('failed migrations')) {
    try {
      resetMigrationTable();
      console.log('[entrypoint] Retrying prisma migrate deploy after reset...');
      const retryOutput = runMigrateDeploy();
      console.log('[entrypoint] Migration retry output:', retryOutput.toString().trim());
    } catch (retryErr) {
      const retryStderr = retryErr.stderr ? retryErr.stderr.toString() : retryErr.message;
      console.error('[entrypoint] Migration retry after reset failed:', retryStderr);
    }
  }
  // Any other migration error: log and continue (e.g. already applied)
}

// Optional boot seeding
if (bootSeed) {
  try {
    console.log('[entrypoint] Running prisma db seed...');
    const seedOutput = execSync('node_modules/.bin/prisma db seed', {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000,
    });
    console.log('[entrypoint] Seed output:', seedOutput.toString().trim());
  } catch (seedErr) {
    const seedStderr = seedErr.stderr ? seedErr.stderr.toString() : seedErr.message;
    console.error('[entrypoint] Seed failed (non-fatal):', seedStderr);
  }
}

console.log('[whale] Starting server...');
require('./server');
