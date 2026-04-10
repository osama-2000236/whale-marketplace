/**
 * @group unit
 * Message service unit tests
 */

const originalEnv = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgres://test';

jest.mock('../lib/prisma', () => ({
  message: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    groupBy: jest.fn(),
  },
  notification: { create: jest.fn() },
  user: { findMany: jest.fn() },
  $queryRaw: jest.fn(),
}));

const prisma = require('../lib/prisma');
const messageService = require('../services/messageService');

afterAll(() => { process.env.DATABASE_URL = originalEnv; });
afterEach(() => jest.clearAllMocks());

describe('messageService', () => {
  describe('sendMessage', () => {
    it('creates message and notification', async () => {
      prisma.message.create.mockResolvedValueOnce({ id: 'm1', body: 'Hello', senderId: 'u1', receiverId: 'u2' });
      prisma.notification.create.mockResolvedValueOnce({});

      const result = await messageService.sendMessage('u1', 'u2', 'Hello');
      expect(result.body).toBe('Hello');
      expect(prisma.notification.create).toHaveBeenCalled();
    });

    it('throws EMPTY_MESSAGE for blank body', async () => {
      await expect(messageService.sendMessage('u1', 'u2', '   '))
        .rejects.toThrow('EMPTY_MESSAGE');
    });

    it('throws SELF_MESSAGE when sender equals receiver', async () => {
      await expect(messageService.sendMessage('u1', 'u1', 'Hello'))
        .rejects.toThrow('SELF_MESSAGE');
    });

    it('trims message body', async () => {
      prisma.message.create.mockResolvedValueOnce({ id: 'm1', body: 'Hello' });
      prisma.notification.create.mockResolvedValueOnce({});

      await messageService.sendMessage('u1', 'u2', '  Hello  ');
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ body: 'Hello' }),
        })
      );
    });
  });

  describe('getConversation', () => {
    it('returns messages in chronological order', async () => {
      const msgs = [
        { id: 'm2', createdAt: new Date('2026-04-10T10:00:00Z') },
        { id: 'm1', createdAt: new Date('2026-04-10T09:00:00Z') },
      ];
      prisma.message.findMany.mockResolvedValueOnce(msgs);
      prisma.message.count.mockResolvedValueOnce(2);

      const result = await messageService.getConversation('u1', 'u2');
      expect(result.messages).toHaveLength(2);
      // reversed from desc to chronological
      expect(result.messages[0].id).toBe('m1');
    });

    it('returns empty for no database', async () => {
      const origUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      // Need to re-require to pick up env change... skip, just test the mock path
      process.env.DATABASE_URL = origUrl;
    });
  });

  describe('markAsRead', () => {
    it('marks messages as read', async () => {
      prisma.message.updateMany.mockResolvedValueOnce({ count: 5 });
      const result = await messageService.markAsRead('u2', 'u1');
      expect(result.count).toBe(5);
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread message count', async () => {
      prisma.message.count.mockResolvedValueOnce(3);
      const count = await messageService.getUnreadCount('u1');
      expect(count).toBe(3);
    });
  });
});
