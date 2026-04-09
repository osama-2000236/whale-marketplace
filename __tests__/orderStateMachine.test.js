const { validateTransition } = require('../services/stateMachine');

// Helper to make a mock order
function makeOrder(status, buyerId = 'buyer1', sellerId = 'seller1') {
  return { status, buyerId, sellerId };
}

describe('Order State Machine', () => {
  // Valid transitions
  test('PENDING + confirm → CONFIRMED (seller)', () => {
    const order = makeOrder('PENDING');
    const result = validateTransition(order, 'seller1', 'MEMBER', 'confirm');
    expect(result).toBe('CONFIRMED');
  });

  test('PENDING + cancel → CANCELLED (buyer)', () => {
    const order = makeOrder('PENDING');
    const result = validateTransition(order, 'buyer1', 'MEMBER', 'cancel', {
      reason: 'changed mind',
    });
    expect(result).toBe('CANCELLED');
  });

  test('PENDING + cancel → CANCELLED (seller)', () => {
    const order = makeOrder('PENDING');
    const result = validateTransition(order, 'seller1', 'MEMBER', 'cancel', {
      reason: 'out of stock',
    });
    expect(result).toBe('CANCELLED');
  });

  test('CONFIRMED + ship + trackingNumber → SHIPPED (seller)', () => {
    const order = makeOrder('CONFIRMED');
    const result = validateTransition(order, 'seller1', 'MEMBER', 'ship', {
      trackingNumber: 'TRK-123',
    });
    expect(result).toBe('SHIPPED');
  });

  test('CONFIRMED + cancel → CANCELLED (buyer)', () => {
    const order = makeOrder('CONFIRMED');
    const result = validateTransition(order, 'buyer1', 'MEMBER', 'cancel', { reason: 'too slow' });
    expect(result).toBe('CANCELLED');
  });

  test('SHIPPED + deliver → DELIVERED (buyer)', () => {
    const order = makeOrder('SHIPPED');
    const result = validateTransition(order, 'buyer1', 'MEMBER', 'deliver');
    expect(result).toBe('DELIVERED');
  });

  test('SHIPPED + dispute → DISPUTED (buyer)', () => {
    const order = makeOrder('SHIPPED');
    const result = validateTransition(order, 'buyer1', 'MEMBER', 'dispute');
    expect(result).toBe('DISPUTED');
  });

  test('DELIVERED + complete → COMPLETED (buyer)', () => {
    const order = makeOrder('DELIVERED');
    const result = validateTransition(order, 'buyer1', 'MEMBER', 'complete');
    expect(result).toBe('COMPLETED');
  });

  test('DELIVERED + dispute → DISPUTED (buyer)', () => {
    const order = makeOrder('DELIVERED');
    const result = validateTransition(order, 'buyer1', 'MEMBER', 'dispute');
    expect(result).toBe('DISPUTED');
  });

  test('DISPUTED + resolve(complete) → COMPLETED (admin)', () => {
    const order = makeOrder('DISPUTED');
    const result = validateTransition(order, 'admin1', 'ADMIN', 'resolve', {
      resolution: 'complete',
    });
    expect(result).toBe('COMPLETED');
  });

  test('DISPUTED + resolve(cancel) → CANCELLED (admin)', () => {
    const order = makeOrder('DISPUTED');
    const result = validateTransition(order, 'admin1', 'ADMIN', 'resolve', {
      resolution: 'cancel',
    });
    expect(result).toBe('CANCELLED');
  });

  test('DISPUTED + resolve(invalid) → throws INVALID_RESOLUTION (admin)', () => {
    const order = makeOrder('DISPUTED');
    expect(() =>
      validateTransition(order, 'admin1', 'ADMIN', 'resolve', { resolution: 'retry' })
    ).toThrow('INVALID_RESOLUTION');
  });

  // Invalid transitions
  test('COMPLETED + cancel → throws INVALID_TRANSITION', () => {
    const order = makeOrder('COMPLETED');
    expect(() => validateTransition(order, 'buyer1', 'MEMBER', 'cancel', { reason: 'x' })).toThrow(
      'INVALID_TRANSITION'
    );
  });

  test('CANCELLED + confirm → throws INVALID_TRANSITION', () => {
    const order = makeOrder('CANCELLED');
    expect(() => validateTransition(order, 'seller1', 'MEMBER', 'confirm')).toThrow(
      'INVALID_TRANSITION'
    );
  });

  test('PENDING + ship → throws INVALID_TRANSITION', () => {
    const order = makeOrder('PENDING');
    expect(() =>
      validateTransition(order, 'seller1', 'MEMBER', 'ship', { trackingNumber: 'X' })
    ).toThrow('INVALID_TRANSITION');
  });

  test('PENDING + dispute → throws INVALID_TRANSITION', () => {
    const order = makeOrder('PENDING');
    expect(() => validateTransition(order, 'buyer1', 'MEMBER', 'dispute')).toThrow(
      'INVALID_TRANSITION'
    );
  });

  test('SHIPPED + confirm → throws INVALID_TRANSITION', () => {
    const order = makeOrder('SHIPPED');
    expect(() => validateTransition(order, 'seller1', 'MEMBER', 'confirm')).toThrow(
      'INVALID_TRANSITION'
    );
  });

  // Wrong actor
  test('PENDING + confirm → throws UNAUTHORIZED_ACTOR when actor is buyer', () => {
    const order = makeOrder('PENDING');
    expect(() => validateTransition(order, 'buyer1', 'MEMBER', 'confirm')).toThrow(
      'UNAUTHORIZED_ACTOR'
    );
  });

  test('SHIPPED + deliver → throws UNAUTHORIZED_ACTOR when actor is seller', () => {
    const order = makeOrder('SHIPPED');
    expect(() => validateTransition(order, 'seller1', 'MEMBER', 'deliver')).toThrow(
      'UNAUTHORIZED_ACTOR'
    );
  });

  test('SHIPPED + dispute → throws UNAUTHORIZED_ACTOR when actor is seller', () => {
    const order = makeOrder('SHIPPED');
    expect(() => validateTransition(order, 'seller1', 'MEMBER', 'dispute')).toThrow(
      'UNAUTHORIZED_ACTOR'
    );
  });

  test('DISPUTED + resolve → throws UNAUTHORIZED_ACTOR when actor is not admin', () => {
    const order = makeOrder('DISPUTED');
    expect(() =>
      validateTransition(order, 'buyer1', 'MEMBER', 'resolve', { resolution: 'complete' })
    ).toThrow('UNAUTHORIZED_ACTOR');
  });

  // Missing required fields
  test('CONFIRMED + ship without trackingNumber → throws MISSING_TRACKING', () => {
    const order = makeOrder('CONFIRMED');
    expect(() => validateTransition(order, 'seller1', 'MEMBER', 'ship', {})).toThrow(
      'MISSING_TRACKING'
    );
  });

  test('PENDING + cancel without reason → throws MISSING_REASON', () => {
    const order = makeOrder('PENDING');
    expect(() => validateTransition(order, 'buyer1', 'MEMBER', 'cancel', {})).toThrow(
      'MISSING_REASON'
    );
  });
});
