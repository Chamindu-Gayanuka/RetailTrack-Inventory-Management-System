'use strict';

const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');
const { unwrap, fetchAll } = require('../utils/db');
const images = require('./imageService');

const COLUMNS =
  'id, sku, name, category_id, selling_price, cost_price, current_stock, minimum_stock, image_url, is_active, stock_status, created_at, updated_at';

/** `canSeeCost` is false for cashiers: cost and profit data stay with staff and admins. */
const toPublic = (row, categoryNames, { canSeeCost }) => ({
  id: row.id,
  sku: row.sku,
  name: row.name,
  categoryId: row.category_id,
  categoryName: categoryNames.get(row.category_id) || null,
  price: Number(row.selling_price),
  ...(canSeeCost && { cost: Number(row.cost_price) }),
  stock: row.current_stock,
  minStock: row.minimum_stock,
  active: row.is_active,
  stockStatus: row.stock_status,
  image: row.image_url || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function categoryNameMap() {
  const rows = unwrap(await supabase.from('categories').select('id, name'));
  return new Map(rows.map((c) => [c.id, c.name]));
}

/** Strips characters that have meaning inside a PostgREST filter expression or LIKE pattern. */
const safeSearchTerm = (term) => term.replace(/[,()*%_\\"'`:;]/g, ' ').replace(/\s+/g, ' ').trim();

async function list({ search, categoryId, status, active, page, limit }) {
  let query = supabase.from('products').select(COLUMNS, { count: 'exact' }).order('name', { ascending: true });
  const term = search ? safeSearchTerm(search) : '';
  if (term) query = query.or(`name.ilike.*${term}*,sku.ilike.*${term}*`);
  if (categoryId) query = query.eq('category_id', categoryId);
  if (status) query = query.eq('stock_status', status);
  if (active !== undefined) query = query.eq('is_active', active);
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);

  const res = await query;
  const rows = unwrap(res);
  return { rows, total: res.count ?? rows.length };
}

async function findRow(id) {
  const row = unwrap(await supabase.from('products').select(`${COLUMNS}, image_public_id`).eq('id', id).maybeSingle());
  if (!row) throw ApiError.notFound('Product not found.');
  return row;
}

async function assertCategory(categoryId) {
  const cat = unwrap(await supabase.from('categories').select('id').eq('id', categoryId).maybeSingle());
  if (!cat) throw ApiError.badRequest('Selected category does not exist.', { categoryId: ['Selected category does not exist.'] });
}

async function assertSkuFree(sku, exceptId) {
  const rows = unwrap(await supabase.from('products').select('id').eq('sku', sku));
  if (rows.some((r) => r.id !== exceptId)) {
    throw ApiError.conflict(`SKU "${sku}" already exists in the system.`);
  }
}

/** Next code like PL-010: reuses the prefix most used in the category, else the category's first letters. */
async function nextSku(categoryId) {
  const cat = unwrap(await supabase.from('categories').select('id, name').eq('id', categoryId).maybeSingle());
  if (!cat) throw ApiError.badRequest('Selected category does not exist.');
  const inCategory = unwrap(await supabase.from('products').select('sku').eq('category_id', categoryId));

  const counts = new Map();
  for (const { sku } of inCategory) {
    const m = /^([A-Z]+)-\d+$/.exec(sku);
    if (m) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  }
  const prefix =
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
    cat.name.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase().padEnd(2, 'R');

  const all = await fetchAll(() => supabase.from('products').select('sku').order('id'));
  const taken = new Set(all.map((r) => r.sku));
  let n = all.reduce((max, { sku }) => {
    const m = new RegExp(`^${prefix}-(\\d+)$`).exec(sku);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  let candidate;
  do {
    n += 1;
    candidate = `${prefix}-${String(n).padStart(3, '0')}`;
  } while (taken.has(candidate));
  return candidate;
}

async function create(input, userId) {
  await assertCategory(input.categoryId);
  const sku = input.sku || (await nextSku(input.categoryId));
  await assertSkuFree(sku);

  const { patch: imagePatch } = await images.resolve(input.image ?? undefined);
  let row;
  try {
    row = unwrap(
      await supabase
        .from('products')
        .insert({
          sku,
          name: input.name,
          category_id: input.categoryId,
          selling_price: input.price,
          cost_price: input.cost,
          current_stock: 0,
          minimum_stock: input.minStock,
          is_active: input.active,
          ...imagePatch,
        })
        .select(`${COLUMNS}, image_public_id`)
        .single(),
    );
  } catch (err) {
    await images.discard(imagePatch.image_public_id);
    throw err;
  }

  if (input.stock > 0) {
    try {
      unwrap(await supabase.rpc('add_stock_atomic', { p_product_id: row.id, p_quantity: input.stock, p_note: 'Initial stock (product created)', p_user: userId }));
    } catch (err) {
      await supabase.from('products').delete().eq('id', row.id); // do not leave a half-created product
      await images.discard(imagePatch.image_public_id);
      throw err;
    }
  }
  return findRow(row.id);
}

async function update(id, input) {
  const existing = await findRow(id);
  if (input.categoryId) await assertCategory(input.categoryId);
  if (input.sku && input.sku !== existing.sku) await assertSkuFree(input.sku, id);

  const { patch: imagePatch, staleId } = await images.resolve(input.image, existing);
  const patch = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.sku !== undefined && { sku: input.sku }),
    ...(input.categoryId !== undefined && { category_id: input.categoryId }),
    ...(input.price !== undefined && { selling_price: input.price }),
    ...(input.cost !== undefined && { cost_price: input.cost }),
    ...(input.minStock !== undefined && { minimum_stock: input.minStock }),
    ...(input.active !== undefined && { is_active: input.active }),
    ...imagePatch,
  };

  try {
    if (Object.keys(patch).length) unwrap(await supabase.from('products').update(patch).eq('id', id));
  } catch (err) {
    await images.discard(imagePatch.image_public_id);
    throw err;
  }
  await images.discard(staleId);
  return findRow(id);
}

async function setActive(id, active) {
  await findRow(id);
  unwrap(await supabase.from('products').update({ is_active: active }).eq('id', id));
  return findRow(id);
}

async function remove(id) {
  const existing = await findRow(id);
  const used = await Promise.all(
    ['sale_items', 'inventory_transactions', 'return_items', 'purchase_orders'].map(async (table) => {
      const res = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('product_id', id);
      if (res.error) throw res.error;
      return res.count || 0;
    }),
  );
  if (used.some((n) => n > 0)) {
    throw ApiError.conflict('This product has sales or stock history. Deactivate it to preserve the audit trail.');
  }
  unwrap(await supabase.from('products').delete().eq('id', id));
  await images.discard(existing.image_public_id);
}

module.exports = { COLUMNS, toPublic, categoryNameMap, list, findRow, nextSku, create, update, setActive, remove, safeSearchTerm };
