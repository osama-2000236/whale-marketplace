'use strict';

require('dotenv').config();

const { detectProvider, generateText, getClaudeConfig, getDefaultMaxTokens, isConfigured } = require('../services/claudeService');

async function main() {
  const prompt = process.argv.slice(2).join(' ').trim() || 'Say hello in Arabic and English.';
  const cfg = getClaudeConfig();
  const provider = detectProvider();

  if (!isConfigured()) {
    throw new Error('Claude provider API key is missing from .env');
  }

  const text = await generateText({
    prompt,
    system: 'You are a concise coding assistant helping with the Whale marketplace project.',
    model: cfg.model,
    maxTokens: getDefaultMaxTokens()
  });

  process.stdout.write(`Provider: ${provider}\nModel: ${cfg.model}\n\n${text}\n`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`[claude-check] ${error.message}`);
  process.exit(1);
});
