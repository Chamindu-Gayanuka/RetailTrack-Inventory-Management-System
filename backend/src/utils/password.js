'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const config = require('../config/env');

// bcrypt only uses the first 72 bytes, so longer passwords are rejected rather than silently truncated.
const passwordSchema = z
  .string()
  .min(8, 'Password must contain at least 8 characters.')
  .refine((value) => Buffer.byteLength(value) <= 72, 'Password must be at most 72 bytes long.');

const hashPassword = (password) => bcrypt.hash(password, config.bcryptRounds);
const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

// Used to spend the same time on unknown accounts as on real ones.
const dummyHash = bcrypt.hashSync('retailtrack-dummy-password', config.bcryptRounds);

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
function generateTemporaryPassword(length = 12) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

module.exports = { passwordSchema, hashPassword, verifyPassword, dummyHash, generateTemporaryPassword };
