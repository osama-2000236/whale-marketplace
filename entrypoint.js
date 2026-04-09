#!/usr/bin/env node
/**
 * Railway entrypoint — runs migrations then starts the server.
 *
 * Environment variables:
 *   BOOT_SEED=1 — run prisma db seed after migrations
 */
const { execSync } = require('child_process');

const MIGRATE_DEPLOY_COMMAND = 'node_modules/.bin/prisma migrate deploy';
const SEED_COMMAND = 'node_modules/.bin/prisma db seed';

function run(cmd, timeoutMs) {
  return execSync(cmd, {
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: timeoutMs || 60000,
  });
}

function formatCommandError(err) {
  const stderr = err.stderr ? err.stderr.toString() : '';
  const stdout = err.stdout ? err.stdout.toString() : '';
  return stderr + stdout || err.message;
}

function runMigrateDeploy(runCommand = run) {
  console.log('[entrypoint] Running prisma migrate deploy...');
  const output = runCommand(MIGRATE_DEPLOY_COMMAND);
  console.log('[entrypoint] Migration output:', output.toString().trim());
  return output;
}

function runSeed(runCommand = run) {
  console.log('[entrypoint] Running prisma db seed...');
  try {
    const seedOutput = runCommand(SEED_COMMAND);
    console.log('[entrypoint] Seed output:', seedOutput.toString().trim());
  } catch (seedErr) {
    console.error('[entrypoint] Seed failed (non-fatal):', formatCommandError(seedErr));
  }
}

function boot({
  runCommand = run,
  bootSeed = process.env.BOOT_SEED === '1',
  startServer = () => require('./server'),
} = {}) {
  console.log('[entrypoint] Node', process.version, '| PID', process.pid);
  console.log('[entrypoint] PORT=' + process.env.PORT, 'NODE_ENV=' + process.env.NODE_ENV);
  console.log('[entrypoint] DATABASE_URL=' + (process.env.DATABASE_URL ? 'SET' : 'MISSING'));
  console.log('[entrypoint] SESSION_SECRET=' + (process.env.SESSION_SECRET ? 'SET' : 'MISSING'));

  try {
    runMigrateDeploy(runCommand);
  } catch (err) {
    console.error('[entrypoint] Migration failed:', formatCommandError(err));
    throw err;
  }

  if (bootSeed) {
    runSeed(runCommand);
  }

  console.log('[whale] Starting server...');
  return startServer();
}

if (require.main === module) {
  try {
    boot();
  } catch {
    console.error('[entrypoint] Aborting startup because migrations failed.');
    process.exit(1);
  }
}

module.exports = {
  MIGRATE_DEPLOY_COMMAND,
  SEED_COMMAND,
  run,
  formatCommandError,
  runMigrateDeploy,
  runSeed,
  boot,
};
