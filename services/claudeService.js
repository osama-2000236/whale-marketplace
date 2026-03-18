'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

function getDefaultMaxTokens() {
  const raw = parseInt(process.env.CLAUDE_MAX_TOKENS || '512', 10);
  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  return 512;
}

function extractProviderMessage(error) {
  const data = error?.response?.data;
  if (typeof data?.error?.message === 'string' && data.error.message.trim()) {
    return data.error.message.trim();
  }
  if (typeof data?.message === 'string' && data.message.trim()) {
    return data.message.trim();
  }
  if (typeof error?.error?.message === 'string' && error.error.message.trim()) {
    return error.error.message.trim();
  }
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  return '';
}

function normalizeProviderError(provider, error, model) {
  const status = error?.response?.status || error?.status || error?.statusCode || null;
  const message = extractProviderMessage(error);
  const modelText = model ? ` Model: ${model}.` : '';

  if (provider === 'openrouter') {
    if (status === 401) {
      return new Error(`OpenRouter rejected the API key (401). Check OPENROUTER_API_KEY or CLAUDE_PROVIDER.${modelText}`);
    }
    if (status === 402) {
      const detail = message || 'Payment or model access is not enabled for this account.';
      return new Error(`OpenRouter rejected the request (402): ${detail} This usually means the account has no credits or the selected model requires paid access.${modelText}`);
    }
    if (status) {
      return new Error(`OpenRouter request failed (${status}): ${message || 'No error body returned.'}${modelText}`);
    }
  }

  if (provider === 'anthropic') {
    if (status === 401) {
      return new Error(`Anthropic rejected the API key (401). Check ANTHROPIC_API_KEY.${modelText}`);
    }
    if (status === 402 || /credit balance is too low/i.test(message)) {
      return new Error(`Anthropic rejected the request because the account has no usable credits. Add API credits or switch providers.${modelText}`);
    }
    if (status) {
      return new Error(`Anthropic request failed (${status}): ${message || 'No error body returned.'}${modelText}`);
    }
  }

  return new Error(message || `${provider} request failed`);
}

function detectProvider() {
  const explicit = (process.env.CLAUDE_PROVIDER || process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (['anthropic', 'openrouter'].includes(explicit)) {
    return explicit;
  }

  if ((process.env.OPENROUTER_API_KEY || '').trim()) {
    return 'openrouter';
  }

  const anthropicKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (anthropicKey.startsWith('sk-or-v1-')) {
    return 'openrouter';
  }

  return 'anthropic';
}

function getClaudeConfig() {
  const provider = detectProvider();

  if (provider === 'openrouter') {
    return {
      provider,
      apiKey: (process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || '').trim(),
      model: (process.env.OPENROUTER_MODEL || process.env.ANTHROPIC_MODEL || '').trim() || 'anthropic/claude-sonnet-4.6',
      baseURL: 'https://openrouter.ai/api/v1/chat/completions'
    };
  }

  return {
    provider: 'anthropic',
    apiKey: (process.env.ANTHROPIC_API_KEY || '').trim(),
    model: (process.env.ANTHROPIC_MODEL || '').trim() || 'claude-sonnet-4-6'
  };
}

function isConfigured() {
  return Boolean(getClaudeConfig().apiKey);
}

function getAnthropicClient(apiKey) {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  return new Anthropic({ apiKey });
}

async function generateViaAnthropic({ apiKey, model, prompt, system, maxTokens, temperature }) {
  try {
    const client = getAnthropicClient(apiKey);
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      ...(system ? { system } : {}),
      messages: [
        {
          role: 'user',
          content: String(prompt)
        }
      ]
    });

    return response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
  } catch (error) {
    throw normalizeProviderError('anthropic', error, model);
  }
}

async function generateViaOpenRouter({ apiKey, model, prompt, system, maxTokens, temperature }) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  const siteUrl = process.env.SITE_URL || process.env.BASE_URL || 'http://localhost:3000';
  headers['HTTP-Referer'] = siteUrl;
  headers['X-Title'] = 'Whale Marketplace Agent';

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: String(prompt) }
        ]
      },
      { headers, timeout: 120000 }
    );

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('OpenRouter returned no message content');
    }

    return String(text).trim();
  } catch (error) {
    throw normalizeProviderError('openrouter', error, model);
  }
}

async function generateText({ prompt, system, model, maxTokens = getDefaultMaxTokens(), temperature = 0.2 }) {
  if (!prompt || !String(prompt).trim()) {
    throw new Error('prompt is required');
  }

  const cfg = getClaudeConfig();
  const selectedModel = model || cfg.model;

  if (!cfg.apiKey) {
    throw new Error(`${cfg.provider.toUpperCase()} API key is not configured`);
  }

  if (cfg.provider === 'openrouter') {
    return generateViaOpenRouter({
      apiKey: cfg.apiKey,
      model: selectedModel,
      prompt,
      system,
      maxTokens,
      temperature
    });
  }

  return generateViaAnthropic({
    apiKey: cfg.apiKey,
    model: selectedModel,
    prompt,
    system,
    maxTokens,
    temperature
  });
}

module.exports = {
  detectProvider,
  getClaudeConfig,
  getDefaultMaxTokens,
  isConfigured,
  generateText,
  normalizeProviderError
};
