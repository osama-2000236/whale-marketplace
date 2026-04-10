const prisma = require('../lib/prisma');

const hasDatabase = Boolean(process.env.DATABASE_URL);

/**
 * Calculate shipping cost for an order based on zone and weight.
 */
async function calculateShipping(city, weightKg = 0) {
  if (!hasDatabase) return { cost: 0, currency: 'ILS', carrier: 'default', estDays: null };

  // Find zone that includes this city
  const zones = await prisma.shippingZone.findMany({
    where: { isActive: true },
    include: {
      rates: {
        where: { isActive: true },
        orderBy: { cost: 'asc' },
      },
    },
  });

  const zone = zones.find((z) => z.cities.includes(city));
  if (!zone || zone.rates.length === 0) {
    return { cost: 0, currency: 'ILS', carrier: 'flat', estDays: null, zoneId: null };
  }

  // Find applicable rate by weight range
  const rate = zone.rates.find((r) => {
    const min = r.weightMin ? Number(r.weightMin) : 0;
    const max = r.weightMax ? Number(r.weightMax) : Infinity;
    return weightKg >= min && weightKg <= max;
  }) || zone.rates[zone.rates.length - 1]; // fallback to highest range

  const cost = Number(rate.cost);
  const freeAbove = rate.freeAbove ? Number(rate.freeAbove) : null;

  return {
    cost,
    currency: rate.currency,
    carrier: rate.carrier,
    estDays: rate.estDays,
    zoneId: zone.id,
    zoneName: zone.name,
    freeAbove,
  };
}

/**
 * Check if order qualifies for free shipping.
 */
function qualifiesForFreeShipping(shippingResult, orderSubtotal) {
  if (!shippingResult.freeAbove) return false;
  return orderSubtotal >= shippingResult.freeAbove;
}

// ─── Admin: Shipping Zone CRUD ──────────────────────────────────────────────

async function listShippingZones() {
  if (!hasDatabase) return [];
  return prisma.shippingZone.findMany({
    orderBy: { createdAt: 'desc' },
    include: { rates: { orderBy: { weightMin: 'asc' } } },
  });
}

async function getShippingZone(zoneId) {
  if (!hasDatabase) return null;
  return prisma.shippingZone.findUnique({
    where: { id: zoneId },
    include: { rates: { orderBy: { weightMin: 'asc' } } },
  });
}

async function createShippingZone({ name, nameAr, cities }) {
  if (!hasDatabase) throw new Error('DATABASE_REQUIRED');
  return prisma.shippingZone.create({
    data: {
      name,
      nameAr: nameAr || null,
      cities: cities || [],
    },
  });
}

async function updateShippingZone(zoneId, data) {
  if (!hasDatabase) throw new Error('DATABASE_REQUIRED');
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.nameAr !== undefined) updateData.nameAr = data.nameAr;
  if (data.cities !== undefined) updateData.cities = data.cities;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return prisma.shippingZone.update({ where: { id: zoneId }, data: updateData });
}

async function deleteShippingZone(zoneId) {
  if (!hasDatabase) throw new Error('DATABASE_REQUIRED');
  return prisma.shippingZone.delete({ where: { id: zoneId } });
}

// ─── Admin: Shipping Rate CRUD ──────────────────────────────────────────────

async function createShippingRate(zoneId, { carrier, weightMin, weightMax, cost, currency, freeAbove, estDays }) {
  if (!hasDatabase) throw new Error('DATABASE_REQUIRED');
  return prisma.shippingRate.create({
    data: {
      zoneId,
      carrier,
      weightMin: weightMin || null,
      weightMax: weightMax || null,
      cost,
      currency: currency || 'ILS',
      freeAbove: freeAbove || null,
      estDays: estDays || null,
    },
  });
}

async function updateShippingRate(rateId, data) {
  if (!hasDatabase) throw new Error('DATABASE_REQUIRED');
  const updateData = {};
  if (data.carrier !== undefined) updateData.carrier = data.carrier;
  if (data.weightMin !== undefined) updateData.weightMin = data.weightMin;
  if (data.weightMax !== undefined) updateData.weightMax = data.weightMax;
  if (data.cost !== undefined) updateData.cost = data.cost;
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.freeAbove !== undefined) updateData.freeAbove = data.freeAbove;
  if (data.estDays !== undefined) updateData.estDays = data.estDays;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return prisma.shippingRate.update({ where: { id: rateId }, data: updateData });
}

async function deleteShippingRate(rateId) {
  if (!hasDatabase) throw new Error('DATABASE_REQUIRED');
  return prisma.shippingRate.delete({ where: { id: rateId } });
}

module.exports = {
  calculateShipping,
  qualifiesForFreeShipping,
  listShippingZones,
  getShippingZone,
  createShippingZone,
  updateShippingZone,
  deleteShippingZone,
  createShippingRate,
  updateShippingRate,
  deleteShippingRate,
};
