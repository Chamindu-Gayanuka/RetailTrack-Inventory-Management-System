'use strict';

const router = require('express').Router();
const validate = require('../utils/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const c = require('../controllers/authController');
const s = require('../validators/authSchemas');

router.post('/login', authLimiter, validate({ body: s.loginBody }), c.login);
router.get('/me', authenticate, c.me);
router.post('/change-password', authenticate, authLimiter, validate({ body: s.changePasswordBody }), c.changePassword);

// Password recovery (public): request code -> verify code -> set new password.
router.post('/forgot-password', otpLimiter, validate({ body: s.forgotBody }), c.forgotPassword);
router.post('/verify-reset-otp', otpLimiter, validate({ body: s.verifyResetBody }), c.verifyResetOtp);
router.post('/reset-password', authLimiter, validate({ body: s.resetBody }), c.resetPassword);

// Email verification for the signed-in user.
router.post('/email-verification/send', authenticate, otpLimiter, c.sendEmailVerification);
router.post('/email-verification/confirm', authenticate, otpLimiter, validate({ body: s.confirmEmailBody }), c.confirmEmailVerification);

module.exports = router;
