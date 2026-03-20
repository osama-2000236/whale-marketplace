const svc = require('../../../services/whaleService');
const prisma = require('../../../lib/prisma');
const emailService = require('../../../services/emailService');
const { createTestUser, createTestListing, createTestOrder, cleanTestData, skipIfNoDb } = require('../../helpers/db');

// Wrap test() to auto-skip when database is not available
const dbTest = (name, fn) => {
  test(name, async (...args) => {
    if (skipIfNoDb()) return;
    return fn(...args);
  });
};

const dbBeforeAll = (fn) => {
  beforeAll(async () => {
    if (skipIfNoDb()) return;
    return fn();
  });
};

describe('whaleService unit', () => {
  let seller;
  let buyer;

  beforeAll(async () => {
    if (skipIfNoDb()) return;
    await cleanTestData();
    seller = await createTestUser({ username: 'test_svc_seller' });
    buyer = await createTestUser({ username: 'test_svc_buyer' });
  });

  afterAll(async () => {
    if (skipIfNoDb()) return;
    await cleanTestData();
  });

  describe('createListing', () => {
    dbTest('creates listing with required fields', async () => {
      const listing = await svc.createListing(seller.id, {
        title: 'RTX 3060 Ti',
        description: 'Great condition for gaming',
        price: '850',
        condition: 'USED',
        city: 'Tulkarem',
        images: []
      });

      expect(listing.id).toBeDefined();
      expect(listing.title).toBe('RTX 3060 Ti');
      expect(listing.price).toBe(850);
      expect(listing.status).toBe('ACTIVE');
    });

    dbTest('converts price string with comma to float', async () => {
      const listing = await svc.createListing(seller.id, {
        title: 'Price test',
        description: 'desc text long enough',
        price: '1,250.50',
        condition: 'NEW',
        city: 'Ramallah',
        images: []
      });

      expect(listing.price).toBe(1250.5);
    });

    dbTest('handles tags from CSV', async () => {
      const listing = await svc.createListing(seller.id, {
        title: 'Tag test',
        description: 'desc text long enough',
        price: '100',
        condition: 'GOOD',
        city: 'Nablus',
        images: [],
        tags: 'gpu, nvidia, gaming'
      });

      expect(listing.tags).toEqual(['gpu', 'nvidia', 'gaming']);
    });

    dbTest('handles tags from array and generates slug', async () => {
      const listing = await svc.createListing(seller.id, {
        title: 'Array tags listing',
        description: 'desc text long enough',
        price: '120',
        condition: 'GOOD',
        city: 'Nablus',
        images: [],
        tags: ['gpu', 'amd', 'gaming']
      });

      expect(listing.tags).toEqual(['gpu', 'amd', 'gaming']);
      expect(listing.slug).toMatch(/^array-tags-listing-/);
    });

    dbTest('creates seller profile if missing', async () => {
      const newSeller = await createTestUser({ username: 'test_svc_newseller' });
      await svc.createListing(newSeller.id, {
        title: 'New seller listing',
        description: 'desc text long enough',
        price: '200',
        condition: 'NEW',
        city: 'Tulkarem',
        images: []
      });

      const profile = await prisma.sellerProfile.findUnique({ where: { userId: newSeller.id } });
      expect(profile).not.toBeNull();
    });

    dbTest('rejects invalid condition', async () => {
      await expect(svc.createListing(seller.id, {
        title: 'Bad cond',
        description: 'desc text long enough',
        price: '100',
        condition: 'INVALID',
        city: 'Tulkarem',
        images: []
      })).rejects.toThrow('Invalid condition');
    });

    dbTest('rejects xss title', async () => {
      await expect(svc.createListing(seller.id, {
        title: '<script>alert(1)</script>',
        description: 'desc text long enough',
        price: '100',
        condition: 'GOOD',
        city: 'Tulkarem',
        images: []
      })).rejects.toThrow('Invalid title');
    });

    dbTest('sets negotiable from "on" and quantity min 1', async () => {
      const listing = await svc.createListing(seller.id, {
        title: 'Negotiable switch',
        description: 'desc text long enough',
        price: '90',
        condition: 'LIKE_NEW',
        city: 'Nablus',
        negotiable: 'on',
        quantity: 0,
        images: []
      });

      expect(listing.negotiable).toBe(true);
      expect(listing.quantity).toBe(1);
    });
  });

  describe('getListing', () => {
    let listing;

    dbBeforeAll(async () => {
      listing = await createTestListing(seller.id, { title: 'Get listing unit' });
    });

    dbTest('retrieves listing by id', async () => {
      const found = await svc.getListing(listing.id);
      expect(found.id).toBe(listing.id);
      expect(found.seller).toBeDefined();
      expect(found.seller.id).toBe(seller.id);
    });

    dbTest('returns null for missing id', async () => {
      const found = await svc.getListing('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });
  });

  describe('getListings', () => {
    dbBeforeAll(async () => {
      await createTestListing(seller.id, { title: 'RTX 4090', city: 'Ramallah', price: 4000, condition: 'NEW' });
      await createTestListing(seller.id, { title: 'Used Mouse', city: 'Tulkarem', price: 50, condition: 'USED' });
      await createTestListing(seller.id, { title: 'New Keyboard', city: 'Nablus', price: 150, condition: 'NEW' });
    });

    dbTest('returns active listings only', async () => {
      const { listings } = await svc.getListings({});
      listings.forEach((l) => expect(l.status).toBe('ACTIVE'));
    });

    dbTest('filters by city', async () => {
      const { listings } = await svc.getListings({ city: 'Tulkarem' });
      listings.forEach((l) => expect(l.city).toBe('Tulkarem'));
    });

    dbTest('filters by condition', async () => {
      const { listings } = await svc.getListings({ condition: 'NEW' });
      listings.forEach((l) => expect(l.condition).toBe('NEW'));
    });

    dbTest('filters by min/max price', async () => {
      const { listings } = await svc.getListings({ minPrice: '100', maxPrice: '500' });
      listings.forEach((l) => {
        expect(l.price).toBeGreaterThanOrEqual(100);
        expect(l.price).toBeLessThanOrEqual(500);
      });
    });

    dbTest('searches by title keyword', async () => {
      const { listings } = await svc.getListings({ q: 'RTX' });
      expect(listings.length).toBeGreaterThan(0);
      listings.forEach((l) => {
        expect(l.title.toLowerCase()).toContain('rtx');
      });
    });

    dbTest('respects take limit and hasMore', async () => {
      const result = await svc.getListings({ take: 1 });
      expect(result.listings.length).toBeLessThanOrEqual(1);
      expect(result.hasMore).toBe(true);
    });

    dbTest('sorts by cheapest', async () => {
      const { listings } = await svc.getListings({ sort: 'cheapest' });
      for (let i = 1; i < listings.length; i += 1) {
        expect(listings[i].price).toBeGreaterThanOrEqual(listings[i - 1].price);
      }
    });

    dbTest('maps legacy marketplace category slugs to the Whale surface counts and filters', async () => {
      const categories = [
        { name: 'Electronics', nameAr: 'الإلكترونيات', slug: 'electronics', icon: '⚡', order: 1 },
        { name: 'PC Parts', nameAr: 'قطع الكمبيوتر', slug: 'pc-parts', icon: '🧩', order: 2 },
        { name: 'Gaming Gear', nameAr: 'معدات الألعاب', slug: 'gaming-gear', icon: '🎮', order: 3 },
        { name: 'PC & Gaming', nameAr: 'الكمبيوتر والألعاب', slug: 'pc-gaming', icon: '🖥️', order: 4 }
      ];

      for (const category of categories) {
        // eslint-disable-next-line no-await-in-loop
        await prisma.marketCategory.upsert({
          where: { slug: category.slug },
          update: category,
          create: category
        });
      }

      const pcParts = await prisma.marketCategory.findUnique({ where: { slug: 'pc-parts' } });
      const legacyListing = await createTestListing(seller.id, {
        title: 'Legacy category GPU',
        categoryId: pcParts.id,
        city: 'Tulkarem',
        price: 999
      });

      const surfaceResult = await svc.getListings({ category: 'pc-gaming' });
      expect(surfaceResult.listings.map((listing) => listing.id)).toContain(legacyListing.id);

      const legacyResult = await svc.getListings({ category: 'pc-parts' });
      expect(legacyResult.listings.map((listing) => listing.id)).toContain(legacyListing.id);

      const facets = await svc.getListingFacets({});
      expect(facets.categoryCountMap['pc-gaming']).toBeGreaterThanOrEqual(1);
    });
  });

  describe('createOrder', () => {
    let listing;

    dbBeforeAll(async () => {
      listing = await createTestListing(seller.id, { price: 850 });
    });

    dbTest('creates order with valid payload', async () => {
      const order = await svc.createOrder({
        listingId: listing.id,
        buyerId: buyer.id,
        quantity: 1,
        paymentMethod: 'cod',
        shippingMethod: 'company',
        shippingAddress: {
          name: 'Buyer',
          phone: '0599000000',
          city: 'Tulkarem',
          address: 'Street 1'
        }
      });

      expect(order.amount).toBe(850);
      expect(order.orderStatus).toBe('PENDING');
      expect(order.orderNumber).toMatch(/^WH-\d{4}-\d+/);
    });

    dbTest('prevents self-buy', async () => {
      await expect(svc.createOrder({
        listingId: listing.id,
        buyerId: seller.id,
        quantity: 1,
        paymentMethod: 'cod',
        shippingMethod: 'company',
        shippingAddress: {
          name: 'Seller',
          phone: '0599000000',
          city: 'Tulkarem',
          address: 'Street 2'
        }
      })).rejects.toThrow('Cannot buy your own listing');
    });

    dbTest('rejects inactive listing', async () => {
      const inactive = await createTestListing(seller.id, { status: 'SOLD' });
      await expect(svc.createOrder({
        listingId: inactive.id,
        buyerId: buyer.id,
        quantity: 1,
        paymentMethod: 'cod',
        shippingMethod: 'company',
        shippingAddress: {
          name: 'Buyer',
          phone: '0599000000',
          city: 'Tulkarem',
          address: 'Street 3'
        }
      })).rejects.toThrow('Listing not available');
    });

    dbTest('creates timeline and seller notification', async () => {
      const order = await svc.createOrder({
        listingId: listing.id,
        buyerId: buyer.id,
        quantity: 1,
        paymentMethod: 'cod',
        shippingMethod: 'company',
        shippingAddress: {
          name: 'Buyer',
          phone: '0599000011',
          city: 'Nablus',
          address: 'Street 4'
        }
      });

      const events = await prisma.orderEvent.findMany({ where: { orderId: order.id } });
      expect(events.some((e) => e.event === 'created')).toBe(true);

      const notif = await prisma.notification.findFirst({
        where: { userId: seller.id, message: { contains: order.orderNumber } },
        orderBy: { createdAt: 'desc' }
      });
      expect(notif).not.toBeNull();
    });

    dbTest('rejects invalid shipping method', async () => {
      await expect(svc.createOrder({
        listingId: listing.id,
        buyerId: buyer.id,
        quantity: 1,
        paymentMethod: 'cod',
        shippingMethod: 'drone'
      })).rejects.toThrow('Invalid shipping method');
    });

    dbTest('rejects quantity above stock', async () => {
      const lowStock = await createTestListing(seller.id, { quantity: 1, price: 20 });
      await expect(svc.createOrder({
        listingId: lowStock.id,
        buyerId: buyer.id,
        quantity: 3,
        paymentMethod: 'cod',
        shippingMethod: 'self_pickup'
      })).rejects.toThrow('Requested quantity exceeds stock');
    });

    dbTest('card payment starts with held status', async () => {
      const order = await svc.createOrder({
        listingId: listing.id,
        buyerId: buyer.id,
        quantity: 1,
        paymentMethod: 'card',
        shippingMethod: 'self_pickup'
      });
      expect(order.paymentStatus).toBe('held');
    });
  });

  describe('listing mutations', () => {
    let listing;

    dbBeforeAll(async () => {
      listing = await createTestListing(seller.id, {
        title: 'Mutation listing',
        description: 'Before update description',
        price: 300,
        condition: 'USED',
        city: 'Tulkarem',
        quantity: 2
      });
    });

    dbTest('updateListing updates parsed price/tags/specs/quantity', async () => {
      const updated = await svc.updateListing(listing.id, seller.id, {
        titleAr: '',
        descriptionAr: '',
        price: '1,100.25',
        condition: 'GOOD',
        tags: 'gpu, amd',
        specs: { brand: 'AMD', vram: '12GB' },
        quantity: 4,
        negotiable: 'true'
      });

      expect(updated.price).toBe(1100.25);
      expect(updated.condition).toBe('GOOD');
      expect(updated.tags).toEqual(['gpu', 'amd']);
      expect(updated.specs).toMatchObject({ brand: 'AMD' });
      expect(updated.quantity).toBe(4);
      expect(updated.negotiable).toBe(true);
      expect(updated.titleAr).toBeNull();
      expect(updated.descriptionAr).toBeNull();
    });

    dbTest('updateListing handles array tags payload', async () => {
      const updated = await svc.updateListing(listing.id, seller.id, {
        tags: ['rtx', 'used', 'gaming']
      });

      expect(updated.tags).toEqual(['rtx', 'used', 'gaming']);
    });

    dbTest('updateListing rejects invalid price', async () => {
      await expect(svc.updateListing(listing.id, seller.id, {
        price: '-5'
      })).rejects.toThrow('Invalid price');
    });

    dbTest('updateListing rejects invalid condition', async () => {
      await expect(svc.updateListing(listing.id, seller.id, {
        condition: 'broken'
      })).rejects.toThrow('Invalid condition');
    });

    dbTest('updateListing forbids non-owner', async () => {
      await expect(svc.updateListing(listing.id, buyer.id, {
        title: 'Nope'
      })).rejects.toThrow('Forbidden');
    });

    dbTest('markSold updates status for owner', async () => {
      const sellable = await createTestListing(seller.id, { status: 'ACTIVE' });
      const sold = await svc.markSold(sellable.id, seller.id);
      expect(sold.status).toBe('SOLD');
    });

    dbTest('markSold forbids non-owner', async () => {
      const other = await createTestListing(seller.id, { status: 'ACTIVE' });
      await expect(svc.markSold(other.id, buyer.id)).rejects.toThrow('Forbidden');
    });

    dbTest('deleteListing sets removed for owner', async () => {
      const removable = await createTestListing(seller.id, { status: 'ACTIVE' });
      const removed = await svc.deleteListing(removable.id, seller.id);
      expect(removed.status).toBe('REMOVED');
    });

    dbTest('deleteListing allows admin override', async () => {
      const removable = await createTestListing(seller.id, { status: 'ACTIVE' });
      const removed = await svc.deleteListing(removable.id, buyer.id, true);
      expect(removed.status).toBe('REMOVED');
    });

    dbTest('deleteListing rejects missing listing', async () => {
      await expect(svc.deleteListing('00000000-0000-0000-0000-000000000000', seller.id)).rejects.toThrow('Not found');
    });
  });

  describe('createReview', () => {
    let listing;
    let order;

    dbBeforeAll(async () => {
      listing = await createTestListing(seller.id, { title: 'Review listing' });
      order = await createTestOrder(listing.id, buyer.id, seller.id, {
        orderStatus: 'COMPLETED',
        paymentStatus: 'released'
      });
    });

    dbTest('creates verified review', async () => {
      const review = await svc.createReview(order.id, buyer.id, {
        rating: 5,
        title: 'Great seller',
        body: 'Fast shipping'
      });

      expect(review.rating).toBe(5);
      expect(review.reviewerId).toBe(buyer.id);
      expect(review.isVerified).toBe(true);
    });

    dbTest('prevents duplicate reviews', async () => {
      await expect(svc.createReview(order.id, buyer.id, {
        rating: 4,
        title: 'Duplicate',
        body: 'should fail'
      })).rejects.toThrow('Already reviewed');
    });

    dbTest('prevents review on non-completed order', async () => {
      const pendingOrder = await createTestOrder(listing.id, buyer.id, seller.id, {
        orderStatus: 'PENDING'
      });

      await expect(svc.createReview(pendingOrder.id, buyer.id, {
        rating: 5,
        title: 'Too early',
        body: 'should fail'
      })).rejects.toThrow('Order not completed');
    });

    dbTest('updates seller average rating', async () => {
      const profile = await prisma.sellerProfile.findUnique({ where: { userId: seller.id } });
      expect(profile.averageRating).toBeGreaterThan(0);
    });

    dbTest('rejects rating outside 1-5', async () => {
      const listing2 = await createTestListing(seller.id, { title: 'Review bad rating listing' });
      const order2 = await createTestOrder(listing2.id, buyer.id, seller.id, {
        orderStatus: 'COMPLETED',
        paymentStatus: 'released'
      });
      await expect(svc.createReview(order2.id, buyer.id, {
        rating: 9,
        title: 'Bad value',
        body: 'Should fail'
      })).rejects.toThrow('Rating must be between 1 and 5');
    });
  });

  describe('toggleSaved', () => {
    let listing;

    dbBeforeAll(async () => {
      listing = await createTestListing(seller.id, { title: 'Saved listing' });
    });

    dbTest('save and unsave listing', async () => {
      const save = await svc.toggleSaved(buyer.id, listing.id);
      expect(save.saved).toBe(true);

      const unsave = await svc.toggleSaved(buyer.id, listing.id);
      expect(unsave.saved).toBe(false);
    });
  });

  describe('misc helpers', () => {
    dbTest('getListingByIdOrSlug resolves by slug', async () => {
      const listing = await createTestListing(seller.id, { title: 'Slug helper listing' });
      const withSlug = await prisma.marketListing.update({
        where: { id: listing.id },
        data: { slug: `slug-helper-${listing.id.slice(0, 6)}` }
      });

      const found = await svc.getListingByIdOrSlug(withSlug.slug);
      expect(found).not.toBeNull();
      expect(found.id).toBe(withSlug.id);
    });

    dbTest('incrementViews increments counter', async () => {
      const listing = await createTestListing(seller.id, { views: 0 });
      const updated = await svc.incrementViews(listing.id);
      expect(updated.views).toBe(1);
    });

    dbTest('incrementWaClicks increments counter', async () => {
      const listing = await createTestListing(seller.id, { waClicks: 0 });
      const updated = await svc.incrementWaClicks(listing.id);
      expect(updated.waClicks).toBe(1);
    });

    dbTest('getSavedListings returns saved entries with listing relation', async () => {
      const listing = await createTestListing(seller.id, { title: 'Saved relation listing' });
      await svc.toggleSaved(buyer.id, listing.id);
      const saved = await svc.getSavedListings(buyer.id);
      expect(saved.length).toBeGreaterThan(0);
      expect(saved[0].listing).toBeDefined();
    });

    dbTest('getSellerDashboard returns aggregate payload', async () => {
      const data = await svc.getSellerDashboard(seller.id);
      expect(data).toHaveProperty('activeListings');
      expect(data).toHaveProperty('pendingOrders');
      expect(Array.isArray(data.recentOrders)).toBe(true);
      expect(Array.isArray(data.recentReviews)).toBe(true);
      expect(Array.isArray(data.myListingsPreview)).toBe(true);
    });
  });

  describe('email failure safety', () => {
    dbTest('createOrder does not crash when order-placed email fails', async () => {
      const listing = await createTestListing(seller.id, { price: 210, quantity: 2, status: 'ACTIVE' });
      const emailSpy = jest.spyOn(emailService, 'sendOrderPlaced').mockRejectedValue(new Error('mail fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const order = await svc.createOrder({
        listingId: listing.id,
        buyerId: buyer.id,
        quantity: 1,
        paymentMethod: 'cod',
        shippingMethod: 'self_pickup'
      });

      expect(order.id).toBeDefined();
      expect(emailSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      emailSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    dbTest('sellerConfirmOrder does not crash when confirm email fails', async () => {
      const listing = await createTestListing(seller.id, { status: 'ACTIVE' });
      const order = await createTestOrder(listing.id, buyer.id, seller.id, { orderStatus: 'PENDING' });
      const emailSpy = jest.spyOn(emailService, 'sendOrderConfirmed').mockRejectedValue(new Error('mail fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const updated = await svc.sellerConfirmOrder(order.id, seller.id);
      expect(updated.orderStatus).toBe('SELLER_CONFIRMED');
      expect(emailSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      emailSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    dbTest('sellerShipOrder does not crash when shipped email fails', async () => {
      const listing = await createTestListing(seller.id, { status: 'ACTIVE' });
      const order = await createTestOrder(listing.id, buyer.id, seller.id, { orderStatus: 'SELLER_CONFIRMED' });
      const emailSpy = jest.spyOn(emailService, 'sendOrderShipped').mockRejectedValue(new Error('mail fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const updated = await svc.sellerShipOrder(order.id, seller.id, {
        trackingNumber: 'TRK-1',
        shippingCompany: 'FastShip'
      });
      expect(updated.orderStatus).toBe('SHIPPED');
      expect(emailSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      emailSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    dbTest('buyerConfirmDelivery does not crash when completed email fails', async () => {
      const listing = await createTestListing(seller.id, { status: 'ACTIVE' });
      const order = await createTestOrder(listing.id, buyer.id, seller.id, { orderStatus: 'SHIPPED' });
      const emailSpy = jest.spyOn(emailService, 'sendOrderCompleted').mockRejectedValue(new Error('mail fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const updated = await svc.buyerConfirmDelivery(order.id, buyer.id);
      expect(updated.orderStatus).toBe('COMPLETED');
      expect(emailSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      emailSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });
});
