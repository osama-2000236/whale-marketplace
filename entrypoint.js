#!/usr/bin/env node
/**
 * Railway entrypoint — runs migrations then starts the server.
 * Single Node process so all stdout/stderr is captured.
 *
 * P3009 recovery: if Prisma finds a failed migration it refuses to apply
 * new ones.  We parse the error output to get the migration name, mark it
 * as rolled-back (PostgreSQL DDL is transactional so a failed migration
 * leaves the schema unchanged), then retry deploy.
 */
const { execSync } = require('child_process');

console.log('[entrypoint] Node', process.version, '| PID', process.pid);
console.log('[entrypoint] PORT=' + process.env.PORT, 'NODE_ENV=' + process.env.NODE_ENV);
console.log('[entrypoint] DATABASE_URL=' + (process.env.DATABASE_URL ? 'SET' : 'MISSING'));
console.log('[entrypoint] SESSION_SECRET=' + (process.env.SESSION_SECRET ? 'SET' : 'MISSING'));

function runMigrateDeploy() {
  return execSync('npx prisma migrate deploy', {
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000
  });
}

function resolveFailedMigration(migrationName) {
  console.log('[entrypoint] Resolving failed migration:', migrationName);
  execSync(`npx prisma migrate resolve --rolled-back "${migrationName}"`, {
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000
  });
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

  // P3009: Prisma found a failed migration — resolve it and retry once
  if (combined.includes('P3009') || combined.includes('failed migrations')) {
    // Extract the migration name from the error message.
    // Prisma prints: "Migration name: 20260316052851_add_marketplace_v2"
    const nameMatch = combined.match(/Migration name:\s*(\S+)/i)
      || combined.match(/migration\s+"([^"]+)"/i)
      || combined.match(/migrations[/\\](\d{14}_\S+)/i);

    if (nameMatch) {
      try {
        resolveFailedMigration(nameMatch[1]);
        console.log('[entrypoint] Retrying prisma migrate deploy...');
        const retryOutput = runMigrateDeploy();
        console.log('[entrypoint] Migration retry output:', retryOutput.toString().trim());
      } catch (retryErr) {
        const retryStderr = retryErr.stderr ? retryErr.stderr.toString() : retryErr.message;
        console.error('[entrypoint] Migration retry failed:', retryStderr);
        // Continue — the schema may be close enough for the server to start
      }
    } else {
      console.error('[entrypoint] P3009 detected but could not parse migration name — continuing');
    }
  }
  // Any other migration error: log and continue (e.g. already applied)
}

console.log('[whale] Starting server...');
require('./server');
