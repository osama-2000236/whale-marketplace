/**
 * @file check-secrets.js
 * @description Scans the codebase for hardcoded secrets, API keys, and credentials.
 *   Fails the CI pipeline if any are found. Run: node scripts/check-secrets.js
 * @author Whale Development Team
 * @created 2026-03-18
 * @dependencies fs, path (Node built-ins)
 */

'use strict';

const fs = require('fs');
const path = require('path');

/** Directories to skip during scanning */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'coverage', 'playwright-report',
  'test-results', '.next', 'dist', 'build', '__uitests__'
]);

/** File extensions to scan */
const SCAN_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.ejs', '.html', '.css',
  '.json', '.yml', '.yaml', '.toml', '.md', '.sh'
]);

/** Files to skip (they legitimately contain example/fake secrets) */
const SKIP_FILES = new Set([
  '.env.example', 'check-secrets.js', 'package-lock.json'
]);

/**
 * Secret detection patterns.
 * Each entry: [patternName, regex, description]
 */
const SECRET_PATTERNS = [
  // AWS
  ['AWS_ACCESS_KEY', /AKIA[0-9A-Z]{16}/g, 'AWS Access Key ID'],
  // Generic API keys (long hex/base64 strings assigned to variables)
  ['HARDCODED_KEY', /(?:api[_-]?key|apikey|secret|token|password|credential)\s*[:=]\s*['"][A-Za-z0-9+/=_-]{20,}['"]/gi, 'Hardcoded API key or secret'],
  // SendGrid
  ['SENDGRID_KEY', /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g, 'SendGrid API key'],
  // Stripe
  ['STRIPE_KEY', /sk_(?:live|test)_[A-Za-z0-9]{24,}/g, 'Stripe secret key'],
  // Google OAuth (client secret pattern)
  ['GOOGLE_SECRET', /GOCSPX-[A-Za-z0-9_-]{28}/g, 'Google OAuth client secret'],
  // Private keys
  ['PRIVATE_KEY', /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g, 'Private key in source'],
  // JWT tokens
  ['JWT_TOKEN', /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, 'JWT token'],
  // PostgreSQL connection with password
  ['DB_URL_WITH_PASS', /postgresql:\/\/[^:]+:[^@\s]+@(?!localhost)[^\s'"]+/g, 'Database URL with remote credentials'],
  // Cloudinary URL with secret
  ['CLOUDINARY_URL', /cloudinary:\/\/[0-9]+:[A-Za-z0-9_-]{20,}@/g, 'Cloudinary URL with API secret'],
];

/** Counts total violations found */
let violationCount = 0;

/**
 * Recursively walk a directory and yield file paths.
 * @param {string} dir - Directory to walk
 * @returns {Generator<string>}
 */
function* walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        yield* walkDir(fullPath);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SCAN_EXTENSIONS.has(ext) && !SKIP_FILES.has(entry.name)) {
        yield fullPath;
      }
    }
  }
}

/**
 * Scan a single file for secret patterns.
 * @param {string} filePath - Absolute path to the file
 */
function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);

  for (const [name, pattern, description] of SECRET_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      const snippet = match[0].substring(0, 40) + (match[0].length > 40 ? '...' : '');
      console.error(
        `  ❌ ${relativePath}:${lineNum} — ${description} (${name})\n     Match: ${snippet}\n`
      );
      violationCount++;
    }
  }
}

// ── Main execution ──
const projectRoot = path.resolve(__dirname, '..');
console.log('🔍 Scanning for hardcoded secrets...\n');

let fileCount = 0;
for (const filePath of walkDir(projectRoot)) {
  scanFile(filePath);
  fileCount++;
}

console.log(`\n📁 Scanned ${fileCount} files.`);

if (violationCount > 0) {
  console.error(`\n🚨 Found ${violationCount} potential secret(s) in source code!`);
  console.error('   Remove them and use environment variables instead.\n');
  process.exit(1);
} else {
  console.log('✅ No hardcoded secrets found.\n');
  process.exit(0);
}
