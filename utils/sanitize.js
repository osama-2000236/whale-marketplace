function sanitizeText(input, maxLen = 5000) {
  if (input == null) return '';
  return String(input)
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function sanitizeInt(input, { min = 0, max = Number.MAX_SAFE_INTEGER, defaultVal = 0 } = {}) {
  const n = parseInt(input, 10);
  if (Number.isNaN(n)) return defaultVal;
  return Math.max(min, Math.min(max, n));
}

function sanitizeSlug(input, maxLen = 120) {
  if (!input) return '';
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, maxLen);
}

function sanitizePhone(input) {
  if (!input) return '';
  return String(input).replace(/[^\d+\-() ]/g, '').trim();
}

function isValidEmail(input) {
  if (!input) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input).trim());
}

function sanitizeTags(input, maxTags = 10, maxLen = 40) {
  if (!input) return [];
  const raw = Array.isArray(input) ? input : String(input).split(',');
  return raw
    .map((t) => sanitizeText(t, maxLen).toLowerCase())
    .filter((t) => t.length > 0)
    .slice(0, maxTags);
}

module.exports = { sanitizeText, sanitizeInt, sanitizeSlug, sanitizePhone, isValidEmail, sanitizeTags };
