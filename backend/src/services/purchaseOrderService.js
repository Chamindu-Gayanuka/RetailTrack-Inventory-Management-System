'use strict';

const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');
const { unwrap } = require('../utils/db');
const { safeSearchTerm } = require('./productService');

const COLUMNS =
  'id, po_number, product_id, supplier, quantity, unit_cost, stock_at_creation, minimum_at_creation, status, created_by, created_at';

const STATUS_LABELS = { CREATED: 'Created' };

async function hydrate(rows) {
  const productIds = [...new Set(rows.map((r) => r.product_id))];
  const userIds = [...new Set(rows.map((r) => r.created_by))];
  const [products, users] = await Promise.all([
    productIds.length ? unwrap(await supabase.from('products').select('id, sku, name').in('id', productIds)) : [],
    userIds.length ? unwrap(await supabase.from('users').select('id, full_name').in('id', userIds)) : [],
  ]);
  const productMap = new Map(products.map((p) => [p.id, p]));
  const userMap = new Map(users.map((u) => [u.id, u.full_name]));

  return rows.map((r) => ({
    id: r.id,
    poNumber: r.po_number,
    numericId: Number(String(r.po_number).match(/\d+$/)?.[0]) || 0,
    productId: r.product_id,
    sku: productMap.get(r.product_id)?.sku || null,
    productName: productMap.get(r.product_id)?.name || null,
    supplier: r.supplier,
    quantity: r.quantity,
    currentStock: r.stock_at_creation,
    minStock: r.minimum_at_creation,
    unitCost: Number(r.unit_cost),
    totalCost: Math.round(r.quantity * Number(r.unit_cost) * 100) / 100,
    status: r.status,
    statusLabel: STATUS_LABELS[r.status],
    createdBy: userMap.get(r.created_by) || null,
    createdAt: r.created_at,
  }));
}

/** The order records the product's stock and cost at the time, so the document never changes later. */
async function create({ productId, quantity, supplier }, userId) {
  const product = unwrap(
    await supabase.from('products').select('id, cost_price, current_stock, minimum_stock').eq('id', productId).maybeSingle(),
  );
  if (!product) throw ApiError.notFound('Product not found.');

  const row = unwrap(
    await supabase
      .from('purchase_orders')
      .insert({
        product_id: productId,
        supplier: supplier || '',
        quantity,
        unit_cost: product.cost_price,
        stock_at_creation: product.current_stock,
        minimum_at_creation: product.minimum_stock,
        created_by: userId,
      })
      .select(COLUMNS)
      .single(),
  );
  return (await hydrate([row]))[0];
}

async function list({ productId, search, from, to, page, limit }) {
  let query = supabase.from('purchase_orders').select(COLUMNS, { count: 'exact' }).order('created_at', { ascending: false });
  if (productId) query = query.eq('product_id', productId);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  const term = search ? safeSearchTerm(search) : '';
  if (term) query = query.or(`po_number.ilike.*${term}*,supplier.ilike.*${term}*`);
  const start = (page - 1) * limit;
  const res = await query.range(start, start + limit - 1);
  const rows = unwrap(res);
  return { data: await hydrate(rows), total: res.count ?? rows.length };
}

async function get(id) {
  const row = unwrap(await supabase.from('purchase_orders').select(COLUMNS).eq('id', id).maybeSingle());
  if (!row) throw ApiError.notFound('Purchase order not found.');
  return (await hydrate([row]))[0];
}

module.exports = { create, list, get };
