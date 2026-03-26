// Pure state machine — no database dependencies, easily testable

const TRANSITIONS = {
  PENDING: { confirm: 'CONFIRMED', cancel: 'CANCELLED' },
  CONFIRMED: { ship: 'SHIPPED', cancel: 'CANCELLED' },
  SHIPPED: { deliver: 'COMPLETED', dispute: 'DISPUTED' },
  DELIVERED: { deliver: 'COMPLETED', dispute: 'DISPUTED' },
  DISPUTED: { resolve: null },
};

const ACTOR_RULES = {
  confirm: ['seller'],
  ship: ['seller'],
  deliver: ['buyer'],
  cancel: ['buyer', 'seller'],
  dispute: ['buyer'],
  resolve: ['admin'],
};

function validateTransition(order, actorId, actorRole, action, payload = {}) {
  const currentStatus = order.status;
  const allowed = TRANSITIONS[currentStatus];

  if (!allowed || !(action in allowed)) {
    throw new Error('INVALID_TRANSITION');
  }

  const allowedActors = ACTOR_RULES[action];
  let actorType = null;
  if (actorRole === 'ADMIN') actorType = 'admin';
  else if (actorId === order.sellerId) actorType = 'seller';
  else if (actorId === order.buyerId) actorType = 'buyer';

  if (!actorType || !allowedActors.includes(actorType)) {
    throw new Error('UNAUTHORIZED_ACTOR');
  }

  if (action === 'ship' && !payload.trackingNumber) {
    throw new Error('MISSING_TRACKING');
  }
  if (action === 'cancel' && !payload.reason) {
    throw new Error('MISSING_REASON');
  }

  let newStatus = TRANSITIONS[currentStatus][action];
  if (action === 'resolve') {
    if (payload.resolution === 'complete') newStatus = 'COMPLETED';
    else if (payload.resolution === 'cancel') newStatus = 'CANCELLED';
    else throw new Error('INVALID_RESOLUTION');
  }

  return newStatus;
}

module.exports = { validateTransition, TRANSITIONS, ACTOR_RULES };
