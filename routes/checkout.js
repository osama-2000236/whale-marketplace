const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { sanitizeBody } = require('../utils/sanitize');
const checkoutService = require('../services/checkoutService');
const cartService = require('../services/cartService');

const CITIES = ['Gaza', 'Ramallah', 'Nablus', 'Hebron', 'Jenin', 'Jerusalem'];

router.use(requireAuth);

// Checkout page (from cart)
router.get('/', async (req, res, next) => {
  try {
    const { cart, itemCount, total, currency } = await cartService.getCartSummary(req.user.id);
    if (itemCount === 0) {
      req.session.flash = { type: 'warning', message: res.locals.t('cart.empty') };
      return res.redirect('/cart');
    }

    // Load user's saved addresses
    const prisma = require('../lib/prisma');
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    res.render('whale/cart-checkout', {
      title: res.locals.t('checkout.title'),
      cart,
      itemCount,
      total,
      currency,
      cities: CITIES,
      addresses,
    });
  } catch (err) {
    next(err);
  }
});

// Process cart checkout
router.post('/', async (req, res, next) => {
  try {
    const data = sanitizeBody(req.body, {
      paymentMethod: 20,
      street: 200,
      city: 100,
      phone: 20,
      buyerNote: 500,
      couponCode: 30,
    });

    const orders = await checkoutService.checkoutFromCart(req.user.id, {
      paymentMethod: data.paymentMethod,
      shippingAddress: { street: data.street, city: data.city, phone: data.phone },
      buyerNote: data.buyerNote,
      couponCode: data.couponCode,
    });

    req.session.flash = {
      type: 'success',
      message: res.locals.t('flash.order_placed'),
    };
    // Redirect to the first order if single, or to orders list
    if (orders.length === 1) {
      res.redirect('/whale/orders/' + orders[0].id);
    } else {
      res.redirect('/whale/orders?tab=buying');
    }
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/checkout');
  }
});

module.exports = router;
