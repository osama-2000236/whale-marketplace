const prisma = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Generate a new customer referral code for a PC sale.
 * label: e.g. "Ahmad Al-Masri — PC sale 2025-06-01"
 */
async function createReferralCode(label) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = uuidv4().split('-')[0].toUpperCase();
    try {
      // short 8-char code
      return await prisma.referralCode.create({ data: { code, label } });
    } catch (error) {
      if (!String(error.message).includes('Unique constraint')) {
        throw error;
      }
    }
  }

  throw new Error('Failed to generate unique referral code');
}

/**
 * Generate QR code as base64 PNG data URL.
 * url: the full URL to encode
 */
async function generateQRDataUrl(url, size = 512) {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 2,
    color: { dark: '#0D0D14', light: '#FFFFFF' },
    errorCorrectionLevel: 'H'
  });
}

/**
 * Generate QR as raw PNG buffer (for download endpoint).
 */
async function generateQRBuffer(url, size = 512) {
  return QRCode.toBuffer(url, {
    width: size,
    margin: 2,
    color: { dark: '#0D0D14', light: '#FFFFFF' },
    errorCorrectionLevel: 'H'
  });
}

/**
 * Get all referral codes with usage stats.
 */
async function getAllCodes() {
  return prisma.referralCode.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true } } }
  });
}

/**
 * Increment usedCount when a user registers via this code.
 */
async function markCodeUsed(code) {
  return prisma.referralCode.update({
    where: { code },
    data: { usedCount: { increment: 1 } }
  });
}

/**
 * Pre-built QR URLs for general platform use.
 */
function getGeneralQRUrls() {
  return [
    { label: 'Welcome / Register', url: `${BASE_URL}/welcome` },
    { label: 'Marketplace', url: `${BASE_URL}/marketplace` },
    { label: 'PC Build Forum', url: `${BASE_URL}/forum` }
  ];
}

module.exports = {
  createReferralCode,
  generateQRDataUrl,
  generateQRBuffer,
  getAllCodes,
  markCodeUsed,
  getGeneralQRUrls
};
