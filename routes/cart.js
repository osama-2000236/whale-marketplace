const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const cartService = require('../services/cartService');

router.use(requireAuth);

// View cart
router.get('/', async (req, res, next) => {
  try {
    const { cart, itemCount, total, currency } = await cartService.getCartSummary(req.user.id);
    res.render('whale/cart', {
      title: res.locals.t('cart.title'),
      cart,
      itemCount,
      total,
      currency,
    });
  } catch (err) {
    next(err);
  }
});

// Add item to cart
router.post('/add', async (req, res, next) => {
  try {
    const { listingId, quantity } = req.body;
    await cartService.addItem(req.user.id, listingId, parseInt(quantity) || 1);

    if (req.headers['accept']?.includes('json')) {
      const summary = await cartService.getCartSummary(req.user.id);
      return res.json({ ok: true, itemCount: summary.itemCount });
    }

    req.session.flash = { type: 'success', message: res.locals.t('flash.cart_added') };
    res.redirect('/cart');
  } catch (err) {
    if (req.headers['accept']?.includes('json')) {
      return res.status(400).json({ error: err.message });
    }
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/cart');
  }
});

// Update item quantity
router.post('/update/:itemId', async (req, res, next) => {
  try {
    await cartService.updateItemQuantity(req.user.id, req.params.itemId, parseInt(req.body.quantity));

    if (req.headers['accept']?.includes('json')) {
      const summary = await cartService.getCartSummary(req.user.id);
      return res.json({ ok: true, itemCount: summary.itemCount, total: summary.total });
    }

    res.redirect('/cart');
  } catch (err) {
    if (req.headers['accept']?.includes('json')) {
      return res.status(400).json({ error: err.message });
    }
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/cart');
  }
});

// Remove item
router.post('/remove/:itemId', async (req, res, next) => {
  try {
    await cartService.removeItem(req.user.id, req.params.itemId);

    if (req.headers['accept']?.includes('json')) {
      const summary = await cartService.getCartSummary(req.user.id);
      return res.json({ ok: true, itemCount: summary.itemCount });
    }

    req.session.flash = { type: 'success', message: res.locals.t('flash.cart_removed') };
    res.redirect('/cart');
  } catch (err) {
    if (req.headers['accept']?.includes('json')) {
      return res.status(400).json({ error: err.message });
    }
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/cart');
  }
});

// Clear cart
router.post('/clear', async (req, res, next) => {
  try {
    await cartService.clearCart(req.user.id);
    req.session.flash = { type: 'success', message: res.locals.t('flash.cart_cleared') };
    res.redirect('/cart');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
