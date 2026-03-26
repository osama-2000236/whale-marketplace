const { validateTransition } = require('../services/stateMachine');

function makeOrder(status) {
  return { id: 'o1', status, buyerId: 'buyer1', sellerId: 'seller1' };
}

describe('DELIVERED state transitions', () => {
  test('complete by buyer → COMPLETED', () => {
    expect(validateTransition(makeOrder('DELIVERED'), 'buyer1', 'MEMBER', 'complete')).toBe(
      'COMPLETED'
    );
  });

  test('dispute by buyer → DISPUTED', () => {
    expect(validateTransition(makeOrder('DELIVERED'), 'buyer1', 'MEMBER', 'dispute')).toBe(
      'DISPUTED'
    );
  });

  test('complete by seller → UNAUTHORIZED_ACTOR', () => {
    expect(() =>
      validateTransition(makeOrder('DELIVERED'), 'seller1', 'MEMBER', 'complete')
    ).toThrow('UNAUTHORIZED_ACTOR');
  });

  test('ship on DELIVERED → INVALID_TRANSITION', () => {
    expect(() =>
      validateTransition(makeOrder('DELIVERED'), 'seller1', 'MEMBER', 'ship')
    ).toThrow('INVALID_TRANSITION');
  });
});
