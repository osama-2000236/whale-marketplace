const prisma = require('../lib/prisma');

async function getFeaturedProducts(limit = 8) {
  return prisma.product.findMany({
    where: {
      featured: true,
      inStock: true
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: limit
  });
}

async function getLatestProducts(limit = 8) {
  return prisma.product.findMany({
    where: {
      inStock: true
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

async function listProducts({ category, search, page = 1, limit = 12 } = {}) {
  const where = {
    inStock: true
  };

  if (category) {
    where.category = category;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { nameAr: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } }
    ];
  }

  const currentPage = Number(page) || 1;
  const take = Number(limit) || 12;
  const skip = (currentPage - 1) * take;

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip,
      take
    }),
    prisma.product.count({ where })
  ]);

  const totalPages = Math.max(Math.ceil(total / take), 1);

  return {
    items,
    pagination: {
      page: currentPage,
      limit: take,
      total,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    }
  };
}

async function getProductById(id) {
  return prisma.product.findUnique({ where: { id } });
}

async function getRelatedProducts(productId, category, limit = 4) {
  return prisma.product.findMany({
    where: {
      category,
      id: { not: productId },
      inStock: true
    },
    orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    take: limit
  });
}

async function adminListProducts(category) {
  const where = category ? { category } : undefined;
  return prisma.product.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
  });
}

async function createProduct(data) {
  return prisma.product.create({ data });
}

async function updateProduct(id, data) {
  return prisma.product.update({
    where: { id },
    data
  });
}

async function deleteProduct(id) {
  return prisma.product.delete({ where: { id } });
}

async function countProducts(where = undefined) {
  return prisma.product.count({ where });
}

module.exports = {
  getFeaturedProducts,
  getLatestProducts,
  listProducts,
  getProductById,
  getRelatedProducts,
  adminListProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  countProducts
};
