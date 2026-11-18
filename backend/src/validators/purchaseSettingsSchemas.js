'use strict';

const { z } = require('zod');

const uuid = z.string().uuid('Invalid id.');
const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date.')
  .transform((v) => new Date(v).toISOString());

exports.idParams = z.object({ id: uuid });

exports.poListQuery = z.object({
  productId: uuid.optional(),
  search: z.string().trim().max(100).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

exports.poCreateBody = z.object({
  productId: uuid,
  quantity: z.coerce
    .number({ error: 'Quantity must be a number.' })
    .int('Purchase order quantity must be a whole number.')
    .min(1, 'Purchase order quantity must be at least 1 unit.')
    .max(1_000_000),
  supplier: z.string().trim().max(120).optional(),
});

const text = (max) => z.string().trim().max(max);

exports.settingsBody = z
  .object({
    storeName: z.string().trim().min(1, 'Store name is required.').max(80),
    location: text(120),
    address: text(250),
    phone: text(30).regex(/^[0-9+()\-\s]*$/, 'Phone number may only contain digits, spaces and + - ( ).'),
    email: z.union([z.literal(''), z.string().trim().toLowerCase().email('Enter a valid email address.').max(254)]),
    currency: z.string().trim().min(1).max(60),
    lowStockAlerts: z.boolean(),
    saleNotifications: z.boolean(),
    weeklySummary: z.boolean(),
    emailAlerts: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one setting to update.');
