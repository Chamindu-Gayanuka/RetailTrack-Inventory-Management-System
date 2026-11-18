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

/**
 * Broad protection for every API route. The limit is per IP address, and all tills in a shop usually share one,
 * while the app reloads its lists after every action, so it is deliberately generous. Login, password and
 * one-time-code routes have their own much stricter limits below.
 */
exports.apiLimiter = make(15, 3000, 'Too many requests. Please try again later.');

/** Login, password reset and password change attempts. */
exports.authLimiter = make(15, 30, 'Too many authentication attempts. Please try again later.');

/** Anything that sends an email or checks a one-time code. */
exports.otpLimiter = make(15, 10, 'Too many verification requests. Please try again later.');
