const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

router.get('/sitemap.xml', async (req, res) => {
  try {
    const base = process.env.SITE_URL || process.env.BASE_URL || 'https://whale.ps';
    const listings = await prisma.marketListing.findMany({
      where: { status: 'ACTIVE' },
      select: { slug: true, id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    });
    const categories = await prisma.marketCategory.findMany({ select: { slug: true } });

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    const statics = ['', '/whale', '/about', '/contact', '/safety', '/pricing', '/terms', '/privacy', '/buyer-protection', '/forum'];
    for (const p of statics) {
      xml += `<url><loc>${base}${p}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    }

    // Categories
    for (const cat of categories) {
      xml += `<url><loc>${base}/whale?category=${cat.slug}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>\n`;
    }

    // Listings
    for (const l of listings) {
      const loc = `${base}/whale/listing/${l.slug || l.id}`;
      const lastmod = l.updatedAt.toISOString().split('T')[0];
      xml += `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>\n`;
    }

    xml += '</urlset>';
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (e) {
    res.status(500).send('<?xml version="1.0"?><urlset/>');
  }
});

router.get('/robots.txt', (req, res) => {
  const base = process.env.SITE_URL || process.env.BASE_URL || 'https://whale.ps';
  res.set('Content-Type', 'text/plain');
  res.send(`User-agent: *
Disallow: /admin/
Disallow: /auth/
Disallow: /api/
Disallow: /prefs/
Allow: /

Sitemap: ${base}/sitemap.xml
`);
});

module.exports = router;
