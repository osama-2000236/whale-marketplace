const router = require('express').Router();
const { requireAuth, requireVerified } = require('../middleware/auth');
const { sanitizeBody } = require('../utils/sanitize');
const checkoutService = require('../services/checkoutService');
const cartService = require('../services/cartService');
const paymentService = require('../services/paymentService');
const userService = require('../services/userService');

const { getCities } = require('../lib/cities');

function getCheckoutMessage(code) {
  if (String(code || '').startsWith('INSUFFICIENT_STOCK:')) {
    return `One of the items is no longer available in the requested quantity.`;
  }

  return (
    {
      CART_EMPTY: 'Your cart is empty.',
      INVALID_COUPON: 'That coupon code is invalid.',
      COUPON_EXPIRED: 'That coupon code has expired.',
      COUPON_EXHAUSTED: 'That coupon code has already been fully used.',
      COUPON_MIN_NOT_MET: 'Your cart does not meet the minimum amount for that coupon.',
      CANNOT_BUY_OWN: 'You cannot buy your own listing.',
      PAYMENT_PROVIDER_DISABLED: 'That payment method is not available right now.',
      ORDER_ALREADY_PENDING: 'You already have a pending order for one of these listings.',
    }[code] || code || 'Unable to complete checkout right now.'
  );
}

router.use(requireAuth, requireVerified);

router.get('/', async (req, res, next) => {
  try {
    const { cart, itemCount, total, currency } = await cartService.getCartSummary(req.user.id);
    if (itemCount === 0) {
      req.session.flash = { type: 'warning', message: res.locals.t('cart.empty') };
      return res.redirect('/cart');
    }

    const addresses = await userService.listAddresses(req.user.id);

    return res.render('whale/cart-checkout', {
      title: res.locals.t('checkout.title'),
      cart,
      itemCount,
      total,
      currency,
      cities: getCities(req.locale),
      addresses,
      providerAvailability: paymentService.getProviderAvailability(),
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/', async (req, res) => {
  try {
    const data = sanitizeBody(req.body, {
      paymentMethod: 20,
      street: 200,
      city: 100,
      phone: 25,
      buyerNote: 500,
      couponCode: 30,
    });

    const payload = {
      paymentMethod: data.paymentMethod,
      shippingAddress: { street: data.street, city: data.city, phone: data.phone },
      buyerNote: data.buyerNote,
      couponCode: data.couponCode,
    };

    if (String(data.paymentMethod).toLowerCase() === 'manual') {
      const orders = await checkoutService.checkoutFromCart(req.user.id, payload);
      req.session.flash = { type: 'success', message: res.locals.t('flash.order_placed') };
      if (orders.length === 1) {
        return res.redirect(`/whale/orders/${orders[0].id}`);
      }
      return res.redirect('/whale/orders?tab=buying');
    }

    const hostedPayment = await checkoutService.startCartHostedCheckout(req.user.id, payload);
    return res.redirect(hostedPayment.redirectUrl);
  } catch (err) {
    req.session.flash = { type: 'danger', message: getCheckoutMessage(err.message) };
    return res.redirect('/checkout');
  }
});

module.exports = router;
