/**
 * Zod-based input validation schemas for Whale Marketplace.
 *
 * Centralizes all user-input validation with typed schemas,
 * consistent error messages, and bilingual (AR/EN) support.
 */

const { z } = require('zod');

// ── Shared refinements ──────────────────────────────────────────────────

const noHtml = (val) => !/<[^>]*>/.test(val);
const noControlChars = (val) => !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(val);

const safeText = (maxLen = 5000) =>
  z
    .string()
    .max(maxLen)
    .refine(noHtml, { message: 'HTML tags are not allowed' })
    .refine(noControlChars, { message: 'Control characters are not allowed' })
    .transform((v) => v.trim());

const optionalSafeText = (maxLen = 5000) =>
  z
    .string()
    .max(maxLen)
    .refine(noHtml, { message: 'HTML tags are not allowed' })
    .refine(noControlChars, { message: 'Control characters are not allowed' })
    .transform((v) => v.trim())
    .optional()
    .or(z.literal(''));

// ── Auth schemas ────────────────────────────────────────────────────────

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_\u0600-\u06FF]+$/, 'Username can only contain letters, numbers, underscores, and Arabic characters')
    .transform((v) => v.trim()),
  email: z
    .string()
    .max(255)
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().email('Invalid email address')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  ref: z.string().max(20).optional().or(z.literal(''))
});

const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Email or username is required')
    .max(255)
    .transform((v) => v.trim()),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(128)
});

// ── Listing schemas ─────────────────────────────────────────────────────

const VALID_CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'];

const createListingSchema = z.object({
  title: safeText(200).refine((v) => v.length >= 3, { message: 'Title must be at least 3 characters' }),
  titleAr: optionalSafeText(200),
  description: safeText(5000).refine((v) => v.length >= 10, { message: 'Description must be at least 10 characters' }),
  descriptionAr: optionalSafeText(5000),
  categoryId: z.string().max(100).optional().or(z.literal('')),
  subcategoryId: z.string().max(100).optional().or(z.literal('')),
  city: safeText(100),
  price: z.coerce.number().int().min(1, 'Price must be at least 1').max(10000000, 'Price exceeds maximum'),
  quantity: z.coerce.number().int().min(1).max(9999).default(1),
  condition: z.enum(VALID_CONDITIONS).optional().default('good'),
  tags: z
    .string()
    .transform((v) =>
      v
        .split(',')
        .map((t) => t.trim().replace(/<[^>]*>/g, '').slice(0, 40))
        .filter((t) => t.length > 0)
        .slice(0, 10)
    )
    .optional()
    .default(''),
  negotiable: z.enum(['true', 'false']).transform((v) => v === 'true').optional().default('false'),
  specs: z
    .string()
    .transform((v) => {
      try { return JSON.parse(v); } catch { return null; }
    })
    .optional()
    .or(z.literal(''))
});

// ── Order / Checkout schemas ────────────────────────────────────────────

const VALID_PAYMENT_METHODS = ['cod', 'card'];
const VALID_SHIPPING_METHODS = ['company', 'self_pickup', 'hand_to_hand'];

const buySchema = z.object({
  buyerName: safeText(100).refine((v) => v.length >= 2, { message: 'Name must be at least 2 characters' }),
  buyerPhone: z
    .string()
    .min(7, 'Phone number too short')
    .max(20, 'Phone number too long')
    .regex(/^[\d+\-\s()]+$/, 'Invalid phone number format')
    .transform((v) => v.trim()),
  buyerCity: safeText(100),
  buyerAddress: safeText(300).refine((v) => v.length >= 5, { message: 'Address must be at least 5 characters' }),
  buyerNote: optionalSafeText(1000),
  quantity: z.coerce.number().int().min(1).max(9999).default(1),
  paymentMethod: z.enum(VALID_PAYMENT_METHODS).default('cod'),
  shippingMethod: z.enum(VALID_SHIPPING_METHODS).default('company'),
  shippingCompany: safeText(100).optional().or(z.literal(''))
});

const cartCheckoutSchema = z.object({
  buyerName: safeText(100).refine((v) => v.length >= 2, { message: 'Name is required' }),
  buyerPhone: z
    .string()
    .min(7, 'Phone number too short')
    .max(20)
    .regex(/^[\d+\-\s()]+$/, 'Invalid phone number')
    .transform((v) => v.trim()),
  buyerCity: safeText(100),
  buyerAddress: safeText(300).refine((v) => v.length >= 5, { message: 'Address is required' }),
  buyerNote: optionalSafeText(1000),
  paymentMethod: z.enum(VALID_PAYMENT_METHODS).default('cod'),
  shippingMethod: z.enum(VALID_SHIPPING_METHODS).default('company'),
  shippingCompany: safeText(100).optional().or(z.literal(''))
});

// ── Review schema ───────────────────────────────────────────────────────

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: optionalSafeText(2000)
});

// ── Contact schema ──────────────────────────────────────────────────────

const contactSchema = z.object({
  name: safeText(100).refine((v) => v.length >= 2, { message: 'Name is required' }),
  email: z.string().email('Invalid email').max(255).transform((v) => v.trim().toLowerCase()),
  subject: safeText(200).optional().or(z.literal('')),
  message: safeText(5000).refine((v) => v.length >= 10, { message: 'Message must be at least 10 characters' })
});

// ── Browse / filter schema ──────────────────────────────────────────────

const browseSchema = z.object({
  category: z.string().max(50).optional(),
  subcategory: z.string().max(50).optional(),
  city: z.string().max(100).optional(),
  condition: z.string().max(20).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  q: z.string().max(200).optional(),
  sort: z.enum(['newest', 'oldest', 'price_asc', 'price_desc', 'popular']).optional(),
  cursor: z.string().max(100).optional()
});

// ── Validation helper ───────────────────────────────────────────────────

/**
 * Validate input against a Zod schema.
 * Returns { success: true, data } or { success: false, errors }
 */
function validate(schema, input) {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message
  }));
  return { success: false, errors, firstError: errors[0]?.message || 'Validation failed' };
}

/**
 * Express middleware factory: validates req.body (or req.query) against schema.
 * On failure, responds with 400 (JSON for API, redirect/render for web).
 */
function validateBody(schema, options = {}) {
  const { source = 'body', redirectTo } = options;
  return (req, res, next) => {
    const input = source === 'query' ? req.query : req.body;
    const result = validate(schema, input);
    if (result.success) {
      req.validated = result.data;
      return next();
    }
    if (req.path.startsWith('/api/') || req.accepts('json')) {
      return res.status(400).json({ error: result.firstError, errors: result.errors });
    }
    if (redirectTo) {
      return res.redirect(`${redirectTo}?error=${encodeURIComponent(result.firstError)}`);
    }
    return res.status(400).render('error', {
      title: 'Validation Error',
      message: result.firstError
    });
  };
}

module.exports = {
  // Schemas
  registerSchema,
  loginSchema,
  createListingSchema,
  buySchema,
  cartCheckoutSchema,
  reviewSchema,
  contactSchema,
  browseSchema,

  // Helpers
  validate,
  validateBody,

  // Re-export zod for custom schemas
  z
};
