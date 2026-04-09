'use strict';

const { z } = require('zod');

/**
 * Run a Zod schema against data and return a normalised result object.
 * @param {z.ZodTypeAny} schema
 * @param {unknown} data
 * @returns {{ success: boolean, data?: object, errors?: Array<{field:string,message:string}>, firstError?: string }}
 */
function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const issues = result.error.issues || [];
  const errors = issues.map((e) => ({
    field: e.path.join('.') || '_root',
    message: e.message,
  }));
  return { success: false, errors, firstError: errors[0]?.message };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reject strings that contain HTML tags. */
const noHtml = z.string().refine((v) => !/<[^>]+>/.test(v), { message: 'HTML is not allowed' });

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[\u0600-\u06FFa-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscores, and hyphens'),
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().email('Must be a valid email address')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  ref: z.string().optional(),
});

const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Identifier is required')
    .transform((v) => v.trim()),
  password: z.string().min(1, 'Password is required'),
});

const createListingSchema = z.object({
  title: noHtml
    .pipe(z.string().min(5, 'Title must be at least 5 characters').max(120)),
  description: z.string().min(20, 'Description must be at least 20 characters').max(5000),
  city: z.string().min(1, 'City is required').max(60),
  price: z
    .string()
    .or(z.number())
    .transform((v) => Number(v))
    .pipe(z.number().positive('Price must be greater than zero')),
  tags: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : []
    ),
  negotiable: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => {
      if (typeof v === 'boolean') return v;
      return v === 'true' || v === '1';
    }),
});

const buySchema = z.object({
  buyerName: z.string().min(2, 'Name must be at least 2 characters').max(80),
  buyerPhone: z.string().min(7, 'Phone number too short').max(20),
  buyerCity: z.string().min(1, 'City is required').max(60),
  buyerAddress: z.string().min(5, 'Address must be at least 5 characters').max(200),
  paymentMethod: z.enum(['cod', 'stripe', 'paymob', 'paypal'], {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }),
  shippingMethod: z.enum(['company', 'pickup', 'handdelivery'], {
    errorMap: () => ({ message: 'Invalid shipping method' }),
  }),
  couponCode: z.string().optional(),
});

const reviewSchema = z.object({
  rating: z
    .string()
    .or(z.number())
    .transform((v) => Number(v))
    .pipe(z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5')),
  comment: z.string().max(1000).optional(),
});

const contactSchema = z.object({
  name: z.string().min(2, 'Name is required').max(80),
  email: z.string().email('Must be a valid email address'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
});

const browseSchema = z.object({
  category: z.string().optional(),
  minPrice: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  maxPrice: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  sort: z.enum(['newest', 'oldest', 'price_asc', 'price_desc', 'popular']).optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  q: z.string().max(200).optional(),
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  createListingSchema,
  buySchema,
  reviewSchema,
  contactSchema,
  browseSchema,
};
