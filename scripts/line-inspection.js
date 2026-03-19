/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUTPUT_JSON = path.join(ROOT, 'line-inspection-report.json');
const OUTPUT_MD = path.join(ROOT, 'line-inspection-report.md');

const INCLUDE_DIRS = [
  'routes',
  'services',
  'middleware',
  'lib',
  'utils',
  'views',
  'scripts'
];

const FILE_EXTENSIONS = new Set(['.js', '.ejs', '.json']);

const RULES = [
  {
    id: 'security.eval',
    severity: 'high',
    description: 'Dynamic code execution via eval',
    test: (line) => /\beval\s*\(/.test(line)
  },
  {
    id: 'security.new-function',
    severity: 'high',
    description: 'Dynamic code execution via new Function',
    test: (line) => /\bnew\s+Function\s*\(/.test(line)
  },
  {
    id: 'security.execsync',
    severity: 'high',
    description: 'Potential command injection risk via execSync',
    test: (line) => /\bexecSync\s*\(/.test(line)
  },
  {
    id: 'security.exec',
    severity: 'medium',
    description: 'Potential command injection risk via exec',
    test: (line) => /(^|[^.\w])exec\s*\(/.test(line)
  },
  {
    id: 'security.child-process',
    severity: 'medium',
    description: 'Child process usage should be reviewed carefully',
    test: (line) => /\bchild_process\b/.test(line)
  },
  {
    id: 'security.unsafe-inline-csp',
    severity: 'medium',
    description: 'CSP allows unsafe-inline scripts/styles',
    test: (line) => /'unsafe-inline'/.test(line)
  },
  {
    id: 'performance.sync-fs',
    severity: 'medium',
    description: 'Synchronous filesystem call on runtime path',
    test: (line) => /\bfs\.(readFileSync|writeFileSync|existsSync|readdirSync|statSync)\s*\(/.test(line)
  },
  {
    id: 'quality.todo-fixme',
    severity: 'low',
    description: 'TODO/FIXME/HACK marker present',
    test: (line) => /\b(TODO|FIXME|HACK|XXX)\b/i.test(line)
  },
  {
    id: 'quality.console',
    severity: 'low',
    description: 'Console usage in non-test file',
    test: (line, filePath) => /\bconsole\.(log|warn|error|info)\s*\(/.test(line) && !/__tests__|__uitests__/.test(filePath)
  },
  {
    id: 'quality.long-line',
    severity: 'low',
    description: 'Line length exceeds 180 characters',
    test: (line) => line.length > 180
  }
];

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function shouldIncludeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!FILE_EXTENSIONS.has(ext)) return false;
  const posix = toPosix(filePath);
  return INCLUDE_DIRS.some((dir) => posix.startsWith(`${dir}/`));
}

function listFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(full));
      continue;
    }
    const relative = path.relative(ROOT, full);
    if (shouldIncludeFile(relative)) out.push(relative);
  }

  return out;
}

function inspectFile(filePath) {
  const abs = path.join(ROOT, filePath);
  const text = fs.readFileSync(abs, 'utf8');
  const lines = text.split(/\r?\n/);
  const findings = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const rule of RULES) {
      if (rule.test(line, filePath, i + 1)) {
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          description: rule.description,
          file: filePath,
          line: i + 1,
          snippet: line.trim().slice(0, 220)
        });
      }
    }
  }

  return { filePath, lineCount: lines.length, findings };
}

function summarize(findings) {
  const bySeverity = { high: 0, medium: 0, low: 0 };
  const byRule = {};

  findings.forEach((f) => {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    byRule[f.ruleId] = (byRule[f.ruleId] || 0) + 1;
  });

  return { bySeverity, byRule };
}

function markdown(report) {
  const lines = [];
  lines.push('# Line-by-Line Inspection Report');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Files scanned: ${report.filesScanned}`);
  lines.push(`- Total lines scanned: ${report.totalLines}`);
  lines.push(`- Findings: ${report.findings.length}`);
  lines.push('');
  lines.push('## Severity Summary');
  lines.push('');
  lines.push(`- High: ${report.summary.bySeverity.high || 0}`);
  lines.push(`- Medium: ${report.summary.bySeverity.medium || 0}`);
  lines.push(`- Low: ${report.summary.bySeverity.low || 0}`);
  lines.push('');
  lines.push('## Rule Summary');
  lines.push('');

  Object.keys(report.summary.byRule)
    .sort()
    .forEach((ruleId) => {
      lines.push(`- ${ruleId}: ${report.summary.byRule[ruleId]}`);
    });

  lines.push('');
  lines.push('## Findings');
  lines.push('');
  lines.push('| Severity | Rule | File | Line | Snippet |');
  lines.push('|---|---|---|---:|---|');

  report.findings.forEach((f) => {
    const safeSnippet = String(f.snippet || '').replace(/\|/g, '\\|');
    lines.push(`| ${f.severity} | ${f.ruleId} | ${f.file} | ${f.line} | ${safeSnippet} |`);
  });

  lines.push('');
  return lines.join('\n');
}

function main() {
  const files = INCLUDE_DIRS
    .map((dir) => path.join(ROOT, dir))
    .filter((abs) => fs.existsSync(abs))
    .flatMap((abs) => listFiles(abs))
    .sort();

  const findings = [];
  let totalLines = 0;

  for (const filePath of files) {
    const fileResult = inspectFile(filePath);
    totalLines += fileResult.lineCount;
    findings.push(...fileResult.findings);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    filesScanned: files.length,
    totalLines,
    summary: summarize(findings),
    findings
  };

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(OUTPUT_MD, markdown(report), 'utf8');

  console.log(`Saved JSON report: ${OUTPUT_JSON}`);
  console.log(`Saved Markdown report: ${OUTPUT_MD}`);
  console.log(`Files scanned: ${report.filesScanned}`);
  console.log(`Total lines scanned: ${report.totalLines}`);
  console.log(`Findings: ${report.findings.length}`);

  if (report.summary.bySeverity.high > 0) {
    process.exitCode = 2;
  }
}

main();
