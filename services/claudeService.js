/**
 * Normalize provider API errors into user-friendly messages.
 */
function normalizeProviderError(provider, error, model) {
  const status = error?.response?.status || error?.status || 0;
  const upstream = error?.response?.data?.error?.message || error?.message || 'Unknown error';

  let message;

  if (provider === 'openrouter') {
    message = `OpenRouter rejected the request (${status}): ${upstream}`;
    if (model) message += ` — model: ${model}`;
  } else if (provider === 'anthropic') {
    if (/credit balance/i.test(upstream)) {
      message = `Anthropic rejected the request because the account has no usable credits`;
    } else {
      message = `Anthropic rejected the request (${status}): ${upstream}`;
    }
    if (model) message += ` — model: ${model}`;
  } else {
    message = `${provider} error (${status}): ${upstream}`;
    if (model) message += ` — model: ${model}`;
  }

  return { message, status, provider, model };
}

module.exports = { normalizeProviderError };
