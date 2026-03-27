#!/usr/bin/env node
/**
 * Railway entrypoint — runs migrations then starts the server.
 * Single Node process so all stdout/stderr is captured.
 *
 * Migration recovery: if `prisma migrate deploy` fails for any reason
 * (P3009 stale failed record, P3018 schema conflict from partial state,
 * etc.) we DROP and re-create the public schema via raw SQL (Railway does
 * not grant DROP DATABASE, so `prisma migrate reset` cannot be used), then
 * retry `prisma migrate deploy` against the now-empty schema.
 *
 * Environment variables:
 *   FAIL_FAST_MIGRATIONS=1  — exit immediately on migration failure (production safety)
 *   BOOT_SEED=1             — run prisma db seed after migrations
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('[entrypoint] Node', process.version, '| PID', process.pid);
console.log('[entrypoint] PORT=' + process.env.PORT, 'NODE_ENV=' + process.env.NODE_ENV);
console.log('[entrypoint] DATABASE_URL=' + (process.env.DATABASE_URL ? 'SET' : 'MISSING'));
console.log('[entrypoint] SESSION_SECRET=' + (process.env.SESSION_SECRET ? 'SET' : 'MISSING'));

const failFast = process.env.FAIL_FAST_MIGRATIONS === '1';
const bootSeed = process.env.BOOT_SEED === '1';

function run(cmd, timeoutMs) {
  return execSync(cmd, {
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: timeoutMs || 60000,
  });
}

function runMigrateDeploy() {
  return run('node_modules/.bin/prisma migrate deploy');
}

/**
 * Drop everything in the public schema and recreate it.
 * This works on Railway (unlike `prisma migrate reset` which needs DROP DATABASE).
 */
function dropPublicSchema() {
  console.log('[entrypoint] Dropping public schema to clear partial migration state...');
  const sqlFile = path.join(os.tmpdir(), '_entrypoint_reset.sql');
  fs.writeFileSync(sqlFile, 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  try {
    run('node_modules/.bin/prisma db execute --file ' + sqlFile, 30000);
  } finally {
    try { fs.unlinkSync(sqlFile); } catch (_) { /* ignore */ }
  }
}

// Run migrations with recovery
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

  // Any migration failure — drop schema and re-apply from scratch.
  try {
    dropPublicSchema();
    console.log('[entrypoint] Schema dropped. Retrying prisma migrate deploy...');
    const retryOutput = runMigrateDeploy();
    console.log('[entrypoint] Migration retry output:', retryOutput.toString().trim());
  } catch (retryErr) {
    const retryMsg = retryErr.stderr ? retryErr.stderr.toString() : retryErr.message;
    console.error('[entrypoint] Migration retry after schema drop failed:', retryMsg);
    console.error('[entrypoint] Server will start but database may be incomplete.');
  }
}

// Optional boot seeding
if (bootSeed) {
  try {
    console.log('[entrypoint] Running prisma db seed...');
    const seedOutput = run('node_modules/.bin/prisma db seed');
    console.log('[entrypoint] Seed output:', seedOutput.toString().trim());
  } catch (seedErr) {
    const seedStderr = seedErr.stderr ? seedErr.stderr.toString() : seedErr.message;
    console.error('[entrypoint] Seed failed (non-fatal):', seedStderr);
  }
}

console.log('[whale] Starting server...');
require('./server');
