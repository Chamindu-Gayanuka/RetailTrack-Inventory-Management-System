'use strict';

const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const users = require('./userService');
const otp = require('./otpService');
const email = require('./emailService');
const { hashPassword, verifyPassword, dummyHash } = require('../utils/password');
const { signAccessToken, signResetToken, verifyToken } = require('../utils/token');

const BAD_LOGIN = 'The email or password you entered is incorrect. Please try again.';

async function login(emailAddress, password) {
  const user = await users.findByEmailWithHash(emailAddress);
  // Always run bcrypt so response time does not reveal whether the account exists.
  const matches = await verifyPassword(password, user ? user.password_hash : dummyHash);
  if (!user || !matches) throw ApiError.unauthorized(BAD_LOGIN);
  if (!user.is_active) throw ApiError.forbidden('This account has been deactivated. Contact an administrator.');

  const updated = await users.update(user.id, { last_login_at: new Date().toISOString() });
  return { token: signAccessToken(updated), user: users.toPublic(updated) };
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await users.findByIdWithHash(userId);
  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
    throw ApiError.badRequest('Your current password is incorrect.', { currentPassword: ['Your current password is incorrect.'] });
  }
  if (currentPassword === newPassword) {
    throw ApiError.badRequest('Choose a password different from your current one.', {
      newPassword: ['Choose a password different from your current one.'],
    });
  }
  // Bumping token_version signs out every other session; the caller gets a fresh token.
  const updated = await users.update(userId, {
    password_hash: await hashPassword(newPassword),
    token_version: user.token_version + 1,
  });
  return { token: signAccessToken(updated), user: users.toPublic(updated) };
}

/** Always resolves the same way so the response cannot be used to discover registered emails. */
async function requestPasswordReset(emailAddress) {
  const user = await users.findByEmail(emailAddress);
  if (!user || !user.is_active) return;
  try {
    const code = await otp.issue({ user, email: user.email, purpose: 'PASSWORD_RESET' });
    await email.sendOtp({ to: user.email, name: user.full_name, code, purpose: 'PASSWORD_RESET' });
  } catch (err) {
    if (!(err instanceof ApiError)) throw err; // cooldown (429) is swallowed on purpose
  }
}

async function verifyResetOtp(emailAddress, code) {
  const user = await users.findByEmail(emailAddress);
  if (!user || !user.is_active) throw ApiError.badRequest('The verification code is invalid or has expired. Request a new code.');
  await otp.verify({ email: user.email, purpose: 'PASSWORD_RESET', code });
  return { resetToken: signResetToken(user) };
}

async function resetPassword(resetToken, newPassword) {
  const payload = verifyToken(resetToken, 'password-reset');
  const user = await users.findByIdWithHash(payload.sub);
  if (!user || !user.is_active || user.token_version !== payload.tv) {
    throw ApiError.unauthorized('Your reset session is invalid or has expired. Start again.');
  }
  await users.update(user.id, {
    password_hash: await hashPassword(newPassword),
    token_version: user.token_version + 1,
  });
}

async function sendEmailVerification(user) {
  if (user.email_verified) throw ApiError.badRequest('Your email address is already verified.');
  const code = await otp.issue({ user, email: user.email, purpose: 'EMAIL_VERIFICATION' });
  const delivered = await email.sendOtp({ to: user.email, name: user.full_name, code, purpose: 'EMAIL_VERIFICATION' });
  if (!delivered && config.isProduction) {
    throw new ApiError(503, 'Email delivery is not available right now. Please try again later.');
  }
  return { delivered };
}

async function confirmEmailVerification(user, code) {
  if (user.email_verified) return users.toPublic(user);
  await otp.verify({ email: user.email, purpose: 'EMAIL_VERIFICATION', code });
  return users.toPublic(await users.update(user.id, { email_verified: true }));
}

module.exports = {
  login,
  changePassword,
  requestPasswordReset,
  verifyResetOtp,
  resetPassword,
  sendEmailVerification,
  confirmEmailVerification,
};
