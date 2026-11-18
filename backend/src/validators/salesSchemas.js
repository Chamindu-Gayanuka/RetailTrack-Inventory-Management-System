'use strict';

const { z } = require('zod');

const uuid = z.string().uuid('Invalid id.');
const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date.')
  .transform((v) => new Date(v).toISOString());
const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(500).default(50);

// Accepts the API value (CASH) or the label the frontend shows (Cash).
const upper = (schema) => z.preprocess((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v), schema);
const payment = upper(z.enum(['CASH', 'CARD', 'OTHER'], { error: 'Choose Cash, Card or Other.' }));

// The frontend names the quantity "qty"; both spellings are accepted.
const lineItem = z
  .object({ productId: uuid, quantity: z.coerce.number().optional(), qty: z.coerce.number().optional() })
  .transform((v, ctx) => {
    const quantity = v.quantity ?? v.qty;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
      ctx.addIssue({ code: 'custom', message: 'Quantity must be a whole number of at least 1.' });
      return z.NEVER;
    }
    return { productId: v.productId, quantity };
  });
const items = z.array(lineItem).min(1, 'Add at least one item.').max(200, 'Too many items.');

exports.idParams = z.object({ id: uuid });

exports.listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: upper(z.enum(['COMPLETED', 'PENDING', 'CANCELLED'])).optional(),
  payment: payment.optional(),
  cashierId: uuid.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  page,
  limit,
});

exports.createBody = z.object({
  customer: z.string().trim().max(120).optional(),
  payment: payment.default('CASH'),
  status: upper(z.enum(['COMPLETED', 'PENDING'], { error: 'A new sale must be Completed or Pending.' })).default('COMPLETED'),
  items,
});

exports.returnListQuery = z.object({
  saleId: uuid.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  page,
  limit,
});

exports.eligibleQuery = z.object({ search: z.string().trim().max(100).optional() });

exports.returnBody = z.object({
  saleId: uuid,
  reason: z.string().trim().max(300).optional(),
  items,
});
