'use strict';

const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const users = require('../services/userService');
const email = require('../services/emailService');
const { hashPassword, generateTemporaryPassword } = require('../utils/password');

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, data, ...(message && { message }) });

exports.list = asyncHandler(async (req, res) => {
  const rows = await users.list(req.valid.query);
  ok(res, rows.map(users.toPublic));
});

exports.get = asyncHandler(async (req, res) => {
  const user = await users.findById(req.valid.params.id);
  if (!user) throw ApiError.notFound('User not found.');
  ok(res, users.toPublic(user));
});

exports.create = asyncHandler(async (req, res) => {
  const { name, email: address, phone, role } = req.valid.body;
  if (await users.findByEmail(address)) throw ApiError.conflict('A user with this email already exists.');

  const temporaryPassword = generateTemporaryPassword();
  const row = await users.create({
    full_name: name,
    email: address,
    phone: phone ?? null,
    role,
    password_hash: await hashPassword(temporaryPassword),
  });

  const delivered = await email.sendWelcome({ to: address, name, temporaryPassword });
  // The temporary password is only returned when it could not be emailed, so the admin can hand it over.
  ok(res, { user: users.toPublic(row), ...(delivered ? {} : { temporaryPassword }) }, 'User account created.', 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { id } = req.valid.params;
  const patch = req.valid.body;
  const target = await users.findById(id);
  if (!target) throw ApiError.notFound('User not found.');

  if (patch.role && patch.role !== target.role) {
    if (id === req.user.id) throw ApiError.badRequest('You cannot change your own role.');
    if (target.role === 'ADMIN' && target.is_active && (await users.countActiveAdmins()) <= 1) {
      throw ApiError.badRequest('At least one active administrator is required.');
    }
  }

  const row = await users.update(id, {
    ...(patch.name !== undefined && { full_name: patch.name }),
    ...(patch.phone !== undefined && { phone: patch.phone }),
    ...(patch.role !== undefined && { role: patch.role }),
  });
  ok(res, users.toPublic(row), 'User updated.');
});

exports.setStatus = asyncHandler(async (req, res) => {
  const { id } = req.valid.params;
  const { active } = req.valid.body;
  const target = await users.findById(id);
  if (!target) throw ApiError.notFound('User not found.');

  if (!active) {
    if (id === req.user.id) throw ApiError.badRequest('You cannot deactivate your own account.');
    if (target.role === 'ADMIN' && target.is_active && (await users.countActiveAdmins()) <= 1) {
      throw ApiError.badRequest('At least one active administrator is required.');
    }
  }

  const row = await users.update(id, { is_active: active, ...(!active && { token_version: target.token_version + 1 }) });
  ok(res, users.toPublic(row), active ? 'User activated.' : 'User deactivated.');
});

// ----- Own profile (any signed-in user) -----

exports.getProfile = (req, res) => ok(res, users.toPublic(req.user));

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, email: address, phone, avatar } = req.valid.body;
  const patch = {
    ...(name !== undefined && { full_name: name }),
    ...(phone !== undefined && { phone }),
    ...(avatar !== undefined && { avatar_url: avatar }),
  };

  if (address !== undefined && address !== req.user.email) {
    const existing = await users.findByEmail(address);
    if (existing && existing.id !== req.user.id) throw ApiError.conflict('This email address is already in use.');
    patch.email = address;
    patch.email_verified = false; // must be verified again
  }

  const row = Object.keys(patch).length ? await users.update(req.user.id, patch) : req.user;
  ok(res, users.toPublic(row), 'Your profile changes were saved.');
});
