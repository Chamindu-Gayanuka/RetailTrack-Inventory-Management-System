'use strict';

const config = require('../config/env');
const supabase = require('../config/supabase');
const { unwrap } = require('../utils/db');
const { hashPassword, passwordSchema } = require('../utils/password');
const users = require('./userService');

/**
 * Creates the first administrator from ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD, but only while the
 * system has no administrator at all. It never overwrites or resets an existing account, so it is
 * safe to leave the variables in place (remove ADMIN_PASSWORD after the first start if you prefer).
 */
async function bootstrapAdmin() {
  const { name, email, password } = config.admin;
  const existing = unwrap(await supabase.from('users').select('id').eq('role', 'ADMIN').limit(1));
  if (existing.length) return 'exists';

  if (!name || !email || !password) {
    console.warn('No administrator exists. Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in .env and restart.');
    return 'missing-config';
  }
  if (!passwordSchema.safeParse(password).success) {
    console.warn('ADMIN_PASSWORD must be at least 8 characters. Administrator was not created.');
    return 'weak-password';
  }
  if (await users.findByEmail(email)) {
    console.warn(`ADMIN_EMAIL (${email}) belongs to a non-admin account. Administrator was not created.`);
    return 'email-taken';
  }

  await users.create({
    full_name: name,
    email,
    role: 'ADMIN',
    password_hash: await hashPassword(password),
    email_verified: true,
  });
  console.log(`Initial administrator created: ${email}`);
  return 'created';
}

module.exports = bootstrapAdmin;
