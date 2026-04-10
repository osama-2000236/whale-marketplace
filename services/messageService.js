const prisma = require('../lib/prisma');

const hasDatabase = Boolean(process.env.DATABASE_URL);

/**
 * Send a message between users (buyer ↔ seller).
 */
async function sendMessage(senderId, receiverId, body, orderId = null) {
  if (!hasDatabase) throw new Error('DATABASE_REQUIRED');

  if (!body || !body.trim()) throw new Error('EMPTY_MESSAGE');
  if (senderId === receiverId) throw new Error('SELF_MESSAGE');

  const message = await prisma.message.create({
    data: {
      senderId,
      receiverId,
      body: body.trim(),
      orderId: orderId || null,
    },
  });

  // Create notification for receiver
  try {
    await prisma.notification.create({
      data: {
        userId: receiverId,
        type: 'MESSAGE',
        payload: {
          messageId: message.id,
          senderId,
          preview: body.trim().slice(0, 80),
          orderId: orderId || undefined,
        },
      },
    });
  } catch (_err) {
    // Non-critical — notification failure shouldn't block message send
  }

  return message;
}

/**
 * Get conversation between two users, optionally scoped to an order.
 */
async function getConversation(userA, userB, { orderId, page = 1, limit = 50 } = {}) {
  if (!hasDatabase) return { messages: [], total: 0 };

  const where = {
    OR: [
      { senderId: userA, receiverId: userB },
      { senderId: userB, receiverId: userA },
    ],
  };
  if (orderId) where.orderId = orderId;

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true } },
      },
    }),
    prisma.message.count({ where }),
  ]);

  return {
    messages: messages.reverse(), // chronological order
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get inbox: list of unique conversations for a user.
 */
async function getInbox(userId, { page = 1, limit = 20 } = {}) {
  if (!hasDatabase) return { conversations: [], total: 0 };

  // Get latest message per conversation partner using raw query for efficiency
  const conversations = await prisma.$queryRaw`
    SELECT DISTINCT ON (partner_id) *
    FROM (
      SELECT
        m.*,
        CASE WHEN m."senderId" = ${userId} THEN m."receiverId" ELSE m."senderId" END AS partner_id
      FROM "Message" m
      WHERE m."senderId" = ${userId} OR m."receiverId" = ${userId}
    ) sub
    ORDER BY partner_id, "createdAt" DESC
  `;

  // Enrich with partner info
  const partnerIds = conversations.map((c) => c.partner_id);
  const partners = partnerIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: partnerIds } },
        select: { id: true, username: true, avatarUrl: true },
      })
    : [];

  const partnerMap = new Map(partners.map((p) => [p.id, p]));

  // Count unread per partner
  const unreadCounts = await prisma.message.groupBy({
    by: ['senderId'],
    where: {
      receiverId: userId,
      isRead: false,
      senderId: { in: partnerIds },
    },
    _count: true,
  });
  const unreadMap = new Map(unreadCounts.map((u) => [u.senderId, u._count]));

  const enriched = conversations
    .map((c) => ({
      partnerId: c.partner_id,
      partner: partnerMap.get(c.partner_id) || null,
      lastMessage: c.body,
      lastMessageAt: c.createdAt,
      unread: unreadMap.get(c.partner_id) || 0,
      orderId: c.orderId,
    }))
    .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

  const start = (page - 1) * limit;
  return {
    conversations: enriched.slice(start, start + limit),
    total: enriched.length,
    page,
    limit,
    totalPages: Math.ceil(enriched.length / limit),
  };
}

/**
 * Mark all messages from a sender as read.
 */
async function markAsRead(receiverId, senderId) {
  if (!hasDatabase) return { count: 0 };

  const result = await prisma.message.updateMany({
    where: { senderId, receiverId, isRead: false },
    data: { isRead: true },
  });

  return { count: result.count };
}

/**
 * Get total unread message count for a user.
 */
async function getUnreadCount(userId) {
  if (!hasDatabase) return 0;
  return prisma.message.count({
    where: { receiverId: userId, isRead: false },
  });
}

module.exports = {
  sendMessage,
  getConversation,
  getInbox,
  markAsRead,
  getUnreadCount,
};
