const prisma = require('../lib/prisma');

async function listProducts(category, options = {}) {
  const where = {};
  if (category) where.category = category;
  if (options.inStock !== undefined) where.inStock = options.inStock;
  if (options.featured) where.featured = true;

  return prisma.product.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    include: { _count: { select: { reviews: true } } },
  });
}

async function getProductById(id) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { id: true, username: true, avatar: true } } },
      },
    },
  });
}

async function createProduct(data) {
  return prisma.product.create({ data });
}

async function updateProduct(id, data) {
  return prisma.product.update({ where: { id }, data });
}

async function deleteProduct(id) {
  return prisma.product.delete({ where: { id } });
}

async function adminListProducts(category) {
  const where = {};
  if (category) where.category = category;
  return prisma.product.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
}

async function countProducts() {
  return prisma.product.count();
}

module.exports = { listProducts, getProductById, createProduct, updateProduct, deleteProduct, adminListProducts, countProducts };
