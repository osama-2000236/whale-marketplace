const prisma = require('../lib/prisma');
const slugify = require('slugify');

const hasDatabase = Boolean(process.env.DATABASE_URL);

/**
 * Register a new vendor (store) for a user.
 * The vendor starts in PENDING status and must be approved by an admin.
 */
async function registerVendor(userId, { name, nameAr, description, descriptionAr, logo, banner }) {
  if (!hasDatabase) throw new Error('DATABASE_REQUIRED');

  const existing = await prisma.vendor.findUnique({ where: { userId } });
  if (existing) throw new Error('VENDOR_EXISTS');

  // Require Pro subscription to create a vendor
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (
    !user.subscription ||
    user.subscription.plan !== 'pro' ||
    (user.subscription.paidUntil && user.subscription.paidUntil < new Date())
  ) {
    throw new Error('PRO_REQUIRED');
  }

  let slug = slugify(name, { lower: true, strict: true });
  if (!slug || slug.length < 2) {
    slug = 'store-' + Math.random().toString(36).slice(2, 10);
  }
  // Ensure uniqueness
  let baseSlug = slug;
  let attempt = 1;
  while (await prisma.vendor.findUnique({ where: { slug } })) {
    slug = baseSlug + '-' + attempt++;
  }

  return prisma.vendor.create({
    data: {
      userId,
      name,
      nameAr: nameAr || null,
      slug,
      description: description || null,
      descriptionAr: descriptionAr || null,
      logo: logo || null,
      banner: banner || null,
      status: 'PENDING',
    },
  });
}

/**
 * Admin: approve a vendor application.
 */
async function approveVendor(vendorId) {
  if (!hasDatabase) throw new Error('DATABASE_REQUIRED');
  return prisma.vendor.update({
    where: { id: vendorId },
    data: { status: 'APPROVED' },
  });
}

/**
 * Admin: suspend a vendor.
 */
async function suspendVendor(vendorId, _reason) {
  if (!hasDatabase) throw new Error('DATABASE_REQUIRED');
  return prisma.vendor.update({
    where: { id: vendorId },
    data: { status: 'SUSPENDED' },
  });
}

/**
 * Admin: reject a vendor application.
 */
async function rejectVendor(vendorId) {
  if (!hasDatabase) throw new Error('DATABASE_REQUIRED');
  return prisma.vendor.update({
    where: { id: vendorId },
    data: { status: 'REJECTED' },
  });
}

/**
 * Get vendor by userId.
 */
async function getVendorByUserId(userId) {
  if (!hasDatabase) return null;
  return prisma.vendor.findUnique({
    where: { userId },
    include: { user: { select: { username: true, email: true, avatarUrl: true } } },
  });
}

/**
 * Get vendor by slug (public store page).
 */
async function getVendorBySlug(slug) {
  if (!hasDatabase) return null;
  return prisma.vendor.findUnique({
    where: { slug },
    include: {
      user: { select: { username: true, avatarUrl: true } },
      listings: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { category: true },
      },
    },
  });
}

/**
 * List all vendors (admin panel).
 */
async function listVendors({ status, page = 1, limit = 25 } = {}) {
  if (!hasDatabase) return { vendors: [], total: 0 };

  const where = status ? { status } : {};
  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { username: true, email: true } } },
    }),
    prisma.vendor.count({ where }),
  ]);

  return { vendors, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Get vendor dashboard stats.
 */
async function getVendorDashboard(vendorId) {
  if (!hasDatabase) return null;

  const [vendor, orderStats, recentOrders] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: vendorId } }),
    prisma.order.aggregate({
      where: { vendorId, status: { in: ['COMPLETED', 'DELIVERED'] } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.order.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        listing: { select: { title: true, titleAr: true } },
        buyer: { select: { username: true } },
      },
    }),
  ]);

  return {
    vendor,
    totalRevenue: orderStats._sum.amount || 0,
    totalOrders: orderStats._count || 0,
    recentOrders,
  };
}

/**
 * Update vendor profile.
 */
async function updateVendor(vendorId, userId, data) {
  if (!hasDatabase) throw new Error('DATABASE_REQUIRED');

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw new Error('VENDOR_NOT_FOUND');
  if (vendor.userId !== userId) throw new Error('UNAUTHORIZED');

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.nameAr !== undefined) updateData.nameAr = data.nameAr;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.descriptionAr !== undefined) updateData.descriptionAr = data.descriptionAr;
  if (data.logo !== undefined) updateData.logo = data.logo;
  if (data.banner !== undefined) updateData.banner = data.banner;
  if (data.payoutMethod !== undefined) updateData.payoutMethod = data.payoutMethod;
  if (data.payoutDetails !== undefined) updateData.payoutDetails = data.payoutDetails;

  return prisma.vendor.update({ where: { id: vendorId }, data: updateData });
}

module.exports = {
  registerVendor,
  approveVendor,
  suspendVendor,
  rejectVendor,
  getVendorByUserId,
  getVendorBySlug,
  listVendors,
  getVendorDashboard,
  updateVendor,
};
