'use strict';

const crypto = require('node:crypto');
const supabase = require('../config/supabase');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const { unwrap } = require('../utils/db');

const hashCode = (code) => crypto.createHmac('sha256', config.jwtSecret).update(String(code)).digest('hex');

const safeEqual = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const INVALID = 'The verification code is invalid or has expired. Request a new code.';

/** Creates a new 6-digit code for the user, replacing any earlier unused one. Returns the plain code. */
async function issue({ user, email, purpose }) {
  const latest = unwrap(
    await supabase
      .from('otp_codes')
      .select('id, created_at')
      .eq('email', email)
      .eq('purpose', purpose)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  if (latest) {
    const waitMs = config.otp.cooldownSeconds * 1000 - (Date.now() - new Date(latest.created_at).getTime());
    if (waitMs > 0) {
      throw new ApiError(429, `Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting another code.`);
    }
  }

  unwrap(
    await supabase
      .from('otp_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('email', email)
      .eq('purpose', purpose)
      .is('consumed_at', null),
  );

  const code = String(crypto.randomInt(100000, 1000000));
  unwrap(
    await supabase.from('otp_codes').insert({
      user_id: user.id,
      email,
      purpose,
      otp_hash: hashCode(code),
      expires_at: new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000).toISOString(),
    }),
  );
  return code;
}

/** Checks a code and, if right, consumes it so it can only be used once. */
async function verify({ email, purpose, code }) {
  const otp = unwrap(
    await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('purpose', purpose)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  if (!otp || new Date(otp.expires_at).getTime() <= Date.now()) throw ApiError.badRequest(INVALID);
  if (otp.attempts >= config.otp.maxAttempts) {
    throw ApiError.badRequest('Too many incorrect attempts. Request a new code.');
  }

  if (!safeEqual(hashCode(code), otp.otp_hash)) {
    unwrap(await supabase.rpc('increment_otp_attempts', { p_otp_id: otp.id }));
    const remaining = Math.max(0, config.otp.maxAttempts - otp.attempts - 1);
    throw ApiError.badRequest(
      remaining
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many incorrect attempts. Request a new code.',
    );
  }

  // Claim the code atomically so two concurrent requests cannot both use it.
  const claimed = unwrap(
    await supabase
      .from('otp_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', otp.id)
      .is('consumed_at', null)
      .select('id'),
  );
  if (!claimed || claimed.length === 0) throw ApiError.badRequest(INVALID);
  return otp;
}

module.exports = { issue, verify };
