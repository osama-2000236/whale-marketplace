jest.mock('../lib/prisma', () => ({
  category: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  listing: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  order: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
  savedListing: {
    findUnique: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
  sellerProfile: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  review: {
    create: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
}));

jest.mock('../services/emailService', () => ({
  sendOrderPlaced: jest.fn(() => Promise.resolve()),
  sendOrderConfirmed: jest.fn(() => Promise.resolve()),
  sendOrderShipped: jest.fn(() => Promise.resolve()),
  sendOrderCompleted: jest.fn(() => Promise.resolve()),
}));

jest.mock('../services/stateMachine', () => ({
  validateTransition: jest.fn(),
}));

const prisma = require('../lib/prisma');
const emailService = require('../services/emailService');
const { validateTransition } = require('../services/stateMachine');
const whaleService = require('../services/whaleService');

describe('whaleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getListings applies filters, sort and cursor pagination', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
    prisma.listing.findMany.mockResolvedValue([{ id: 'l1' }, { id: 'l2' }]);
    prisma.listing.count.mockResolvedValue(2);

    const result = await whaleService.getListings({
      q: 'phone',
      categorySlug: 'electronics',
      city: 'Gaza',
      condition: 'NEW',
      minPrice: '10',
      maxPrice: '99',
      sort: 'price_desc',
      cursor: 'cursor-123',
    });

    expect(prisma.category.findUnique).toHaveBeenCalledWith({
      where: { slug: 'electronics' },
    });
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          categoryId: 'cat-1',
          city: 'Gaza',
          condition: 'NEW',
        }),
        orderBy: { price: 'desc' },
        cursor: { id: 'cursor-123' },
        skip: 1,
      })
    );
    expect(result).toEqual({
      listings: [{ id: 'l1' }, { id: 'l2' }],
      nextCursor: null,
      total: 2,
    });
  });

  test('createListing validates required fields', async () => {
    await expect(whaleService.createListing('seller-1', { price: 50 })).rejects.toThrow(
      'TITLE_REQUIRED'
    );
    await expect(
      whaleService.createListing('seller-1', {
        title: 'Phone',
        price: 0,
        images: ['x'],
        categoryId: 'c1',
      })
    ).rejects.toThrow('INVALID_PRICE');
  });

  test('createListing handles slug collision and normalizes tags/negotiable', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
    prisma.listing.findUnique.mockResolvedValue({ id: 'existing' });
    prisma.listing.create.mockResolvedValue({ id: 'listing-1', slug: 'my-phone-abc12' });

    await whaleService.createListing('seller-1', {
      title: 'My Phone',
      description: 'Great phone',
      price: '99.5',
      images: ['/img/a.jpg'],
      categoryId: 'cat-1',
      tags: 'apple, ios, , phone',
      negotiable: 'on',
      city: 'Gaza',
    });

    expect(prisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerId: 'seller-1',
          categoryId: 'cat-1',
          price: 99.5,
          negotiable: true,
          tags: ['apple', 'ios', 'phone'],
          slug: expect.stringMatching(/^my-phone-/),
        }),
      })
    );
  });

  test('toggleSaved deletes existing saved listing', async () => {
    prisma.savedListing.findUnique.mockResolvedValue({ userId: 'u1', listingId: 'l1' });

    const result = await whaleService.toggleSaved('u1', 'l1');

    expect(prisma.savedListing.delete).toHaveBeenCalledWith({
      where: { userId_listingId: { userId: 'u1', listingId: 'l1' } },
    });
    expect(result).toEqual({ saved: false });
  });

  test('toggleSaved creates a saved listing when not already saved', async () => {
    prisma.savedListing.findUnique.mockResolvedValue(null);

    const result = await whaleService.toggleSaved('u2', 'l2');

    expect(prisma.savedListing.create).toHaveBeenCalledWith({
      data: { userId: 'u2', listingId: 'l2' },
    });
    expect(result).toEqual({ saved: true });
  });

  test('transitionOrder updates state, logs event, sends notification + email', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      orderNumber: 'ORD-001',
      status: 'PENDING',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      buyer: { id: 'buyer-1', role: 'MEMBER', email: 'buyer@test.com', username: 'buyer' },
      seller: { id: 'seller-1', role: 'MEMBER', email: 'seller@test.com', username: 'seller' },
      listing: { title: 'Item' },
    });
    validateTransition.mockReturnValue('CONFIRMED');
    prisma.order.update.mockResolvedValue({
      id: 'o1',
      orderNumber: 'ORD-001',
      status: 'CONFIRMED',
      buyer: { email: 'buyer@test.com' },
      seller: { email: 'seller@test.com' },
      listing: { title: 'Item' },
      events: [],
    });

    const result = await whaleService.transitionOrder('o1', 'seller-1', 'confirm');

    expect(validateTransition).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING' }),
      'seller-1',
      'MEMBER',
      'confirm',
      {}
    );
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'o1' },
        data: expect.objectContaining({
          status: 'CONFIRMED',
          events: { create: expect.objectContaining({ event: 'confirm', actorId: 'seller-1' }) },
        }),
      })
    );
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'buyer-1' }),
      })
    );
    expect(emailService.sendOrderConfirmed).toHaveBeenCalled();
    expect(result.status).toBe('CONFIRMED');
  });
});
