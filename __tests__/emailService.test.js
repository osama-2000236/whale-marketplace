jest.mock('../lib/mailer', () => ({
  sendMail: jest.fn(() => Promise.resolve()),
  emailTemplate: jest.fn((payload) => JSON.stringify(payload)),
}));

const mailer = require('../lib/mailer');
const emailService = require('../services/emailService');

describe('emailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mailer.sendMail.mockImplementation(() => Promise.resolve());
  });

  test('sendWelcome sends welcome email', async () => {
    await emailService.sendWelcome({ email: 'user@test.com', username: 'osama' });
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    expect(mailer.sendMail.mock.calls[0][0].to).toBe('user@test.com');
  });

  test('sendOrderPlaced skips when seller is missing', async () => {
    await emailService.sendOrderPlaced({ orderNumber: 'O-1' });
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  test('sendOrderPlaced sends when seller exists', async () => {
    await emailService.sendOrderPlaced({
      orderNumber: 'O-2',
      seller: { email: 'seller@test.com' },
    });
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
  });

  test('sendOrderConfirmed skips when buyer is missing', async () => {
    await emailService.sendOrderConfirmed({ orderNumber: 'O-3' });
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  test('sendOrderShipped includes tracking in template body', async () => {
    await emailService.sendOrderShipped({
      orderNumber: 'O-4',
      trackingNumber: 'TRK-1',
      buyer: { email: 'buyer@test.com' },
    });
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    const templatePayload = mailer.emailTemplate.mock.calls[0][0];
    expect(templatePayload.bodyEn).toContain('TRK-1');
  });

  test('sendOrderCompleted sends to buyer and seller', async () => {
    await emailService.sendOrderCompleted({
      orderNumber: 'O-5',
      buyer: { email: 'buyer@test.com' },
      seller: { email: 'seller@test.com' },
    });
    expect(mailer.sendMail).toHaveBeenCalledTimes(2);
  });

  test('sendOrderCompleted works with one side only', async () => {
    await emailService.sendOrderCompleted({
      orderNumber: 'O-6',
      buyer: { email: 'buyer@test.com' },
    });
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
  });

  test('sendTrialEnding sends reminder', async () => {
    await emailService.sendTrialEnding({ email: 'trial@test.com' }, 3);
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
  });

  test('send helpers swallow mail errors without throwing', async () => {
    mailer.sendMail.mockImplementation(() => Promise.reject(new Error('smtp down')));
    await expect(
      emailService.sendWelcome({ email: 'x@test.com', username: 'x' })
    ).resolves.toBeUndefined();
    await expect(
      emailService.sendOrderShipped({ orderNumber: 'O-7', buyer: { email: 'b@test.com' } })
    ).resolves.toBeUndefined();
  });

  test('sendVerificationEmail sends verification link', async () => {
    await emailService.sendVerificationEmail(
      { email: 'user@test.com', username: 'osama' },
      'abc123token'
    );
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    expect(mailer.sendMail.mock.calls[0][0].to).toBe('user@test.com');
    expect(mailer.sendMail.mock.calls[0][0].subject).toContain('Verify');
    const templatePayload = mailer.emailTemplate.mock.calls[0][0];
    expect(templatePayload.bodyEn).toContain('abc123token');
  });

  test('sendPasswordReset sends reset link', async () => {
    await emailService.sendPasswordReset(
      { email: 'user@test.com', username: 'osama' },
      'resettoken456'
    );
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    expect(mailer.sendMail.mock.calls[0][0].to).toBe('user@test.com');
    expect(mailer.sendMail.mock.calls[0][0].subject).toContain('Reset');
    const templatePayload = mailer.emailTemplate.mock.calls[0][0];
    expect(templatePayload.bodyEn).toContain('resettoken456');
  });

  test('sendVerificationEmail swallows errors', async () => {
    mailer.sendMail.mockImplementation(() => Promise.reject(new Error('smtp down')));
    await expect(
      emailService.sendVerificationEmail({ email: 'x@test.com', username: 'x' }, 'tok')
    ).resolves.toBeUndefined();
  });

  test('sendPasswordReset swallows errors', async () => {
    mailer.sendMail.mockImplementation(() => Promise.reject(new Error('smtp down')));
    await expect(
      emailService.sendPasswordReset({ email: 'x@test.com', username: 'x' }, 'tok')
    ).resolves.toBeUndefined();
  });
});
