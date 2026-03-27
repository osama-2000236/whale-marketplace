jest.mock('../lib/prisma', () => ({
  listing: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  order: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
  coupon: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  cartItem: {
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(require('../lib/prisma'))),
}));

jest.mock('../services/cartService', () => ({
  getCartSummary: jest.fn(),
  getOrCreateCart: jest.fn(),
}));

jest.mock('../services/emailService', () => ({
  sendOrderPlaced: jest.fn(() => Promise.resolve()),
}));

const prisma = require('../lib/prisma');
const cartService = require('../services/cartService');
const emailService = require('../services/emailService');
const checkoutService = require('../services/checkoutService');

const mockListing = {
  id: 'l1',
  title: 'Test Item',
  price: '25.00',
  currency: 'USD',
  status: 'ACTIVE',
  stock: 5,
  sellerId: 'seller1',
};

describe('checkoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkoutSingle', () => {
    test('creates order for valid listing', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.order.findFirst.mockResolvedValue(null);
      prisma.order.create.mockResolvedValue({
        id: 'o1',
        orderNumber: 'ON1',
        buyer: { username: 'buyer', email: 'b@b.com' },
        seller: { username: 'seller', email: 's@s.com' },
        listing: mockListing,
      });
      prisma.listing.update.mockResolvedValue({});
      prisma.notification.create.mockResolvedValue({});

      const order = await checkoutService.checkoutSingle('buyer1', 'l1', {
        paymentMethod: 'cod',
        shippingAddress: { street: '123 Main', city: 'Gaza', phone: '0599' },
      });

      expect(order.id).toBe('o1');
      expect(prisma.listing.update).toHaveBeenCalled(); // stock decremented
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(emailService.sendOrderPlaced).toHaveBeenCalled();
    });

    test('rejects non-existent listing', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);
      await expect(
        checkoutService.checkoutSingle('buyer1', 'bad', { paymentMethod: 'cod' }),
      ).rejects.toThrow('LISTING_NOT_FOUND');
    });

    test('prevents buying own listing', async () => {
      prisma.listing.findUnique.mockResolvedValue({ ...mockListing, sellerId: 'buyer1' });
      await expect(
        checkoutService.checkoutSingle('buyer1', 'l1', { paymentMethod: 'cod' }),
      ).rejects.toThrow('CANNOT_BUY_OWN');
    });

    test('rejects inactive listing', async () => {
      prisma.listing.findUnique.mockResolvedValue({ ...mockListing, status: 'SOLD' });
      await expect(
        checkoutService.checkoutSingle('buyer1', 'l1', { paymentMethod: 'cod' }),
      ).rejects.toThrow('LISTING_NOT_AVAILABLE');
    });

    test('rejects insufficient stock', async () => {
      prisma.listing.findUnique.mockResolvedValue({ ...mockListing, stock: 0 });
      await expect(
        checkoutService.checkoutSingle('buyer1', 'l1', { paymentMethod: 'cod', quantity: 1 }),
      ).rejects.toThrow('INSUFFICIENT_STOCK');
    });

    test('rejects duplicate pending order', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.order.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(
        checkoutService.checkoutSingle('buyer1', 'l1', { paymentMethod: 'cod' }),
      ).rejects.toThrow('ORDER_ALREADY_PENDING');
    });
  });

  describe('checkoutFromCart', () => {
    test('rejects empty cart', async () => {
      cartService.getCartSummary.mockResolvedValue({
        cart: { id: 'c1', items: [] },
        itemCount: 0,
        total: '0.00',
      });
      await expect(
        checkoutService.checkoutFromCart('buyer1', { paymentMethod: 'cod' }),
      ).rejects.toThrow('CART_EMPTY');
    });

    test('creates orders grouped by seller', async () => {
      const items = [
        {
          id: 'ci1', listingId: 'l1', quantity: 1,
          listing: { ...mockListing, sellerId: 'seller1' },
        },
        {
          id: 'ci2', listingId: 'l2', quantity: 2,
          listing: { ...mockListing, id: 'l2', sellerId: 'seller2', price: '10.00' },
        },
      ];
      cartService.getCartSummary.mockResolvedValue({
        cart: { id: 'c1', items },
        itemCount: 2,
        total: '45.00',
      });
      prisma.order.create.mockResolvedValue({
        id: 'o1',
        orderNumber: 'ON1',
        buyer: { username: 'buyer', email: 'b@b.com' },
        seller: { username: 'seller', email: 's@s.com' },
        listing: mockListing,
      });
      prisma.listing.update.mockResolvedValue({});
      prisma.notification.create.mockResolvedValue({});
      prisma.cartItem.deleteMany.mockResolvedValue({});

      const orders = await checkoutService.checkoutFromCart('buyer1', {
        paymentMethod: 'cod',
        shippingAddress: { street: '123', city: 'Gaza', phone: '0599' },
      });

      expect(orders).toHaveLength(2);
      expect(prisma.order.create).toHaveBeenCalledTimes(2);
    });

    test('rejects invalid coupon', async () => {
      cartService.getCartSummary.mockResolvedValue({
        cart: { id: 'c1', items: [{ id: 'ci1', listingId: 'l1', quantity: 1, listing: mockListing }] },
        itemCount: 1,
        total: '25.00',
      });
      prisma.coupon.findUnique.mockResolvedValue(null);

      await expect(
        checkoutService.checkoutFromCart('buyer1', {
          paymentMethod: 'cod',
          shippingAddress: {},
          couponCode: 'INVALID',
        }),
      ).rejects.toThrow('INVALID_COUPON');
    });
  });
});
