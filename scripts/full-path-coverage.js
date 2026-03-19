/* eslint-disable no-console */
/**
 * Full Express route path coverage runner.
 *
 * - Discovers all registered routes from server.js
 * - Creates deterministic coverage fixtures
 * - Exercises each route with an appropriate actor/session
 * - Writes JSON + Markdown reports
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const bcrypt = require('bcryptjs');

if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';
if (!process.env.DATABASE_URL) {
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.test' });
}

const app = require('../server');
const prisma = require('../lib/prisma');

const OUTPUT_JSON = path.join(process.cwd(), 'full-path-coverage-report.json');
const OUTPUT_MD = path.join(process.cwd(), 'full-path-coverage-report.md');

function normalizePath(inputPath) {
  const normalized = (`/${String(inputPath || '')}`).replace(/\/+/g, '/').replace(/\/$/, '');
  return normalized || '/';
}

function mountFromRegex(regexp) {
  if (!regexp) return '';
  const source = regexp.toString();
  if (source === '/^\\/?(?=\\/|$)/i') return '';

  return source
    .replace('/^\\', '')
    .replace('\\/?(?=\\/|$)/i', '')
    .replace('/i', '')
    .replace(/\\\//g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

function collectRoutes(stack, prefix = '') {
  const routes = [];

  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods)
        .filter((method) => layer.route.methods[method])
        .map((method) => method.toUpperCase());
      const routePaths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];

      for (const routePath of routePaths) {
        for (const method of methods) {
          routes.push({
            method,
            path: normalizePath(`${prefix}/${routePath}`)
          });
        }
      }
      continue;
    }

    if (layer.name === 'router' && layer.handle && Array.isArray(layer.handle.stack)) {
      const mount = mountFromRegex(layer.regexp);
      const nextPrefix = normalizePath(`${prefix}/${mount}`);
      routes.push(...collectRoutes(layer.handle.stack, nextPrefix === '/' ? '' : nextPrefix));
    }
  }

  return routes;
}

function uniqueRoutes(routes) {
  const seen = new Set();
  const result = [];

  for (const route of routes) {
    const key = `${route.method} ${route.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(route);
  }

  return result;
}

async function getCsrfToken(agent) {
  try {
    const jsonRes = await agent.get('/auth/csrf');
    if (jsonRes.status === 200 && jsonRes.body && jsonRes.body.csrfToken) {
      return jsonRes.body.csrfToken;
    }
  } catch (_error) {
    // Fallback below
  }

  const htmlRes = await agent.get('/auth/login');
  const tokenFromMeta = htmlRes.text.match(/<meta name="csrf-token" content="([^"]+)"/i);
  if (tokenFromMeta && tokenFromMeta[1]) return tokenFromMeta[1];

  const tokenFromInput = htmlRes.text.match(/name="_csrf"\s+value="([^"]+)"/i);
  if (tokenFromInput && tokenFromInput[1]) return tokenFromInput[1];

  throw new Error('Could not read CSRF token');
}

async function loginAgent(agent, identifier, password) {
  const token = await getCsrfToken(agent);
  return agent
    .post('/auth/login')
    .set('x-csrf-token', token)
    .type('form')
    .send({ identifier, password, _csrf: token });
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

async function upsertCoverageUser({ username, email, role = 'MEMBER', password = 'pass12345' }) {
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        passwordHash,
        role,
        isBanned: false
      }
    });
    return { user: updated, password };
  }

  const created = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      role
    }
  });
  return { user: created, password };
}

async function ensureCoverageFixtures() {
  const suffix = randomSuffix();

  const adminCreds = await upsertCoverageUser({
    username: `coverage_admin_${suffix}`,
    email: `coverage_admin_${suffix}@example.com`,
    role: 'ADMIN'
  });
  const sellerCreds = await upsertCoverageUser({
    username: `coverage_seller_${suffix}`,
    email: `coverage_seller_${suffix}@example.com`,
    role: 'MEMBER'
  });
  const buyerCreds = await upsertCoverageUser({
    username: `coverage_buyer_${suffix}`,
    email: `coverage_buyer_${suffix}@example.com`,
    role: 'MEMBER'
  });

  const users = {
    admin: adminCreds.user,
    seller: sellerCreds.user,
    buyer: buyerCreds.user
  };

  const passwords = {
    admin: adminCreds.password,
    seller: sellerCreds.password,
    buyer: buyerCreds.password
  };

  await prisma.subscription.upsert({
    where: { userId: users.seller.id },
    create: { userId: users.seller.id, plan: 'pro', paidUntil: new Date(Date.now() + 30 * 86400000) },
    update: { plan: 'pro', paidUntil: new Date(Date.now() + 30 * 86400000) }
  });
  await prisma.subscription.upsert({
    where: { userId: users.buyer.id },
    create: { userId: users.buyer.id, plan: 'pro', paidUntil: new Date(Date.now() + 30 * 86400000) },
    update: { plan: 'pro', paidUntil: new Date(Date.now() + 30 * 86400000) }
  });

  const category = await prisma.marketCategory.upsert({
    where: { slug: `coverage-cat-${suffix}` },
    create: {
      slug: `coverage-cat-${suffix}`,
      name: `Coverage Category ${suffix}`,
      nameAr: `تصنيف الاختبار ${suffix}`,
      icon: '🧪',
      order: 9990
    },
    update: {}
  });

  const listing = await prisma.marketListing.create({
    data: {
      title: 'Coverage Listing',
      titleAr: 'إعلان تغطية',
      description: 'Listing for full route coverage testing',
      descriptionAr: 'إعلان لاختبار تغطية المسارات',
      slug: `coverage-listing-${suffix}`,
      price: 777,
      condition: 'GOOD',
      images: [],
      sellerId: users.seller.id,
      categoryId: category.id,
      city: 'Tulkarem',
      status: 'ACTIVE',
      quantity: 5,
      tags: ['coverage']
    }
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: `WH-COV-${Date.now().toString().slice(-8)}`,
      listingId: listing.id,
      buyerId: users.buyer.id,
      sellerId: users.seller.id,
      quantity: 1,
      amount: listing.price,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      orderStatus: 'PENDING',
      shippingMethod: 'self_pickup'
    }
  });
  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      event: 'created',
      actorId: users.buyer.id,
      note: 'coverage fixture order'
    }
  });

  const room = await prisma.gameRoom.upsert({
    where: { slug: `coverage-room-${suffix}` },
    create: {
      name: 'Coverage Room',
      nameAr: 'غرفة التغطية',
      slug: `coverage-room-${suffix}`,
      game: 'Coverage Game',
      description: 'Coverage room'
    },
    update: {}
  });

  const forumCategory = await prisma.forumCategory.upsert({
    where: { slug: `coverage-forum-${suffix}` },
    create: {
      name: `Coverage Forum ${suffix}`,
      nameAr: 'منتدى التغطية',
      slug: `coverage-forum-${suffix}`,
      description: 'Coverage forum category'
    },
    update: {}
  });

  const thread = await prisma.forumThread.create({
    data: {
      title: 'Coverage Thread',
      slug: `coverage-thread-${suffix}`,
      body: 'Coverage thread body with enough text.',
      authorId: users.seller.id,
      categoryId: forumCategory.id,
      tags: ['coverage']
    }
  });

  const reply = await prisma.forumReply.create({
    data: {
      body: 'Coverage reply body',
      authorId: users.buyer.id,
      threadId: thread.id
    }
  });

  const post = await prisma.post.create({
    data: {
      content: 'Coverage social post',
      authorId: users.seller.id,
      roomId: room.id,
      type: 'UPDATE'
    }
  });

  const comment = await prisma.comment.create({
    data: {
      content: 'Coverage comment',
      authorId: users.buyer.id,
      postId: post.id
    }
  });

  const product = await prisma.product.create({
    data: {
      name: `Coverage Product ${suffix}`,
      category: 'pc',
      price: 123,
      inStock: true,
      featured: false,
      sortOrder: 9999
    }
  });

  const referral = await prisma.referralCode.create({
    data: {
      code: `COV${suffix.toUpperCase()}`,
      label: `Coverage code ${suffix}`
    }
  });

  return {
    users,
    passwords,
    category,
    listing,
    order,
    room,
    forumCategory,
    thread,
    reply,
    post,
    comment,
    product,
    referral,
    missingId: '00000000-0000-0000-0000-000000000000'
  };
}

function resolveRoutePath(routePath, method, ctx) {
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const shouldUseMissing =
    isWrite &&
    /(\/delete|\/remove|\/mark-sold|\/cancel|\/confirm|\/ship|\/review|\/resolve-dispute|\/suspend-listing|\/verify-seller)/i.test(routePath);

  const idForAction = shouldUseMissing ? ctx.missingId : ctx.listing.id;
  const orderIdForAction = shouldUseMissing ? ctx.missingId : ctx.order.id;
  const productIdForAction = shouldUseMissing ? ctx.missingId : ctx.product.id;
  const commentIdForAction = shouldUseMissing ? ctx.missingId : ctx.comment.id;
  const postIdForAction = shouldUseMissing ? ctx.missingId : ctx.post.id;
  const replyIdForAction = shouldUseMissing ? ctx.missingId : ctx.reply.id;

  let resolved = routePath;

  resolved = resolved.replace(':replyId', replyIdForAction);
  resolved = resolved.replace(':threadSlug', ctx.thread.slug);
  resolved = resolved.replace(':slug', (() => {
    if (resolved.startsWith('/rooms/') || resolved.startsWith('/api/rooms/')) return ctx.room.slug;
    if (resolved.startsWith('/forum/')) return ctx.forumCategory.slug;
    return ctx.category.slug;
  })());
  resolved = resolved.replace(':username', (() => {
    if (resolved.startsWith('/whale/seller/')) return ctx.users.seller.username;
    return ctx.users.buyer.username;
  })());
  resolved = resolved.replace(':code', ctx.referral.code);

  if (resolved.includes('/admin/products/')) resolved = resolved.replace(':id', productIdForAction);
  if (resolved.startsWith('/api/products/')) resolved = resolved.replace(':id', productIdForAction);
  if (resolved.startsWith('/posts/')) resolved = resolved.replace(':id', postIdForAction);
  if (resolved.startsWith('/api/posts/')) resolved = resolved.replace(':id', postIdForAction);
  if (resolved.startsWith('/comments/')) resolved = resolved.replace(':id', commentIdForAction);
  if (resolved.startsWith('/api/comments/')) resolved = resolved.replace(':id', commentIdForAction);
  if (resolved.startsWith('/whale/orders/')) resolved = resolved.replace(':id', orderIdForAction);
  if (resolved.startsWith('/whale/listing/:idOrSlug')) resolved = resolved.replace(':idOrSlug', ctx.listing.slug || ctx.listing.id);
  if (resolved.startsWith('/whale/listing/')) resolved = resolved.replace(':id', idForAction);
  if (resolved.startsWith('/admin/listings/')) resolved = resolved.replace(':id', ctx.missingId);
  if (resolved.startsWith('/api/users/')) resolved = resolved.replace(':username', ctx.users.buyer.username);

  resolved = resolved.replace(':id', ctx.missingId);
  return normalizePath(resolved);
}

function buildPayload(route, ctx) {
  const { method, path: routePath } = route;

  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;

  if (routePath === '/auth/register' || routePath === '/api/auth/register') {
    const suffix = randomSuffix();
    return {
      username: `coverage_reg_${suffix}`,
      email: `coverage_reg_${suffix}@example.com`,
      password: 'pass12345'
    };
  }

  if (routePath === '/auth/login' || routePath === '/api/auth/login') {
    return { identifier: ctx.users.buyer.username, password: ctx.passwords.buyer };
  }

  if (routePath === '/auth/reset') {
    return { identifier: ctx.users.buyer.email };
  }

  if (routePath === '/auth/reset-password') {
    return { token: 'invalid-token', password: 'pass12345', confirmPassword: 'pass12345' };
  }

  if (routePath === '/prefs/lang') return { lang: 'en' };
  if (routePath === '/prefs/theme') return { theme: 'light' };

  if (routePath === '/posts') return { content: 'Coverage web post content' };
  if (routePath === '/comments') return { postId: ctx.post.id, content: 'Coverage web comment' };
  if (routePath === '/u/:username/follow') return {};
  if (routePath === '/rooms/:slug/join') return {};

  if (routePath === '/forum/:slug/new') {
    return { title: 'Coverage Forum Thread', body: 'Coverage forum body with enough characters.', tags: 'coverage,test' };
  }
  if (routePath === '/forum/:slug/:threadSlug/reply') return { body: 'Coverage forum reply' };
  if (routePath === '/forum/reply/:replyId/like') return {};
  if (routePath === '/forum/reply/:replyId/accept') return {};

  if (routePath === '/api/posts') return { content: 'Coverage API post' };
  if (routePath === '/api/posts/comments') return { postId: ctx.post.id, content: 'Coverage API comment' };
  if (routePath === '/api/comments') return { postId: ctx.post.id, content: 'Coverage API comment' };
  if (routePath === '/api/users/me' && method === 'PATCH') return { bio: 'Coverage bio update' };
  if (routePath === '/api/rooms/:slug/join') return {};
  if (routePath === '/api/posts/:id/like') return {};

  if (routePath === '/whale/sell') {
    return {
      title: 'Coverage Sell Listing',
      description: 'Coverage sell description',
      price: '321',
      city: 'Tulkarem',
      condition: 'GOOD',
      categoryId: ctx.category.id
    };
  }

  if (routePath === '/whale/listing/:id/edit') {
    return {
      title: 'Coverage Edited Listing',
      description: 'Coverage edited description',
      price: '432',
      city: 'Tulkarem',
      condition: 'GOOD',
      categoryId: ctx.category.id
    };
  }

  if (routePath === '/whale/listing/:id/buy') {
    return {
      quantity: '1',
      paymentMethod: 'cod',
      shippingMethod: 'self_pickup',
      buyerName: 'Coverage Buyer',
      buyerPhone: '0599000000',
      buyerCity: 'Tulkarem',
      buyerAddress: 'Coverage street'
    };
  }

  if (routePath === '/whale/listing/:id/save') return {};
  if (routePath === '/whale/listing/:id/wa-click') return {};
  if (routePath === '/whale/cart/add') return { listingId: ctx.listing.id, quantity: '1' };
  if (routePath === '/whale/cart/remove') return { listingId: ctx.listing.id };
  if (routePath === '/whale/cart/checkout') {
    return {
      paymentMethod: 'cod',
      shippingMethod: 'self_pickup',
      buyerName: 'Coverage Buyer',
      buyerPhone: '0599000000',
      buyerCity: 'Tulkarem',
      buyerAddress: 'Coverage address'
    };
  }
  if (routePath === '/whale/orders/:id/review') return { rating: '5', title: 'Good', body: 'Coverage review text' };
  if (routePath.startsWith('/whale/orders/:id/')) return {};

  if (routePath === '/payment/start') return { planMonths: '1', provider: 'paypal' };

  if (routePath === '/admin/login') return { username: ctx.users.admin.username, password: ctx.passwords.admin };
  if (routePath === '/admin/settings') return {};
  if (routePath === '/admin/products/add') return { name: 'Coverage Admin Product', category: 'pc', price: '99' };
  if (routePath === '/admin/products/edit/:id') return { name: 'Coverage Edit Product', category: 'pc', price: '100' };
  if (routePath === '/admin/products/toggle/:id') return { field: 'featured' };
  if (routePath === '/admin/qr/generate') return { label: 'Coverage QR Label' };
  if (routePath === '/admin/subscriptions/activate') return { userId: ctx.users.buyer.id, planMonths: '1', note: 'coverage' };
  if (routePath === '/admin/whale/verify-seller') return { userId: ctx.users.seller.id };
  if (routePath === '/admin/whale/suspend-listing') return { listingId: ctx.missingId, reason: 'coverage test' };
  if (routePath === '/admin/whale/resolve-dispute') return { disputeId: ctx.missingId, winner: 'buyer', resolution: 'coverage' };

  if (routePath === '/webhooks/paymob') {
    return { obj: { order: { merchant_order_id: 'coverage' }, success: false } };
  }

  return {};
}

function shouldUseJson(routePath) {
  return routePath.startsWith('/api/') || routePath === '/webhooks/paymob' || routePath.includes('/admin/whale/');
}

function chooseActor(route) {
  const routePath = route.path;

  if (routePath.startsWith('/admin')) {
    if (routePath === '/admin/login') return 'guest';
    return 'admin';
  }

  if (routePath.startsWith('/auth/')) {
    if (
      routePath === '/auth/login' ||
      routePath === '/auth/register' ||
      routePath === '/auth/reset' ||
      routePath === '/auth/reset-password' ||
      routePath === '/auth/google' ||
      routePath === '/auth/facebook' ||
      routePath === '/auth/apple'
    ) {
      return 'guest';
    }
    return 'buyer';
  }

  if (routePath.startsWith('/api/auth/')) {
    if (routePath === '/api/auth/login' || routePath === '/api/auth/register') return 'guest';
    return 'buyer';
  }

  if (routePath.startsWith('/whale/listing/:id/')) {
    if (route.method === 'GET') return routePath.endsWith('/buy') ? 'buyer' : 'seller';
    if (routePath.includes('/save') || routePath.includes('/buy')) return 'buyer';
    return 'seller';
  }

  if (routePath.startsWith('/whale/orders/:id/')) {
    if (routePath.includes('/confirm') || routePath.includes('/ship')) return 'seller';
    return 'buyer';
  }

  if (routePath.startsWith('/whale') || routePath.startsWith('/payment/') || routePath === '/upgrade') {
    return 'buyer';
  }

  if (routePath.startsWith('/forum/') || routePath.startsWith('/rooms/') || routePath.startsWith('/u/')) {
    if (route.method === 'GET') return 'guest';
    return 'buyer';
  }

  if (routePath.startsWith('/api/')) return 'buyer';
  if (routePath.startsWith('/prefs/')) return 'buyer';
  if (routePath === '/posts' || routePath.startsWith('/posts/') || routePath.startsWith('/comments/')) {
    return route.method === 'GET' ? 'guest' : 'buyer';
  }

  return 'guest';
}

async function sendRouteRequest(agent, actor, route, resolvedPath, payload) {
  const method = route.method.toLowerCase();
  let req = agent[method](resolvedPath);

  req = req.redirects(0);

  if (!['get', 'head', 'options'].includes(method)) {
    const csrfToken = await getCsrfToken(agent);
    req = req.set('x-csrf-token', csrfToken);

    const body = { ...(payload || {}), _csrf: csrfToken };
    if (shouldUseJson(route.path)) {
      req = req.send(body);
    } else {
      req = req.type('form').send(body);
    }
  }

  const res = await req;
  return {
    actor,
    status: res.status,
    location: res.headers.location || null
  };
}

function statusSummary(rows) {
  return rows.reduce((acc, row) => {
    const key = String(row.status || 0);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function toMarkdown(report) {
  const lines = [];
  lines.push('# Full Path Coverage Report');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Total routes discovered: ${report.totalRoutes}`);
  lines.push(`- Total requests executed: ${report.totalRequests}`);
  lines.push(`- Any 500 responses: ${report.has500 ? 'YES' : 'NO'}`);
  lines.push('');
  lines.push('## Status Summary');
  lines.push('');
  Object.keys(report.summary)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((code) => lines.push(`- ${code}: ${report.summary[code]}`));
  lines.push('');
  lines.push('## Route Results');
  lines.push('');
  lines.push('| Method | Route | Resolved Path | Actor | Status | Location |');
  lines.push('|---|---|---|---|---:|---|');
  report.results.forEach((row) => {
    lines.push(
      `| ${row.method} | ${row.route} | ${row.path} | ${row.actor} | ${row.status} | ${row.location || ''} |`
    );
  });
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const discoveredRoutes = uniqueRoutes(collectRoutes(app._router.stack))
    .sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`));

  const fixture = await ensureCoverageFixtures();

  const agents = {
    guest: request.agent(app),
    buyer: request.agent(app),
    seller: request.agent(app),
    admin: request.agent(app)
  };

  await loginAgent(agents.buyer, fixture.users.buyer.username, fixture.passwords.buyer);
  await loginAgent(agents.seller, fixture.users.seller.username, fixture.passwords.seller);
  await loginAgent(agents.admin, fixture.users.admin.username, fixture.passwords.admin);

  const results = [];

  for (const route of discoveredRoutes) {
    const actor = chooseActor(route);
    const agent = agents[actor] || agents.guest;
    const resolvedPath = resolveRoutePath(route.path, route.method, fixture);
    const payload = buildPayload(route, fixture);

    try {
      const primary = await sendRouteRequest(agent, actor, route, resolvedPath, payload);
      results.push({
        method: route.method,
        route: route.path,
        path: resolvedPath,
        actor: primary.actor,
        status: primary.status,
        location: primary.location
      });
    } catch (error) {
      results.push({
        method: route.method,
        route: route.path,
        path: resolvedPath,
        actor,
        status: 0,
        location: null,
        error: error.message
      });
    }
  }

  const summary = statusSummary(results);
  const has500 = Boolean(summary['500']);
  const report = {
    generatedAt: new Date().toISOString(),
    totalRoutes: discoveredRoutes.length,
    totalRequests: results.length,
    has500,
    summary,
    results
  };

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(OUTPUT_MD, toMarkdown(report), 'utf8');

  console.log(`Saved JSON report: ${OUTPUT_JSON}`);
  console.log(`Saved Markdown report: ${OUTPUT_MD}`);
  console.log(`Discovered routes: ${report.totalRoutes}`);
  console.log(`Requests executed: ${report.totalRequests}`);
  console.log(`500 responses: ${summary['500'] || 0}`);

  if (has500) {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error('Coverage runner failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
