const { normalizeProviderError } = require('../../../services/claudeService');

describe('claudeService error normalization', () => {
  test('explains OpenRouter 402 with model context', () => {
    const error = {
      response: {
        status: 402,
        data: {
          error: {
            message: 'This endpoint requires a paid account.'
          }
        }
      }
    };

    const normalized = normalizeProviderError('openrouter', error, 'anthropic/claude-opus-4.6');

    expect(normalized.message).toContain('OpenRouter rejected the request (402)');
    expect(normalized.message).toContain('requires a paid account');
    expect(normalized.message).toContain('anthropic/claude-opus-4.6');
  });

  test('explains Anthropic low-credit failures clearly', () => {
    const error = {
      status: 400,
      message: 'Your credit balance is too low to access the Anthropic API.'
    };

    const normalized = normalizeProviderError('anthropic', error, 'claude-sonnet-4-6');

    expect(normalized.message).toContain('Anthropic rejected the request because the account has no usable credits');
    expect(normalized.message).toContain('claude-sonnet-4-6');
  });
});
