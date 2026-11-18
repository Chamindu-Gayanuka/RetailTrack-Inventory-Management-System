'use strict';

const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../utils/token');
const users = require('../services/userService');

/**
 * Requires a valid Bearer token. The user is re-read from the database on every request, so
 * deactivation, role changes and password changes take effect immediately.
 * Sets `req.user` (database row without the password hash).
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized();

  const payload = verifyToken(token, 'access');
  const user = await users.findById(payload.sub);
  if (!user || user.token_version !== payload.tv) {
    throw ApiError.unauthorized('Your session is invalid or has expired. Please sign in again.');
  }
  if (!user.is_active) throw ApiError.forbidden('This account has been deactivated. Contact an administrator.');

  req.user = user;
  next();
});

/** Allows only the listed roles. Use after `authenticate`. */
const authorize =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user?.role) ? next() : next(ApiError.forbidden());

module.exports = { authenticate, authorize };
