jest.mock('../lib/prisma', () => ({
  cart: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  cartItem: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
  },
  listing: {
    findUnique: jest.fn(),
  },
}));

process.env.DATABASE_URL = 'postgresql://test/db';

const prisma = require('../lib/prisma');
const cartService = require('../services/cartService');

const mockListing = {
  id: 'l1',
  title: 'Test Item',
  price: '25.00',
  currency: 'USD',
  status: 'ACTIVE',
  stock: 5,
  sellerId: 'seller1',
  category: { name: 'Electronics' },
  seller: { username: 'seller', avatarUrl: null },
};

const mockCart = {
  id: 'cart1',
  userId: 'user1',
  items: [],
};

describe('cartService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateCart', () => {
    test('returns existing cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(mockCart);
      const cart = await cartService.getOrCreateCart('user1');
      expect(cart).toEqual(mockCart);
    });

    test('creates new cart if none exists', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);
      prisma.cart.create.mockResolvedValue(mockCart);
      const cart = await cartService.getOrCreateCart('user1');
      expect(cart).toEqual(mockCart);
      expect(prisma.cart.create).toHaveBeenCalled();
    });
  });

  describe('addItem', () => {
    test('throws for non-existent listing', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);
      await expect(cartService.addItem('user1', 'bad')).rejects.toThrow('LISTING_NOT_FOUND');
    });

    test('throws for inactive listing', async () => {
      prisma.listing.findUnique.mockResolvedValue({ ...mockListing, status: 'SOLD' });
      await expect(cartService.addItem('user1', 'l1')).rejects.toThrow('LISTING_NOT_AVAILABLE');
    });

    test('prevents buying own listing', async () => {
      prisma.listing.findUnique.mockResolvedValue({ ...mockListing, sellerId: 'user1' });
      await expect(cartService.addItem('user1', 'l1')).rejects.toThrow('CANNOT_BUY_OWN');
    });

    test('throws for insufficient stock', async () => {
      prisma.listing.findUnique.mockResolvedValue({ ...mockListing, stock: 0 });
      await expect(cartService.addItem('user1', 'l1', 1)).rejects.toThrow('INSUFFICIENT_STOCK');
    });

    test('adds new item to cart', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.cart.findUnique.mockResolvedValue(mockCart);
      prisma.cartItem.create.mockResolvedValue({});
      // Second findUnique call for return value
      prisma.cart.findUnique
        .mockResolvedValueOnce(mockCart)
        .mockResolvedValueOnce({ ...mockCart, items: [{ id: 'ci1', listingId: 'l1', quantity: 1 }] });

      await cartService.addItem('user1', 'l1', 1);
      expect(prisma.cartItem.create).toHaveBeenCalled();
    });

    test('increments quantity for existing item', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.cart.findUnique.mockResolvedValue({
        ...mockCart,
        items: [{ id: 'ci1', listingId: 'l1', quantity: 1 }],
      });
      prisma.cartItem.update.mockResolvedValue({});

      await cartService.addItem('user1', 'l1', 2);
      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'ci1' },
        data: { quantity: 3 },
      });
    });
  });

  describe('updateItemQuantity', () => {
    test('throws for missing cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);
      await expect(cartService.updateItemQuantity('user1', 'ci1', 2)).rejects.toThrow('CART_NOT_FOUND');
    });

    test('throws for non-existent item', async () => {
      prisma.cart.findUnique.mockResolvedValue(mockCart);
      prisma.cartItem.findFirst.mockResolvedValue(null);
      await expect(cartService.updateItemQuantity('user1', 'ci1', 2)).rejects.toThrow('ITEM_NOT_FOUND');
    });

    test('removes item when quantity < 1', async () => {
      prisma.cart.findUnique
        .mockResolvedValueOnce(mockCart)
        .mockResolvedValueOnce(mockCart);
      prisma.cartItem.findFirst.mockResolvedValue({ id: 'ci1', listing: mockListing });
      prisma.cartItem.delete.mockResolvedValue({});

      await cartService.updateItemQuantity('user1', 'ci1', 0);
      expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: 'ci1' } });
    });
  });

  describe('removeItem', () => {
    test('removes item from cart', async () => {
      prisma.cart.findUnique
        .mockResolvedValueOnce(mockCart)
        .mockResolvedValueOnce(mockCart);
      prisma.cartItem.findFirst.mockResolvedValue({ id: 'ci1' });
      prisma.cartItem.delete.mockResolvedValue({});

      await cartService.removeItem('user1', 'ci1');
      expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: 'ci1' } });
    });

    test('throws for non-existent item', async () => {
      prisma.cart.findUnique.mockResolvedValue(mockCart);
      prisma.cartItem.findFirst.mockResolvedValue(null);
      await expect(cartService.removeItem('user1', 'ci1')).rejects.toThrow('ITEM_NOT_FOUND');
    });
  });

  describe('clearCart', () => {
    test('clears all items', async () => {
      prisma.cart.findUnique
        .mockResolvedValueOnce(mockCart)
        .mockResolvedValueOnce(mockCart);
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 3 });

      await cartService.clearCart('user1');
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 'cart1' } });
    });

    test('returns empty for non-existent cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);
      const result = await cartService.clearCart('user1');
      expect(result.items).toEqual([]);
    });
  });

  describe('getCartSummary', () => {
    test('calculates total correctly', async () => {
      prisma.cart.findUnique.mockResolvedValue({
        ...mockCart,
        items: [
          { id: 'ci1', listingId: 'l1', quantity: 2, listing: { ...mockListing, price: '10.00' } },
          { id: 'ci2', listingId: 'l2', quantity: 1, listing: { ...mockListing, id: 'l2', price: '30.00' } },
        ],
      });

      const summary = await cartService.getCartSummary('user1');
      expect(summary.itemCount).toBe(2);
      expect(summary.total).toBe('50.00');
      expect(summary.currency).toBe('USD');
    });

    test('filters out inactive listings', async () => {
      prisma.cart.findUnique.mockResolvedValue({
        ...mockCart,
        items: [
          { id: 'ci1', listingId: 'l1', quantity: 1, listing: { ...mockListing, price: '10.00' } },
          { id: 'ci2', listingId: 'l2', quantity: 1, listing: { ...mockListing, id: 'l2', status: 'SOLD', price: '30.00' } },
        ],
      });

      const summary = await cartService.getCartSummary('user1');
      expect(summary.itemCount).toBe(1);
      expect(summary.total).toBe('10.00');
    });
  });
});
