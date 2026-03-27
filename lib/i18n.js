const translations = {
  // Navigation
  'nav.browse': { ar: 'تصفح', en: 'Browse' },
  'nav.sell': { ar: 'بيع', en: 'Sell' },
  'nav.dashboard': { ar: 'لوحة التحكم', en: 'Dashboard' },
  'nav.orders': { ar: 'الطلبات', en: 'Orders' },
  'nav.saved': { ar: 'المحفوظات', en: 'Saved' },
  'nav.profile': { ar: 'الملف الشخصي', en: 'Profile' },
  'nav.login': { ar: 'تسجيل الدخول', en: 'Login' },
  'nav.register': { ar: 'حساب جديد', en: 'Register' },
  'nav.logout': { ar: 'تسجيل الخروج', en: 'Logout' },
  'nav.admin': { ar: 'الإدارة', en: 'Admin' },
  'nav.upgrade': { ar: 'ترقية', en: 'Upgrade' },
  'nav.notifications': { ar: 'الإشعارات', en: 'Notifications' },

  // Home page
  'home.hero.title': { ar: 'اشترِ وبِع بأمان', en: 'Buy and Sell with Confidence' },
  'home.hero.subtitle': {
    ar: 'أموالك محمية حتى تأكيد الاستلام — سوق الحوت يضمن حقك',
    en: 'Your money is held in escrow until delivery is confirmed — Whale protects your rights',
  },
  'home.hero.browse': { ar: 'تصفح المنتجات', en: 'Browse Listings' },
  'home.hero.sell': { ar: 'ابدأ البيع', en: 'Start Selling' },
  'home.categories': { ar: 'التصنيفات', en: 'Categories' },
  'home.recent': { ar: 'أحدث المنتجات', en: 'Recent Listings' },
  'home.trust.title': { ar: 'لماذا الحوت؟', en: 'Why Whale?' },
  'home.trust.escrow': { ar: 'حماية الضمان', en: 'Escrow Protection' },
  'home.trust.escrow.desc': {
    ar: 'أموالك محفوظة حتى تستلم طلبك بأمان',
    en: 'Your money is held safely until you receive your order',
  },
  'home.trust.verified': { ar: 'بائعون موثوقون', en: 'Verified Sellers' },
  'home.trust.verified.desc': {
    ar: 'نتحقق من هوية البائعين لحمايتك',
    en: 'We verify seller identities to protect you',
  },
  'home.trust.dispute': { ar: 'حل النزاعات', en: 'Dispute Resolution' },
  'home.trust.dispute.desc': {
    ar: 'فريقنا يتدخل لحل أي مشكلة بينك وبين البائع',
    en: 'Our team steps in to resolve any issues between you and the seller',
  },
  'home.cta': { ar: 'انضم إلى الحوت اليوم', en: 'Join Whale Today' },
  'home.cta.desc': {
    ar: 'أنشئ حسابك وابدأ البيع والشراء بأمان',
    en: 'Create your account and start buying and selling safely',
  },

  // Browse / Whale
  'whale.browse': { ar: 'تصفح المنتجات', en: 'Browse Listings' },
  'whale.filter': { ar: 'تصفية', en: 'Filter' },
  'whale.sort': { ar: 'ترتيب', en: 'Sort' },
  'whale.sort.newest': { ar: 'الأحدث', en: 'Newest' },
  'whale.sort.oldest': { ar: 'الأقدم', en: 'Oldest' },
  'whale.sort.price_asc': { ar: 'السعر: الأقل', en: 'Price: Low to High' },
  'whale.sort.price_desc': { ar: 'السعر: الأعلى', en: 'Price: High to Low' },
  'whale.sort.popular': { ar: 'الأكثر مشاهدة', en: 'Most Viewed' },
  'whale.no_results': { ar: 'لا توجد نتائج', en: 'No listings found' },
  'whale.load_more': { ar: 'تحميل المزيد', en: 'Load More' },
  'whale.category': { ar: 'التصنيف', en: 'Category' },
  'whale.city': { ar: 'المدينة', en: 'City' },
  'whale.condition': { ar: 'الحالة', en: 'Condition' },
  'whale.price_range': { ar: 'نطاق السعر', en: 'Price Range' },
  'whale.min_price': { ar: 'أقل سعر', en: 'Min Price' },
  'whale.max_price': { ar: 'أعلى سعر', en: 'Max Price' },
  'whale.all_categories': { ar: 'جميع التصنيفات', en: 'All Categories' },
  'whale.all_cities': { ar: 'جميع المدن', en: 'All Cities' },
  'whale.all_conditions': { ar: 'جميع الحالات', en: 'All Conditions' },

  // Listing
  'listing.buy_now': { ar: 'اشترِ الآن', en: 'Buy Now' },
  'listing.whatsapp': { ar: 'تواصل عبر واتساب', en: 'WhatsApp Seller' },
  'listing.save': { ar: 'حفظ', en: 'Save' },
  'listing.saved': { ar: 'محفوظ', en: 'Saved' },
  'listing.edit': { ar: 'تعديل', en: 'Edit' },
  'listing.delete': { ar: 'حذف', en: 'Delete' },
  'listing.views': { ar: 'مشاهدة', en: 'views' },
  'listing.negotiable': { ar: 'قابل للتفاوض', en: 'Negotiable' },
  'listing.description': { ar: 'الوصف', en: 'Description' },
  'listing.specs': { ar: 'المواصفات', en: 'Specifications' },
  'listing.reviews': { ar: 'التقييمات', en: 'Reviews' },
  'listing.seller': { ar: 'البائع', en: 'Seller' },
  'listing.member_since': { ar: 'عضو منذ', en: 'Member since' },
  'listing.view_profile': { ar: 'عرض الملف', en: 'View Profile' },

  // Sell form
  'sell.title': { ar: 'أضف منتج جديد', en: 'Create New Listing' },
  'sell.edit_title': { ar: 'تعديل المنتج', en: 'Edit Listing' },
  'sell.name': { ar: 'اسم المنتج (إنجليزي)', en: 'Product Title' },
  'sell.name_ar': { ar: 'اسم المنتج (عربي)', en: 'Product Title (Arabic)' },
  'sell.description': { ar: 'الوصف (إنجليزي)', en: 'Description' },
  'sell.description_ar': { ar: 'الوصف (عربي)', en: 'Description (Arabic)' },
  'sell.price': { ar: 'السعر', en: 'Price' },
  'sell.negotiable': { ar: 'قابل للتفاوض', en: 'Negotiable' },
  'sell.condition': { ar: 'الحالة', en: 'Condition' },
  'sell.category': { ar: 'التصنيف', en: 'Category' },
  'sell.subcategory': { ar: 'التصنيف الفرعي', en: 'Subcategory' },
  'sell.city': { ar: 'المدينة', en: 'City' },
  'sell.images': { ar: 'الصور (حتى 6)', en: 'Images (up to 6)' },
  'sell.tags': { ar: 'الوسوم', en: 'Tags' },
  'sell.submit': { ar: 'نشر المنتج', en: 'Publish Listing' },
  'sell.update': { ar: 'تحديث المنتج', en: 'Update Listing' },

  // Checkout
  'checkout.title': { ar: 'إتمام الشراء', en: 'Checkout' },
  'checkout.shipping': { ar: 'عنوان الشحن', en: 'Shipping Address' },
  'checkout.street': { ar: 'الشارع', en: 'Street' },
  'checkout.city': { ar: 'المدينة', en: 'City' },
  'checkout.phone': { ar: 'رقم الهاتف', en: 'Phone' },
  'checkout.note': { ar: 'ملاحظة للبائع', en: 'Note to Seller' },
  'checkout.payment': { ar: 'طريقة الدفع', en: 'Payment Method' },
  'checkout.place_order': { ar: 'تأكيد الطلب', en: 'Place Order' },
  'checkout.total': { ar: 'المجموع', en: 'Total' },

  // Orders
  'order.title': { ar: 'الطلبات', en: 'Orders' },
  'order.buying': { ar: 'مشترياتي', en: 'My Purchases' },
  'order.selling': { ar: 'مبيعاتي', en: 'My Sales' },
  'order.number': { ar: 'رقم الطلب', en: 'Order #' },
  'order.status': { ar: 'الحالة', en: 'Status' },
  'order.confirm': { ar: 'تأكيد الطلب', en: 'Confirm Order' },
  'order.ship': { ar: 'شحن الطلب', en: 'Ship Order' },
  'order.deliver': { ar: 'تأكيد الاستلام', en: 'Confirm Delivery' },
  'order.cancel': { ar: 'إلغاء الطلب', en: 'Cancel Order' },
  'order.dispute': { ar: 'فتح نزاع', en: 'Open Dispute' },
  'order.resolve': { ar: 'حل النزاع', en: 'Resolve Dispute' },
  'order.review': { ar: 'كتابة تقييم', en: 'Leave Review' },
  'order.tracking': { ar: 'رقم التتبع', en: 'Tracking Number' },
  'order.cancel_reason': { ar: 'سبب الإلغاء', en: 'Cancellation Reason' },
  'order.timeline': { ar: 'تاريخ الطلب', en: 'Order Timeline' },
  'order.no_orders': { ar: 'لا توجد طلبات', en: 'No orders yet' },

  // Statuses
  'status.PENDING': { ar: 'قيد الانتظار', en: 'Pending' },
  'status.CONFIRMED': { ar: 'مؤكد', en: 'Confirmed' },
  'status.SHIPPED': { ar: 'تم الشحن', en: 'Shipped' },
  'status.DELIVERED': { ar: 'تم التوصيل', en: 'Delivered' },
  'status.COMPLETED': { ar: 'مكتمل', en: 'Completed' },
  'status.CANCELLED': { ar: 'ملغي', en: 'Cancelled' },
  'status.DISPUTED': { ar: 'متنازع', en: 'Disputed' },

  // Conditions
  'condition.NEW': { ar: 'جديد', en: 'New' },
  'condition.LIKE_NEW': { ar: 'شبه جديد', en: 'Like New' },
  'condition.GOOD': { ar: 'جيد', en: 'Good' },
  'condition.USED': { ar: 'مستعمل', en: 'Used' },
  'condition.FAIR': { ar: 'مقبول', en: 'Fair' },
  'condition.FOR_PARTS': { ar: 'للقطع', en: 'For Parts' },

  // Auth
  'auth.login': { ar: 'تسجيل الدخول', en: 'Login' },
  'auth.register': { ar: 'إنشاء حساب', en: 'Create Account' },
  'auth.email': { ar: 'البريد الإلكتروني', en: 'Email' },
  'auth.username': { ar: 'اسم المستخدم', en: 'Username' },
  'auth.password': { ar: 'كلمة المرور', en: 'Password' },
  'auth.identifier': { ar: 'البريد أو اسم المستخدم', en: 'Email or Username' },
  'auth.google': { ar: 'الدخول بحساب جوجل', en: 'Continue with Google' },
  'auth.no_account': { ar: 'ليس لديك حساب؟', en: "Don't have an account?" },
  'auth.has_account': { ar: 'لديك حساب بالفعل؟', en: 'Already have an account?' },
  'auth.error.USER_NOT_FOUND': { ar: 'المستخدم غير موجود', en: 'User not found' },
  'auth.error.WRONG_PASSWORD': { ar: 'كلمة المرور خاطئة', en: 'Wrong password' },
  'auth.error.USER_BANNED': { ar: 'هذا الحساب محظور', en: 'This account is banned' },
  'auth.error.OAUTH_ONLY': { ar: 'يرجى تسجيل الدخول بحساب جوجل', en: 'Please sign in with Google' },

  // Dashboard
  'dashboard.title': { ar: 'لوحة البائع', en: 'Seller Dashboard' },
  'dashboard.total_listings': { ar: 'إجمالي المنتجات', en: 'Total Listings' },
  'dashboard.active_listings': { ar: 'المنتجات النشطة', en: 'Active Listings' },
  'dashboard.total_orders': { ar: 'إجمالي الطلبات', en: 'Total Orders' },
  'dashboard.pending_orders': { ar: 'طلبات معلقة', en: 'Pending Orders' },
  'dashboard.total_revenue': { ar: 'إجمالي الإيرادات', en: 'Total Revenue' },
  'dashboard.avg_rating': { ar: 'متوسط التقييم', en: 'Average Rating' },
  'dashboard.recent_orders': { ar: 'آخر الطلبات', en: 'Recent Orders' },

  // Profile
  'profile.title': { ar: 'الملف الشخصي', en: 'Profile' },
  'profile.bio': { ar: 'نبذة', en: 'Bio' },
  'profile.display_name': { ar: 'اسم العرض', en: 'Display Name' },
  'profile.city': { ar: 'المدينة', en: 'City' },
  'profile.whatsapp': { ar: 'واتساب', en: 'WhatsApp' },
  'profile.save': { ar: 'حفظ التغييرات', en: 'Save Changes' },
  'profile.avatar': { ar: 'الصورة الشخصية', en: 'Profile Photo' },

  // Upgrade / Payment
  'upgrade.title': { ar: 'ترقية إلى برو', en: 'Upgrade to Pro' },
  'upgrade.subtitle': { ar: 'ابدأ البيع وأنشئ متجرك', en: 'Start selling and create your store' },
  'upgrade.monthly': { ar: 'شهري', en: 'Monthly' },
  'upgrade.semiannual': { ar: 'نصف سنوي', en: '6 Months' },
  'upgrade.annual': { ar: 'سنوي', en: 'Annual' },
  'upgrade.current_plan': { ar: 'خطتك الحالية', en: 'Current Plan' },
  'upgrade.pay_paymob': { ar: 'ادفع عبر Paymob', en: 'Pay with Paymob' },
  'upgrade.pay_paypal': { ar: 'ادفع عبر PayPal', en: 'Pay with PayPal' },
  'upgrade.pay_stripe': { ar: 'ادفع بفيزا / ماستركارد', en: 'Pay with Visa/Mastercard' },
  'payment.success': { ar: 'تم الدفع بنجاح!', en: 'Payment Successful!' },
  'payment.success.desc': {
    ar: 'تم ترقية حسابك إلى برو',
    en: 'Your account has been upgraded to Pro',
  },
  'notif.empty': { ar: 'لا توجد إشعارات بعد', en: 'No notifications yet' },
  'notif.mark_read': { ar: 'تعيين الكل كمقروء', en: 'Mark all as read' },

  // Admin
  'admin.dashboard': { ar: 'لوحة الإدارة', en: 'Admin Dashboard' },
  'admin.users': { ar: 'المستخدمون', en: 'Users' },
  'admin.listings': { ar: 'المنتجات', en: 'Listings' },
  'admin.orders': { ar: 'الطلبات', en: 'Orders' },
  'admin.ban': { ar: 'حظر', en: 'Ban' },
  'admin.unban': { ar: 'رفع الحظر', en: 'Unban' },
  'admin.remove': { ar: 'إزالة', en: 'Remove' },

  // General
  'general.search': { ar: 'بحث...', en: 'Search...' },
  'general.submit': { ar: 'إرسال', en: 'Submit' },
  'general.cancel': { ar: 'إلغاء', en: 'Cancel' },
  'general.save': { ar: 'حفظ', en: 'Save' },
  'general.delete': { ar: 'حذف', en: 'Delete' },
  'general.confirm': { ar: 'تأكيد', en: 'Confirm' },
  'general.back': { ar: 'رجوع', en: 'Back' },
  'general.loading': { ar: 'جاري التحميل...', en: 'Loading...' },
  'general.error': { ar: 'حدث خطأ', en: 'An error occurred' },
  'general.forbidden': { ar: 'غير مصرح', en: 'Forbidden' },
  'general.not_found': { ar: 'الصفحة غير موجودة', en: 'Page not found' },
  'general.currency': { ar: '$', en: '$' },

  // Flash messages
  'flash.login_success': { ar: 'تم تسجيل الدخول بنجاح', en: 'Logged in successfully' },
  'flash.register_success': { ar: 'تم إنشاء الحساب بنجاح', en: 'Account created successfully' },
  'flash.logout_success': { ar: 'تم تسجيل الخروج', en: 'Logged out successfully' },
  'flash.listing_created': { ar: 'تم نشر المنتج بنجاح', en: 'Listing published successfully' },
  'flash.listing_updated': { ar: 'تم تحديث المنتج', en: 'Listing updated' },
  'flash.listing_deleted': { ar: 'تم حذف المنتج', en: 'Listing removed' },
  'flash.order_placed': { ar: 'تم إنشاء الطلب', en: 'Order placed successfully' },
  'flash.order_confirmed': { ar: 'تم تأكيد الطلب', en: 'Order confirmed' },
  'flash.order_shipped': { ar: 'تم شحن الطلب', en: 'Order shipped' },
  'flash.order_completed': { ar: 'تم إكمال الطلب', en: 'Order completed' },
  'flash.order_cancelled': { ar: 'تم إلغاء الطلب', en: 'Order cancelled' },
  'flash.review_posted': { ar: 'تم نشر التقييم', en: 'Review posted' },
  'flash.profile_updated': { ar: 'تم تحديث الملف الشخصي', en: 'Profile updated' },
  'flash.saved': { ar: 'تمت الإضافة إلى المحفوظات', en: 'Added to saved' },
  'flash.unsaved': { ar: 'تمت الإزالة من المحفوظات', en: 'Removed from saved' },
  'flash.pro_required': { ar: 'يلزم اشتراك برو للبيع', en: 'Pro subscription required to sell' },
  'flash.auth_required': { ar: 'يرجى تسجيل الدخول', en: 'Please log in first' },
  'flash.email_verified': { ar: 'تم تأكيد البريد الإلكتروني', en: 'Email verified successfully' },
  'flash.verification_sent': { ar: 'تم إرسال رابط التأكيد', en: 'Verification email sent' },
  'flash.reset_email_sent': { ar: 'تم إرسال رابط الاستعادة إذا كان البريد مسجلاً', en: 'If that email is registered, a reset link has been sent' },
  'flash.password_reset': { ar: 'تم تغيير كلمة المرور بنجاح', en: 'Password reset successfully' },
  'flash.2fa_verified': { ar: 'تم التحقق بنجاح', en: '2FA verified successfully' },
  'flash.cart_added': { ar: 'تمت الإضافة إلى السلة', en: 'Added to cart' },
  'flash.cart_removed': { ar: 'تمت الإزالة من السلة', en: 'Removed from cart' },
  'flash.cart_cleared': { ar: 'تم تفريغ السلة', en: 'Cart cleared' },

  // Auth security
  'auth.forgot_password': { ar: 'نسيت كلمة المرور؟', en: 'Forgot Password?' },
  'auth.reset_password': { ar: 'إعادة تعيين كلمة المرور', en: 'Reset Password' },
  'auth.new_password': { ar: 'كلمة المرور الجديدة', en: 'New Password' },
  'auth.two_factor': { ar: 'التحقق بخطوتين', en: 'Two-Factor Authentication' },
  'auth.invalid_token': { ar: 'رابط غير صالح', en: 'Invalid or expired link' },
  'auth.token_used': { ar: 'تم استخدام هذا الرابط مسبقاً', en: 'This link has already been used' },
  'auth.token_expired': { ar: 'انتهت صلاحية الرابط', en: 'This link has expired' },
  'auth.already_verified': { ar: 'البريد مؤكد مسبقاً', en: 'Email already verified' },
  'auth.weak_password': { ar: 'كلمة المرور ضعيفة (8 أحرف على الأقل)', en: 'Password must be at least 8 characters' },
  'auth.invalid_2fa': { ar: 'رمز التحقق غير صحيح', en: 'Invalid verification code' },

  // Cart
  'cart.title': { ar: 'سلة التسوق', en: 'Shopping Cart' },
  'cart.empty': { ar: 'السلة فارغة', en: 'Your cart is empty' },
  'cart.add': { ar: 'أضف إلى السلة', en: 'Add to Cart' },
  'cart.remove': { ar: 'إزالة', en: 'Remove' },
  'cart.clear': { ar: 'تفريغ السلة', en: 'Clear Cart' },
  'cart.checkout': { ar: 'إتمام الشراء', en: 'Proceed to Checkout' },
  'cart.total': { ar: 'المجموع', en: 'Total' },
  'cart.quantity': { ar: 'الكمية', en: 'Quantity' },

  // Admin extended
  'admin.audit': { ar: 'سجل العمليات', en: 'Audit Log' },
  'admin.coupons': { ar: 'الكوبونات', en: 'Coupons' },
  'admin.refunds': { ar: 'طلبات الاسترداد', en: 'Refund Requests' },
};

/**
 * Translate a key to the given locale with optional interpolation
 * @param {string} key - Translation key (e.g., 'nav.browse')
 * @param {string} locale - 'ar' or 'en'
 * @param {object} [vars] - Interpolation variables { name: 'value' }
 * @returns {string}
 */
function t(key, locale = 'ar', vars = {}) {
  const entry = translations[key];
  if (!entry) return key;
  let text = entry[locale] || entry.en || key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return text;
}

module.exports = { t, translations };
