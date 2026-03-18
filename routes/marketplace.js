const express = require('express');
const rateLimit = require('express-rate-limit');

const { requireAuth, optionalAuth, requireModerator } = require('../middleware/auth');
const { requirePro } = require('../middleware/subscription');
const marketplaceService = require('../services/marketplaceService');
const { upload, storeFiles } = require('../utils/upload');

const webRouter = express.Router();
const apiRouter = express.Router();

const listingLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Listing creation limit exceeded (5/day)' }
});

const listingCategories = [
  'FULL_PC',
  'LAPTOP',
  'GPU',
  'CPU',
  'RAM',
  'STORAGE',
  'MONITOR',
  'PERIPHERALS',
  'ACCESSORIES',
  'OTHER'
];

const listingConditions = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'];
const listingLocations = ['Tulkarem', 'Nablus', 'Ramallah', 'Jerusalem', 'Gaza', 'Hebron', 'Jenin', 'Other'];

webRouter.get('/marketplace', optionalAuth, async (req, res, next) => {
  try {
    const result = await marketplaceService.listListings({
      ...req.query,
      limit: Number(req.query.limit) || 12
    });

    return res.render('marketplace/index', {
      title: 'سوق القيمنق | Marketplace',
      listings: result.items,
      pageInfo: result.pageInfo,
      filters: req.query,
      listingCategories,
      listingConditions,
      listingLocations
    });
  } catch (error) {
    return next(error);
  }
});

webRouter.get('/marketplace/new', requireAuth, (req, res) => {
  res.render('marketplace/form', {
    title: 'إضافة إعلان | Post Listing',
    listing: null,
    listingCategories,
    listingConditions,
    listingLocations,
    error: null
  });
});

webRouter.post('/marketplace/new', requireAuth, requirePro, listingLimiter, upload.array('images', 6), async (req, res) => {
  try {
    const images = await storeFiles(req.files || [], 'uploads/listings', 6);

    const listing = await marketplaceService.createListing({
      sellerId: req.user.id,
      title: req.body.title,
      titleAr: req.body.titleAr,
      description: req.body.description,
      descriptionAr: req.body.descriptionAr,
      price: req.body.price,
      condition: req.body.condition,
      category: req.body.category,
      images,
      location: req.body.location,
      whatsappNumber: req.body.whatsappNumber
    });

    return res.redirect(`/marketplace/${listing.id}`);
  } catch (error) {
    return res.status(400).render('marketplace/form', {
      title: 'إضافة إعلان | Post Listing',
      listing: req.body,
      listingCategories,
      listingConditions,
      listingLocations,
      error: error.message
    });
  }
});

webRouter.get('/marketplace/my-listings', requireAuth, async (req, res, next) => {
  try {
    const listings = await marketplaceService.myListings(req.user.id);

    return res.render('marketplace/my-listings', {
      title: 'إعلاناتي | My Listings',
      listings
    });
  } catch (error) {
    return next(error);
  }
});

webRouter.get('/marketplace/:id/edit', requireAuth, async (req, res, next) => {
  try {
    const listing = await marketplaceService.getListingById(req.params.id, false);
    if (!listing) return res.status(404).render('404', { title: 'الإعلان غير موجود | Listing not found' });

    const isOwner = req.user.id === listing.sellerId;
    const isModerator = ['ADMIN', 'MODERATOR'].includes(req.user.role);
    if (!isOwner && !isModerator) {
      return res.status(403).render('error', {
        title: 'غير مصرح | Forbidden',
        message: 'لا يمكن تعديل هذا الإعلان | Cannot edit this listing'
      });
    }

    return res.render('marketplace/form', {
      title: 'تعديل الإعلان | Edit Listing',
      listing,
      listingCategories,
      listingConditions,
      listingLocations,
      error: null
    });
  } catch (error) {
    return next(error);
  }
});

webRouter.post('/marketplace/:id/edit', requireAuth, upload.array('images', 6), async (req, res) => {
  try {
    const images = await storeFiles(req.files || [], 'uploads/listings', 6);
    await marketplaceService.updateListing({
      listingId: req.params.id,
      actor: req.user,
      data: {
        title: req.body.title,
        titleAr: req.body.titleAr,
        description: req.body.description,
        descriptionAr: req.body.descriptionAr,
        price: req.body.price,
        condition: req.body.condition,
        category: req.body.category,
        location: req.body.location,
        whatsappNumber: req.body.whatsappNumber,
        status: req.body.status,
        images: images.length ? images : undefined
      }
    });

    return res.redirect(`/marketplace/${req.params.id}`);
  } catch (error) {
    return res.status(400).render('error', {
      title: 'خطأ | Error',
      message: error.message
    });
  }
});

webRouter.post('/marketplace/:id/mark-sold', requireAuth, async (req, res) => {
  try {
    await marketplaceService.markListingSold({
      listingId: req.params.id,
      actor: req.user
    });

    return res.redirect('/marketplace/my-listings');
  } catch (error) {
    return res.status(400).render('error', {
      title: 'خطأ | Error',
      message: error.message
    });
  }
});

webRouter.post('/marketplace/:id/remove', requireAuth, async (req, res) => {
  try {
    await marketplaceService.updateListing({
      listingId: req.params.id,
      actor: req.user,
      data: { status: 'REMOVED' }
    });

    return res.redirect('/marketplace/my-listings');
  } catch (error) {
    return res.status(400).render('error', {
      title: 'خطأ | Error',
      message: error.message
    });
  }
});

webRouter.get('/marketplace/:id', optionalAuth, async (req, res, next) => {
  try {
    const listing = await marketplaceService.getListingById(req.params.id, true);
    if (!listing) {
      return res.status(404).render('404', { title: 'الإعلان غير موجود | Listing not found' });
    }

    return res.render('marketplace/detail', {
      title: `${listing.titleAr || listing.title} | Marketplace`,
      listing
    });
  } catch (error) {
    return next(error);
  }
});

apiRouter.get('/', optionalAuth, async (req, res) => {
  try {
    const result = await marketplaceService.listListings(req.query);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/', requireAuth, listingLimiter, upload.array('images', 6), async (req, res) => {
  try {
    const images = await storeFiles(req.files || [], 'uploads/listings', 6);

    const listing = await marketplaceService.createListing({
      sellerId: req.user.id,
      title: req.body.title,
      titleAr: req.body.titleAr,
      description: req.body.description,
      descriptionAr: req.body.descriptionAr,
      price: req.body.price,
      condition: req.body.condition,
      category: req.body.category,
      images,
      location: req.body.location,
      whatsappNumber: req.body.whatsappNumber
    });

    return res.status(201).json({ listing });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.patch('/:id', requireAuth, upload.array('images', 6), async (req, res) => {
  try {
    const images = await storeFiles(req.files || [], 'uploads/listings', 6);

    const listing = await marketplaceService.updateListing({
      listingId: req.params.id,
      actor: req.user,
      data: {
        ...req.body,
        images: images.length ? images : undefined
      }
    });

    return res.json({ listing });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    await marketplaceService.deleteListing({
      listingId: req.params.id,
      actor: req.user
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(403).json({ error: error.message });
  }
});

apiRouter.post('/:id/view', optionalAuth, async (req, res) => {
  try {
    await marketplaceService.incrementView(req.params.id);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.post('/:id/moderate/remove', requireModerator, async (req, res) => {
  try {
    const listing = await marketplaceService.updateListing({
      listingId: req.params.id,
      actor: req.user,
      data: { status: 'REMOVED' }
    });

    return res.json({ listing });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = {
  webRouter,
  apiRouter,
  listingCategories,
  listingConditions,
  listingLocations
};
