#!/usr/bin/env node
/**
 * Railway entrypoint — runs migrations then starts the server.
 * Single Node process so all stdout/stderr is captured.
 *
 * Migration recovery: if `prisma migrate deploy` fails for any reason
 * (P3009 stale failed record, P3018 schema conflict from partial state,
 * etc.) we run `prisma migrate reset --force` to drop all objects and
 * re-apply every migration from scratch, then retry deploy.
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

  // Any migration failure (P3009 stale record, P3018 schema conflict, etc.)
  // — reset the database and re-apply all migrations from scratch.
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
