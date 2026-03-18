#!/usr/bin/env node
/**
 * Railway entrypoint — runs migrations then starts the server.
 * Single Node process so all stdout/stderr is captured.
 */
const { execSync } = require('child_process');

console.log('[entrypoint] Node', process.version, '| PID', process.pid);
console.log('[entrypoint] PORT=' + process.env.PORT, 'NODE_ENV=' + process.env.NODE_ENV);
console.log('[entrypoint] DATABASE_URL=' + (process.env.DATABASE_URL ? 'SET' : 'MISSING'));
console.log('[entrypoint] SESSION_SECRET=' + (process.env.SESSION_SECRET ? 'SET' : 'MISSING'));

// Run migrations
try {
  console.log('[entrypoint] Running prisma migrate deploy...');
  const output = execSync('npx prisma migrate deploy', {
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000
  });
  console.log('[entrypoint] Migration output:', output.toString().trim());
} catch (err) {
  console.error('[entrypoint] Migration failed:', err.stderr ? err.stderr.toString() : err.message);
  // Continue anyway — migrations may already be applied
}

// Start server
console.log('[entrypoint] Loading server...');
try {
  require('./server');
} catch (err) {
  console.error('[entrypoint] FATAL — server failed to load:', err);
  process.exit(1);
}
