'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { generateText, getClaudeConfig, getDefaultMaxTokens, isConfigured } = require('./services/claudeService');

const PROJECT_ROOT = process.cwd();
const MAX_FILE_BYTES = 32 * 1024;
const MAX_FILES = 6;

function readAllStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function readTextFileSafe(filePath, maxBytes = MAX_FILE_BYTES) {
  try {
    const fullPath = path.resolve(PROJECT_ROOT, filePath);
    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return { ok: false, message: `Blocked path outside project: ${filePath}` };
    }
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      return { ok: false, message: `Not a file: ${filePath}` };
    }
    const raw = fs.readFileSync(fullPath, 'utf8');
    const text = raw.length > maxBytes ? `${raw.slice(0, maxBytes)}\n\n[truncated]` : raw;
    return { ok: true, path: fullPath, text };
  } catch (error) {
    return { ok: false, message: `${filePath}: ${error.message}` };
  }
}

function buildBaseSystemPrompt() {
  return [
    'You are Claude helping upgrade the Whale marketplace project.',
    'Project stack: Node.js, Express, EJS, PostgreSQL, Prisma.',
    'Architecture rules: keep business logic in services, keep routes thin, preserve CSRF/session security, keep bilingual AR/EN behavior, and keep dir="auto" on user content.',
    'Answer concretely with actionable patches, file-level guidance, tests, and exact next steps.',
    'This is the Whale marketplace repo. Stay within this repository context only.',
    'If you need code context, rely on files supplied by the prompt. Do not assume missing files.'
  ].join('\n');
}

function printHelp() {
  process.stdout.write(
    [
      '',
      'Commands:',
      '  /help                 Show commands',
      '  /model                Show active Claude model',
      '  /files a b c          Load project files into ongoing context',
      '  /clearfiles           Remove loaded file context',
      '  /clear                Clear chat history',
      '  /exit                 Quit',
      '',
      'Examples:',
      '  /files routes/whale.js services/whaleService.js views/whale/listing.ejs',
      '  Review the cart checkout flow and list bugs.',
      ''
    ].join('\n')
  );
}

function normalizeFileArgs(input) {
  return input
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildUserPrompt(userInput, loadedFiles) {
  if (!loadedFiles.length) return userInput;

  const fileBlocks = loadedFiles
    .map((file) => `## File: ${file.relativePath}\n\n\`\`\`\n${file.text}\n\`\`\``)
    .join('\n\n');

  return [
    'Use the following project files as authoritative local context for this answer.',
    fileBlocks,
    '',
    `User request: ${userInput}`
  ].join('\n');
}

async function main() {
  const cfg = getClaudeConfig();

  if (!isConfigured()) {
    process.stderr.write(`${cfg.provider.toUpperCase()} API key is missing in .env\n`);
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 200
  });

  const baseSystemPrompt = buildBaseSystemPrompt();
  const loadedFiles = [];
  let history = [];
  let shouldExit = false;

  process.stdout.write(`Claude agent ready.\nModel: ${cfg.model}\nProject: ${PROJECT_ROOT}\n`);
  printHelp();

  async function handleInput(input) {
    if (input === '/exit') {
      shouldExit = true;
      return;
    }
    if (input === '/help') {
      printHelp();
      return;
    }
    if (input === '/model') {
      process.stdout.write(`Active model: ${getClaudeConfig().model}\n`);
      return;
    }
    if (input === '/clear') {
      history = [];
      process.stdout.write('Chat history cleared.\n');
      return;
    }
    if (input === '/clearfiles') {
      loadedFiles.length = 0;
      process.stdout.write('Loaded file context cleared.\n');
      return;
    }
    if (input.startsWith('/files ')) {
      const requested = normalizeFileArgs(input.slice('/files '.length)).slice(0, MAX_FILES);
      loadedFiles.length = 0;

      for (const relativePath of requested) {
        const result = readTextFileSafe(relativePath);
        if (result.ok) {
          loadedFiles.push({
            relativePath,
            fullPath: result.path,
            text: result.text
          });
        } else {
          process.stdout.write(`${result.message}\n`);
        }
      }

      process.stdout.write(
        loadedFiles.length
          ? `Loaded files:\n${loadedFiles.map((f) => `- ${f.relativePath}`).join('\n')}\n`
          : 'No files loaded.\n'
      );
      return;
    }

    const prompt = buildUserPrompt(input, loadedFiles);
    const requestHistory = history.slice(-10);

    try {
      process.stdout.write('\nThinking...\n');

      const reply = await generateText({
        system: baseSystemPrompt,
        prompt: [
          ...requestHistory.map((item) => `${item.role.toUpperCase()}: ${item.content}`),
          `USER: ${prompt}`
        ].join('\n\n'),
        model: getClaudeConfig().model,
        maxTokens: getDefaultMaxTokens(),
        temperature: 0.2
      });

      history.push({ role: 'user', content: input });
      history.push({ role: 'assistant', content: reply });
      process.stdout.write(`\n${reply}\n`);
    } catch (error) {
      const msg = String(error.message || error);
      if (/no usable credits|requires paid access|account has no credits|rejected the request \(402\)/i.test(msg)) {
        process.stdout.write(`\n${msg}\n`);
      } else {
        process.stdout.write(`\nRequest failed: ${msg}\n`);
      }
    }
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const raw = await readAllStdin();
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      await handleInput(line);
      if (shouldExit) break;
    }
    rl.close();
    return;
  }

  const ask = () => new Promise((resolve) => rl.question('\nclaude> ', resolve));

  while (true) {
    const input = (await ask()).trim();
    if (!input) continue;
    if (input === '/exit') break;
    await handleInput(input);
  }

  rl.close();
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
