const prisma = require('../lib/prisma');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

async function createReferralCode(label) {
  const code = uuidv4().split('-')[0].toUpperCase();
  return prisma.referralCode.create({
    data: { code, label },
  });
}

async function generateQRDataUrl(text, size = 256) {
  return QRCode.toDataURL(text, { width: size, margin: 2 });
}

async function generateQRBuffer(text, size = 512) {
  return QRCode.toBuffer(text, { width: size, margin: 2 });
}

async function getAllCodes() {
  return prisma.referralCode.findMany({ orderBy: { createdAt: 'desc' } });
}

async function markCodeUsed(code) {
  const ref = await prisma.referralCode.findUnique({ where: { code: code.toUpperCase() } });
  if (!ref) return null;
  return prisma.referralCode.update({
    where: { id: ref.id },
    data: { usedCount: { increment: 1 } },
  });
}

function getGeneralQRUrls() {
  const base = process.env.SITE_URL || 'https://whale.ps';
  return [
    { label: 'Marketplace', url: `${base}/whale` },
    { label: 'Register', url: `${base}/auth/register` },
    { label: 'Welcome', url: `${base}/welcome` },
  ];
}

module.exports = { createReferralCode, generateQRDataUrl, generateQRBuffer, getAllCodes, markCodeUsed, getGeneralQRUrls };
