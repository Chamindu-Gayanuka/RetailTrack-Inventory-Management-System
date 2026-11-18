'use strict';

const { z } = require('zod');

const name = z.string().trim().min(2, 'Category name must contain at least 2 characters.').max(80);
const description = z
  .string()
  .trim()
  .max(300, 'Description must be at most 300 characters.')
  .transform((v) => v || null)
  .nullable();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #6574e8.');

exports.idParams = z.object({ id: z.string().uuid('Invalid id.') });

exports.createBody = z.object({ name, description: description.optional(), color: color.optional() });

exports.updateBody = z
  .object({ name, description, color })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update.');
