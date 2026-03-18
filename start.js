/**
 * Startup wrapper — catches module-level crashes that server.js can't.
 */
console.log('[start.js] Node', process.version, 'PID', process.pid);
console.log('[start.js] ENV:', 'NODE_ENV=' + process.env.NODE_ENV, 'PORT=' + process.env.PORT);
console.log('[start.js] SESSION_SECRET=' + (process.env.SESSION_SECRET ? 'SET' : 'MISSING'));
console.log('[start.js] DATABASE_URL=' + (process.env.DATABASE_URL ? 'SET' : 'MISSING'));

try {
  console.log('[start.js] Loading server.js...');
  require('./server');
  console.log('[start.js] server.js loaded successfully');
} catch (err) {
  console.error('[start.js] FATAL — server.js failed to load:');
  console.error(err);
  process.exit(1);
}
