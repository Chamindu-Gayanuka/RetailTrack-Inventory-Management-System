'use strict';

const { z } = require('zod');
const { passwordSchema } = require('../utils/password');

const ROLES = ['ADMIN', 'INVENTORY_STAFF', 'CASHIER'];

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);
const nameSchema = z.string().trim().min(2, 'Name must contain at least 2 characters.').max(100);
const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .regex(/^[0-9+()\-\s]*$/, 'Phone number may only contain digits, spaces and + - ( ).')
  .transform((v) => v || null)
  .nullable();
const uuid = z.string().uuid('Invalid id.');

// An https image URL or a small base64 image (the profile page uploads a data URL).
const avatarSchema = z
  .string()
  .max(400_000, 'Profile photo is too large.')
  .refine((v) => /^https:\/\//.test(v) || /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v), 'Profile photo must be an image.')
  .nullable();

const optionalBool = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean().optional());

exports.idParams = z.object({ id: uuid });

exports.listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
  active: optionalBool,
});

exports.createBody = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional(),
  role: z.enum(ROLES).default('CASHIER'),
});

exports.updateBody = z
  .object({ name: nameSchema, phone: phoneSchema, role: z.enum(ROLES) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update.');

exports.statusBody = z.object({ active: z.boolean() });

exports.profileBody = z
  .object({ name: nameSchema, email: emailSchema, phone: phoneSchema, avatar: avatarSchema })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update.');

exports.ROLES = ROLES;
exports.emailSchema = emailSchema;
exports.passwordSchema = passwordSchema;
