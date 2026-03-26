const router = require('express').Router();
const whaleService = require('../services/whaleService');
const { marked } = require('marked');
const { safeRedirect } = require('../utils/safeRedirect');

// Home page
router.get('/', async (req, res, next) => {
  try {
    const [categories, { listings }] = await Promise.all([
      whaleService.getCategories(),
      whaleService.getListings({ sort: 'newest' }),
    ]);
    res.render('pages/home', {
      title: '',
      categories,
      listings: listings.slice(0, 8),
    });
  } catch (err) {
    next(err);
  }
});

// Health check
router.get('/health', (req, res) => {
  const prisma = require('../lib/prisma');
  prisma.$queryRaw`SELECT 1`
    .then(() => res.json({ status: 'ok', uptime: process.uptime() }))
    .catch(() => res.status(503).json({ status: 'error', message: 'Database unreachable' }));
});

// Locale switch
router.post('/locale', (req, res) => {
  const locale = req.body.locale;
  if (['ar', 'en'].includes(locale)) {
    req.session.locale = locale;
  }
  res.redirect(safeRedirect(req.headers.referer, '/'));
});

// Static pages
const PAGES = {
  about: {
    titleAr: 'عن الحوت',
    titleEn: 'About Whale',
    contentAr: `# عن الحوت\n\nالحوت هو سوق إلكتروني آمن مصمم خصيصاً لفلسطين والمدن العربية.\n\n## مهمتنا\n\nنؤمن بأن التجارة الإلكترونية يجب أن تكون آمنة ومتاحة للجميع. نظام الضمان لدينا يحمي أموال المشتري حتى تأكيد استلام الطلب.\n\n## كيف يعمل\n\n1. **تصفح** — اختر المنتج الذي تريده\n2. **اشترِ** — أموالك محمية في حساب الضمان\n3. **استلم** — أكّد الاستلام ويتم تحويل المبلغ للبائع`,
    contentEn: `# About Whale\n\nWhale is a trust-first peer-to-peer marketplace built for Palestine and Arab cities.\n\n## Our Mission\n\nWe believe e-commerce should be safe and accessible for everyone. Our escrow system holds buyer funds until delivery is confirmed.\n\n## How It Works\n\n1. **Browse** — Find what you need\n2. **Buy** — Your money is protected in escrow\n3. **Receive** — Confirm delivery and funds are released to the seller`,
  },
  terms: {
    titleAr: 'شروط الاستخدام',
    titleEn: 'Terms of Service',
    contentAr: `# شروط الاستخدام\n\n## نظام الضمان\n\n- يتم حجز أموال المشتري حتى تأكيد الاستلام\n- يحق للمشتري فتح نزاع خلال 48 ساعة من الاستلام\n- الإدارة تقرر في حالات النزاع\n\n## العمولات\n\n- التسجيل مجاني مع فترة تجريبية 30 يوم\n- اشتراك برو مطلوب للبيع بعد الفترة التجريبية\n\n## المنتجات المحظورة\n\n- أسلحة ومتفجرات\n- مواد مخدرة\n- منتجات مقلدة\n- أي منتج مخالف للقانون`,
    contentEn: `# Terms of Service\n\n## Escrow System\n\n- Buyer funds are held until delivery confirmation\n- Buyer may open a dispute within 48 hours of delivery\n- Admin resolves dispute cases\n\n## Fees\n\n- Registration is free with a 30-day trial\n- Pro subscription required to sell after trial\n\n## Prohibited Items\n\n- Weapons and explosives\n- Illegal substances\n- Counterfeit products\n- Any item violating local law`,
  },
  privacy: {
    titleAr: 'سياسة الخصوصية',
    titleEn: 'Privacy Policy',
    contentAr: `# سياسة الخصوصية\n\n## البيانات التي نجمعها\n\n- معلومات الحساب (اسم المستخدم، البريد الإلكتروني)\n- معلومات المنتجات والطلبات\n- بيانات الاستخدام\n\n## كيف نستخدم بياناتك\n\n- تشغيل السوق وتقديم الخدمات\n- التواصل معك بشأن طلباتك\n- تحسين تجربة المستخدم\n\n## حقوقك\n\n- يمكنك طلب حذف حسابك وبياناتك\n- يمكنك تعديل معلوماتك في أي وقت`,
    contentEn: `# Privacy Policy\n\n## Data We Collect\n\n- Account information (username, email)\n- Listing and order data\n- Usage data\n\n## How We Use Your Data\n\n- Operating the marketplace\n- Communicating about your orders\n- Improving user experience\n\n## Your Rights\n\n- You can request account and data deletion\n- You can update your information at any time`,
  },
  safety: {
    titleAr: 'نصائح الأمان',
    titleEn: 'Safety Tips',
    contentAr: `# نصائح الأمان\n\n## للمشترين\n\n- استخدم نظام الضمان دائماً\n- لا ترسل أموالاً خارج المنصة\n- تحقق من تقييمات البائع\n- أكّد الاستلام فقط بعد فحص المنتج\n\n## للبائعين\n\n- أضف صوراً واضحة وحقيقية\n- اشحن في الوقت المحدد\n- تواصل مع المشتري بأدب\n- أضف رقم التتبع عند الشحن`,
    contentEn: `# Safety Tips\n\n## For Buyers\n\n- Always use the escrow system\n- Never send money outside the platform\n- Check seller ratings and reviews\n- Only confirm delivery after inspecting the item\n\n## For Sellers\n\n- Use clear, real photos\n- Ship on time\n- Communicate politely with buyers\n- Add tracking numbers when shipping`,
  },
};

router.get('/pages/:slug', (req, res, next) => {
  const page = PAGES[req.params.slug];
  if (!page) return res.status(404).render('404', { title: '404' });

  const locale = res.locals.locale;
  const title = locale === 'ar' ? page.titleAr : page.titleEn;
  const content = locale === 'ar' ? page.contentAr : page.contentEn;

  // marked output is server-controlled content, safe for <%-
  const html = marked(content);

  res.render('pages/static', { title, content: html });
});

module.exports = router;
