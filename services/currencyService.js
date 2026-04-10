const prisma = require('../lib/prisma');

const hasDatabase = Boolean(process.env.DATABASE_URL);

/** Default rates used when DB is unavailable or pair not found. */
const FALLBACK_RATES = {
  'USD_ILS': 3.65,
  'ILS_USD': 0.274,
  'USD_JOD': 0.709,
  'JOD_USD': 1.41,
  'ILS_JOD': 0.194,
  'JOD_ILS': 5.15,
};

/**
 * Get exchange rate between two currencies.
 * Returns { rate, source } where source is 'db' or 'fallback'.
 */
async function getRate(fromCur, toCur) {
  if (fromCur === toCur) return { rate: 1, source: 'identity' };

  if (hasDatabase) {
    const row = await prisma.exchangeRate.findUnique({
      where: { fromCur_toCur: { fromCur, toCur } },
    });
    if (row) return { rate: Number(row.rate), source: 'db' };
  }

  const key = `${fromCur}_${toCur}`;
  if (FALLBACK_RATES[key]) {
    return { rate: FALLBACK_RATES[key], source: 'fallback' };
  }

  throw new Error(`RATE_NOT_FOUND: ${fromCur} → ${toCur}`);
}

/**
 * Convert an amount from one currency to another.
 */
async function convert(amount, fromCur, toCur) {
  const { rate, source } = await getRate(fromCur, toCur);
  const converted = Math.round(amount * rate * 100) / 100; // 2 decimal places
  return { original: amount, converted, fromCur, toCur, rate, source };
}

/**
 * Format a price for display with currency symbol.
 */
function formatPrice(amount, currency = 'USD', locale = 'en') {
  const symbols = { USD: '$', ILS: '₪', JOD: 'JD', EUR: '€' };
  const symbol = symbols[currency] || currency;
  const formatted = Number(amount).toFixed(2);

  if (locale === 'ar') {
    return `${formatted} ${symbol}`;
  }
  return `${symbol}${formatted}`;
}

// ─── Admin: Exchange Rate Management ────────────────────────────────────────

async function listRates() {
  if (!hasDatabase) return Object.entries(FALLBACK_RATES).map(([key, rate]) => {
    const [fromCur, toCur] = key.split('_');
    return { fromCur, toCur, rate, source: 'fallback' };
  });

  return prisma.exchangeRate.findMany({ orderBy: { fromCur: 'asc' } });
}

async function upsertRate(fromCur, toCur, rate) {
  if (!hasDatabase) throw new Error('DATABASE_REQUIRED');

  return prisma.exchangeRate.upsert({
    where: { fromCur_toCur: { fromCur, toCur } },
    update: { rate, updatedAt: new Date() },
    create: { fromCur, toCur, rate },
  });
}

async function deleteRate(rateId) {
  if (!hasDatabase) throw new Error('DATABASE_REQUIRED');
  return prisma.exchangeRate.delete({ where: { id: rateId } });
}

module.exports = {
  getRate,
  convert,
  formatPrice,
  listRates,
  upsertRate,
  deleteRate,
  FALLBACK_RATES,
};
