'use strict';

const asyncHandler = require('../utils/asyncHandler');
const auth = require('../services/authService');
const users = require('../services/userService');

const ok = (res, data, message) => res.json({ success: true, ...(data !== undefined && { data }), ...(message && { message }) });

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.valid.body;
  ok(res, await auth.login(email, password), 'Signed in successfully.');
});

exports.me = (req, res) => ok(res, users.toPublic(req.user));

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.valid.body;
  ok(res, await auth.changePassword(req.user.id, currentPassword, newPassword), 'Your password was updated.');
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  await auth.requestPasswordReset(req.valid.body.email);
  ok(res, undefined, 'If an account exists for this email, a verification code has been sent.');
});

exports.verifyResetOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.valid.body;
  ok(res, await auth.verifyResetOtp(email, otp), 'Code verified.');
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = req.valid.body;
  await auth.resetPassword(resetToken, newPassword);
  ok(res, undefined, 'Your password was reset. You can now sign in.');
});

exports.sendEmailVerification = asyncHandler(async (req, res) => {
  await auth.sendEmailVerification(req.user);
  ok(res, undefined, 'A verification code was sent to your email address.');
});

exports.confirmEmailVerification = asyncHandler(async (req, res) => {
  ok(res, await auth.confirmEmailVerification(req.user, req.valid.body.otp), 'Your email address has been verified.');
});
