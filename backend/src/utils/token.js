'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const ApiError = require('./ApiError');

const OPTIONS = { algorithms: ['HS256'] };

/** Session token. `tv` must match users.token_version, so a password change revokes it. */
const signAccessToken = (user) =>
  jwt.sign({ purpose: 'access', tv: user.token_version }, config.jwtSecret, {
    subject: user.id,
    expiresIn: config.jwtExpiresIn,
    algorithm: 'HS256',
  });

/** Short-lived proof that a reset OTP was verified. */
const signResetToken = (user) =>
  jwt.sign({ purpose: 'password-reset', tv: user.token_version }, config.jwtSecret, {
    subject: user.id,
    expiresIn: '15m',
    algorithm: 'HS256',
  });

function verifyToken(token, purpose) {
  try {
    const payload = jwt.verify(token, config.jwtSecret, OPTIONS);
    if (payload.purpose !== purpose) throw new Error('wrong purpose');
    return payload;
  } catch {
    throw ApiError.unauthorized(
      purpose === 'access'
        ? 'Your session is invalid or has expired. Please sign in again.'
        : 'Your reset session is invalid or has expired. Start again.',
    );
  }
}

module.exports = { signAccessToken, signResetToken, verifyToken };
