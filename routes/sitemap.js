const express = require('express');

const prisma = require('../lib/prisma');

const router = express.Router();

function siteBase(req) {
  const envBase = process.env.OAUTH_CALLBACK_BASE || process.env.SITE_URL || process.env.BASE_URL;
  if (envBase) return envBase.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

router.get('/sitemap.xml', async (req, res) => {
  try {
    const BASE = siteBase(req);
    const [listings, categories] = await Promise.all([
      prisma.marketListing.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 5000
      }),
      prisma.marketCategory.findMany({
        select: { slug: true }
      })
    ]);

    const urls = [
      `<url><loc>${BASE}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      `<url><loc>${BASE}/whale</loc><changefreq>hourly</changefreq><priority>0.9</priority></url>`,
      `<url><loc>${BASE}/about</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
      `<url><loc>${BASE}/contact</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
      ...categories.map((c) => `<url><loc>${BASE}/whale?category=${encodeURIComponent(c.slug)}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`),
      ...listings.map((l) => {
        const loc = `${BASE}/whale/listing/${encodeURIComponent(l.slug || l.id)}`;
        const mod = new Date(l.updatedAt).toISOString().split('T')[0];
        return `<url><loc>${loc}</loc><lastmod>${mod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
      })
    ];

    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`);
  } catch (_error) {
    res.status(500).type('text/plain').send('Sitemap error');
  }
});

router.get('/robots.txt', (req, res) => {
  const BASE = siteBase(req);
  res.type('text/plain').send(`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /auth/
Disallow: /api/
Disallow: /prefs/
Sitemap: ${BASE}/sitemap.xml`);
});

module.exports = router;
