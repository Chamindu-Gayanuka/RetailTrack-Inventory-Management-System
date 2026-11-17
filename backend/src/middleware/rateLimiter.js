'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const make = (windowMinutes, max, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (req, res) => res.status(429).json({ success: false, message }),
  });

/** Broad protection for every API route. */
exports.apiLimiter = make(15, 600, 'Too many requests. Please try again later.');

/** Login, password reset and password change attempts. */
exports.authLimiter = make(15, 30, 'Too many authentication attempts. Please try again later.');

/** Anything that sends an email or checks a one-time code. */
exports.otpLimiter = make(15, 10, 'Too many verification requests. Please try again later.');
