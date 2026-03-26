const { execSync } = require('child_process');

console.log('[whale] Running database migrations...');
try {
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('[whale] Migrations complete.');
} catch (err) {
  console.error('[whale] Migration failed:', err.message);
  // Continue anyway — migrations may not exist yet in dev
}

console.log('[whale] Starting server...');
require('./server');
