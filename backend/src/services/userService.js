'use strict';

const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');
const { unwrap } = require('../utils/db');

const ROLE_LABELS = { ADMIN: 'Administrator', INVENTORY_STAFF: 'Inventory Staff', CASHIER: 'Cashier' };

const PUBLIC_COLUMNS =
  'id, full_name, email, phone, avatar_url, role, email_verified, is_active, token_version, last_login_at, created_at, updated_at';

/** Shape returned to API clients (never includes the password hash or token version). */
const toPublic = (row) => ({
  id: row.id,
  name: row.full_name,
  email: row.email,
  phone: row.phone || '',
  avatar: row.avatar_url || null,
  role: row.role,
  roleLabel: ROLE_LABELS[row.role],
  active: row.is_active,
  emailVerified: row.email_verified,
  lastActive: row.last_login_at,
  createdAt: row.created_at,
});

const findById = async (id) => unwrap(await supabase.from('users').select(PUBLIC_COLUMNS).eq('id', id).maybeSingle());

const findByEmail = async (email) =>
  unwrap(await supabase.from('users').select(PUBLIC_COLUMNS).eq('email', email).maybeSingle());

/** Includes password_hash: only for authentication code. */
const findByEmailWithHash = async (email) =>
  unwrap(await supabase.from('users').select(`${PUBLIC_COLUMNS}, password_hash`).eq('email', email).maybeSingle());

const findByIdWithHash = async (id) =>
  unwrap(await supabase.from('users').select(`${PUBLIC_COLUMNS}, password_hash`).eq('id', id).maybeSingle());

async function list({ search, role, active } = {}) {
  let query = supabase.from('users').select(PUBLIC_COLUMNS).order('created_at', { ascending: true });
  if (role) query = query.eq('role', role);
  if (active !== undefined) query = query.eq('is_active', active);
  const rows = unwrap(await query);
  if (!search) return rows;
  const term = search.toLowerCase();
  return rows.filter((row) => [row.full_name, row.email, row.phone || ''].some((v) => v.toLowerCase().includes(term)));
}

async function create(values) {
  return unwrap(await supabase.from('users').insert(values).select(PUBLIC_COLUMNS).single());
}

async function update(id, patch) {
  const row = unwrap(await supabase.from('users').update(patch).eq('id', id).select(PUBLIC_COLUMNS).maybeSingle());
  if (!row) throw ApiError.notFound('User not found.');
  return row;
}

async function countActiveAdmins() {
  const rows = unwrap(await supabase.from('users').select('id').eq('role', 'ADMIN').eq('is_active', true));
  return rows.length;
}

module.exports = {
  ROLE_LABELS,
  toPublic,
  findById,
  findByEmail,
  findByEmailWithHash,
  findByIdWithHash,
  list,
  create,
  update,
  countActiveAdmins,
};
