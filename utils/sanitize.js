/**
 * Shared input sanitization utilities for Whale Marketplace.
 *
 * Usage:
 *   const { sanitizeText, sanitizeInt, sanitizeSlug, sanitizePhone } = require('../utils/sanitize');
 */

/**
 * Strip HTML tags and trim whitespace from user text input.
 * Does NOT strip Arabic or unicode — only HTML angle brackets.
 */
function sanitizeText(input, maxLen = 5000) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')       // strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // strip control chars (keep \n \r \t)
    .trim()
    .slice(0, maxLen);
}

/**
 * Parse an integer from user input with bounds. Returns defaultVal on NaN.
 */
function sanitizeInt(input, { min = 0, max = Number.MAX_SAFE_INTEGER, defaultVal = 0 } = {}) {
  const n = parseInt(input, 10);
  if (Number.isNaN(n)) return defaultVal;
  return Math.max(min, Math.min(max, n));
}

/**
 * Sanitize a slug (URL-safe identifier). Only allows a-z 0-9 - _
 */
function sanitizeSlug(input, maxLen = 120) {
  if (typeof input !== 'string') return '';
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, '')
    .slice(0, maxLen);
}

/**
 * Sanitize a phone number — strip everything except digits, +, -, spaces.
 */
function sanitizePhone(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[^\d+\-\s()]/g, '').trim().slice(0, 20);
}

/**
 * Validate email format (basic check).
 */
function isValidEmail(input) {
  if (typeof input !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

/**
 * Sanitize an array of string tags.
 */
function sanitizeTags(input, maxTags = 10, maxLen = 40) {
  if (typeof input !== 'string') return [];
  return input
    .split(',')
    .map((tag) => sanitizeText(tag, maxLen))
    .filter((tag) => tag.length > 0)
    .slice(0, maxTags);
}

module.exports = {
  sanitizeText,
  sanitizeInt,
  sanitizeSlug,
  sanitizePhone,
  isValidEmail,
  sanitizeTags
};
