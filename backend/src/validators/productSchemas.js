'use strict';

const { z } = require('zod');

const uuid = z.string().uuid('Invalid id.');
const money = (label) =>
  z.coerce
    .number({ error: `${label} must be a number.` })
    .min(0, `${label} cannot be negative.`)
    .max(99_999_999, `${label} is too large.`)
    .transform((v) => Math.round(v * 100) / 100);
const count = (label) =>
  z.coerce.number({ error: `${label} must be a number.` }).int(`${label} must be a whole number.`).min(0, `${label} cannot be negative.`).max(10_000_000);

const name = z.string().trim().min(2, 'Product name must contain at least 2 characters.').max(150);
const sku = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9._-]{1,39}$/, 'SKU may only contain letters, numbers, dots, dashes and underscores (2-40 characters).');
const image = z.string().max(3_000_000).nullable();
const bool = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());

exports.idParams = z.object({ id: uuid });

exports.listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: uuid.optional(),
  status: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'INACTIVE']).optional(),
  active: bool.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

exports.nextSkuQuery = z.object({ categoryId: uuid });

exports.createBody = z.object({
  name,
  sku: sku.optional(),
  categoryId: uuid,
  price: money('Selling price'),
  cost: money('Cost price').default(0),
  stock: count('Opening stock').default(0),
  minStock: count('Minimum stock').default(0),
  active: bool.default(true),
  image: image.optional(),
});

exports.updateBody = z
  .object({
    name,
    sku,
    categoryId: uuid,
    price: money('Selling price'),
    cost: money('Cost price'),
    minStock: count('Minimum stock'),
    active: bool,
    image,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update.');

exports.statusBody = z.object({ active: z.boolean() });
