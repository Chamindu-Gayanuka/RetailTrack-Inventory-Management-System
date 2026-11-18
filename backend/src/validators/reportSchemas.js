'use strict';

const { z } = require('zod');

const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date.')
  .transform((v) => new Date(v).toISOString());

const period = {
  // from is inclusive, to is exclusive. Send midnight-to-midnight in the shop's timezone.
  from: isoDate.optional(),
  to: isoDate.optional(),
  bucket: z.enum(['auto', 'day', 'week', 'month', 'year']).default('auto'),
  // Minutes east of UTC; decides which calendar day a sale belongs to. Sri Lanka = 330.
  tz: z.coerce.number().int().min(-840).max(840).default(330),
  categoryId: z.string().uuid('Invalid id.').optional(),
};

exports.salesQuery = z.object(period);

exports.movementQuery = z.object({
  ...period,
  movement: z.enum(['FAST', 'NORMAL', 'SLOW', 'NO_SALES']).optional(),
});

exports.inventoryQuery = z.object({
  categoryId: period.categoryId,
  status: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'INACTIVE']).optional(),
  search: z.string().trim().max(100).optional(),
});

exports.dashboardQuery = z.object({ from: period.from, to: period.to, bucket: period.bucket, tz: period.tz });
