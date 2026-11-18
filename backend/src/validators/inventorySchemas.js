'use strict';

const { z } = require('zod');

const uuid = z.string().uuid('Invalid id.');
const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date.')
  .transform((v) => new Date(v).toISOString());

exports.alertsQuery = z.object({ severity: z.enum(['critical', 'warning', 'attention']).optional() });

exports.transactionsQuery = z.object({
  productId: uuid.optional(),
  type: z.enum(['STOCK_ADDED', 'SALE_DEDUCTION', 'ADJUSTMENT', 'RETURN']).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

exports.restockBody = z.object({
  productId: uuid,
  quantity: z.coerce
    .number({ error: 'Quantity must be a number.' })
    .int('Quantity must be a whole number.')
    .min(1, 'Quantity must be at least 1.')
    .max(1_000_000),
  note: z.string().trim().max(500).optional(),
});

exports.adjustBody = z.object({
  productId: uuid,
  change: z.coerce
    .number({ error: 'Adjustment must be a number.' })
    .int('Adjustment must be a whole number.')
    .refine((v) => v !== 0, 'Adjustment must not be zero.')
    .refine((v) => Math.abs(v) <= 1_000_000, 'Adjustment is too large.'),
  reason: z.string().trim().min(3, 'Give a short reason for the adjustment.').max(300),
});
