const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const envExamplePath = path.join(projectRoot, '.env.example');

function parseEnvExampleKeys(content) {
  const keys = new Set();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (match) keys.add(match[1]);
  }
  return keys;
}

function collectJsFiles(entryPath) {
  const stat = fs.statSync(entryPath);
  if (stat.isFile()) return [entryPath];

  const files = [];
  for (const item of fs.readdirSync(entryPath, { withFileTypes: true })) {
    const fullPath = path.join(entryPath, item.name);
    if (item.isDirectory()) {
      if (
        ['node_modules', 'coverage', 'playwright-report', 'test-results', '.git'].includes(
          item.name
        )
      ) {
        continue;
      }
      files.push(...collectJsFiles(fullPath));
      continue;
    }
    if (item.isFile() && fullPath.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function collectEnvUsages(files) {
  const used = new Set();
  const envRegex = /\bprocess\.env\.([A-Z0-9_]+)\b/g;

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    let match = envRegex.exec(content);
    while (match) {
      used.add(match[1]);
      match = envRegex.exec(content);
    }
  }
  return used;
}

function main() {
  if (!fs.existsSync(envExamplePath)) {
    console.error('Missing .env.example');
    process.exit(1);
  }

  const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
  const envExampleKeys = parseEnvExampleKeys(envExampleContent);

  const scanTargets = [
    'server.js',
    'entrypoint.js',
    'routes',
    'services',
    'middleware',
    'lib',
    'utils',
  ]
    .map((target) => path.join(projectRoot, target))
    .filter((targetPath) => fs.existsSync(targetPath));

  const jsFiles = scanTargets.flatMap((targetPath) => collectJsFiles(targetPath));
  const usedKeys = collectEnvUsages(jsFiles);

  const missing = [...usedKeys].filter((key) => !envExampleKeys.has(key)).sort();

  if (missing.length > 0) {
    console.error('Missing keys in .env.example:');
    for (const key of missing) {
      console.error(`- ${key}`);
    }
    process.exit(1);
  }

  console.log(
    `OK: .env.example covers ${usedKeys.size} env key(s) referenced in server/routes/services code.`
  );
}

main();
