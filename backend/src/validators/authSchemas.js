'use strict';

const { z } = require('zod');
const { emailSchema, passwordSchema } = require('./userSchemas');

const otpSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.');

exports.loginBody = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password.').max(200) });

exports.changePasswordBody = z.object({ currentPassword: z.string().min(1, 'Enter your current password.').max(200), newPassword: passwordSchema });

exports.forgotBody = z.object({ email: emailSchema });

exports.verifyResetBody = z.object({ email: emailSchema, otp: otpSchema });

exports.resetBody = z.object({ resetToken: z.string().min(10), newPassword: passwordSchema });

exports.confirmEmailBody = z.object({ otp: otpSchema });
