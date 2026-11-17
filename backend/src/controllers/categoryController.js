'use strict';

const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { unwrap } = require('../utils/db');

const COLUMNS = 'id, name, description, color, created_at, updated_at';

const toPublic = (row, productCount = 0) => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  color: row.color,
  productCount,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, data, ...(message && { message }) });

async function assertNameFree(name, exceptId) {
  const rows = unwrap(await supabase.from('categories').select('id, name'));
  if (rows.some((r) => r.id !== exceptId && r.name.toLowerCase() === name.toLowerCase())) {
    throw ApiError.conflict('A category with this name already exists.');
  }
}

exports.list = asyncHandler(async (req, res) => {
  const categories = unwrap(await supabase.from('categories').select(COLUMNS).order('name', { ascending: true }));
  const products = unwrap(await supabase.from('products').select('category_id'));
  const counts = new Map();
  for (const p of products) counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1);
  ok(res, categories.map((c) => toPublic(c, counts.get(c.id) || 0)));
});

exports.create = asyncHandler(async (req, res) => {
  const { name, description, color } = req.valid.body;
  await assertNameFree(name);
  const row = unwrap(
    await supabase
      .from('categories')
      .insert({ name, description: description ?? null, ...(color && { color }) })
      .select(COLUMNS)
      .single(),
  );
  ok(res, toPublic(row), 'Category created.', 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { id } = req.valid.params;
  const patch = req.valid.body;
  if (patch.name) await assertNameFree(patch.name, id);
  const row = unwrap(await supabase.from('categories').update(patch).eq('id', id).select(COLUMNS).maybeSingle());
  if (!row) throw ApiError.notFound('Category not found.');
  ok(res, toPublic(row), 'Category updated.');
});

exports.remove = asyncHandler(async (req, res) => {
  const { id } = req.valid.params;
  const existing = unwrap(await supabase.from('categories').select('id').eq('id', id).maybeSingle());
  if (!existing) throw ApiError.notFound('Category not found.');
  const inUse = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('category_id', id);
  if (inUse.error) throw inUse.error;
  if (inUse.count > 0) throw ApiError.conflict('Move products to another category before deleting this one.');
  unwrap(await supabase.from('categories').delete().eq('id', id));
  ok(res, undefined, 'Category deleted.');
});
