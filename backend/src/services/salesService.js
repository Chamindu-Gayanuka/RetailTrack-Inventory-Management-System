'use strict';

const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');
const { unwrap } = require('../utils/db');
const { safeSearchTerm } = require('./productService');

const SALE_COLUMNS =
  'id, sale_number, customer_name, payment_method, status, total_amount, item_count, refunded_total, return_status, processed_by, completed_at, created_at';
const RETURN_COLUMNS = 'id, return_number, sale_id, reason, total_amount, processed_by, created_at';

const STATUS_LABELS = { COMPLETED: 'Completed', PENDING: 'Pending', CANCELLED: 'Cancelled' };
const PAYMENT_LABELS = { CASH: 'Cash', CARD: 'Card', OTHER: 'Other' };
const RETURN_LABELS = { PARTIALLY_RETURNED: 'Partially returned', RETURNED: 'Returned' };

// eslint-disable-next-line no-unused-vars
function stripInternal({ saleDbId, ...rest }) {
  return rest;
}

const numericPart = (number) => Number(String(number).match(/\d+$/)?.[0]) || 0;

const itemOut = (i) => ({
  productId: i.product_id,
  name: i.product_name,
  sku: i.sku,
  qty: i.quantity,
  price: Number(i.unit_price),
  subtotal: Number(i.subtotal),
});

async function nameMap(ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return new Map();
  const rows = unwrap(await supabase.from('users').select('id, full_name').in('id', unique));
  return new Map(rows.map((u) => [u.id, u.full_name]));
}

async function itemsBySale(saleIds) {
  const map = new Map();
  if (!saleIds.length) return map;
  const rows = unwrap(
    await supabase
      .from('sale_items')
      .select('sale_id, product_id, product_name, sku, quantity, unit_price, subtotal')
      .in('sale_id', saleIds),
  );
  for (const row of rows) (map.get(row.sale_id) || map.set(row.sale_id, []).get(row.sale_id)).push(itemOut(row));
  return map;
}

function saleOut(row, items, names) {
  return {
    id: row.id,
    saleNumber: row.sale_number,
    numericId: numericPart(row.sale_number),
    customer: row.customer_name,
    items,
    itemCount: row.item_count,
    total: Number(row.total_amount),
    payment: row.payment_method,
    paymentLabel: PAYMENT_LABELS[row.payment_method],
    status: row.status,
    statusLabel: STATUS_LABELS[row.status],
    cashier: names.get(row.processed_by) || null,
    cashierId: row.processed_by,
    refundedTotal: Number(row.refunded_total),
    returnStatus: row.return_status,
    returnStatusLabel: row.return_status ? RETURN_LABELS[row.return_status] : null,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

async function hydrateSales(rows) {
  const [items, names] = await Promise.all([itemsBySale(rows.map((r) => r.id)), nameMap(rows.map((r) => r.processed_by))]);
  return rows.map((r) => saleOut(r, items.get(r.id) || [], names));
}

/** Cashiers only ever see sales they processed themselves. */
async function listSales(filters, viewer) {
  const { search, status, payment, from, to, cashierId, page, limit } = filters;
  let query = supabase.from('sales').select(SALE_COLUMNS, { count: 'exact' }).order('created_at', { ascending: false });
  if (viewer.role === 'CASHIER') query = query.eq('processed_by', viewer.id);
  else if (cashierId) query = query.eq('processed_by', cashierId);
  if (status) query = query.eq('status', status);
  if (payment) query = query.eq('payment_method', payment);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  const term = search ? safeSearchTerm(search) : '';
  if (term) query = query.or(`sale_number.ilike.*${term}*,customer_name.ilike.*${term}*`);
  const start = (page - 1) * limit;
  const res = await query.range(start, start + limit - 1);
  const rows = unwrap(res);
  return { data: await hydrateSales(rows), total: res.count ?? rows.length };
}

async function getSaleRow(id, viewer) {
  const row = unwrap(await supabase.from('sales').select(SALE_COLUMNS).eq('id', id).maybeSingle());
  // A cashier asking for someone else's sale gets the same answer as for a missing one.
  if (!row || (viewer.role === 'CASHIER' && row.processed_by !== viewer.id)) throw ApiError.notFound('Sale not found.');
  return row;
}

async function getSale(id, viewer) {
  const row = await getSaleRow(id, viewer);
  const [sale] = await hydrateSales([row]);
  const returns = await returnsForSales([row.id]);
  return { ...sale, returns: (returns.get(row.id) || []).map(stripInternal) };
}

const normaliseItems = (items) => items.map((i) => ({ productId: i.productId, quantity: i.quantity }));

async function createSale({ customer, payment, status, items }, userId) {
  const result = unwrap(
    await supabase.rpc('create_sale_atomic', {
      p_items: normaliseItems(items),
      p_customer: customer || '',
      p_payment: payment,
      p_status: status,
      p_user: userId,
    }),
  );
  return result.id;
}

async function completeSale(id, userId) {
  unwrap(await supabase.rpc('complete_sale_atomic', { p_sale_id: id, p_user: userId }));
}

async function cancelSale(id) {
  unwrap(await supabase.rpc('cancel_sale_atomic', { p_sale_id: id }));
}

// ----- Returns -----

async function returnsForSales(saleIds) {
  const map = new Map();
  if (!saleIds.length) return map;
  const rows = unwrap(await supabase.from('returns').select(RETURN_COLUMNS).in('sale_id', saleIds).order('created_at', { ascending: false }));
  const out = await hydrateReturns(rows);
  for (const r of out) (map.get(r.saleDbId) || map.set(r.saleDbId, []).get(r.saleDbId)).push(r);
  return map;
}

async function hydrateReturns(rows) {
  if (!rows.length) return [];
  const returnIds = rows.map((r) => r.id);
  const saleIds = [...new Set(rows.map((r) => r.sale_id))];
  const [items, names, sales] = await Promise.all([
    unwrap(
      await supabase
        .from('return_items')
        .select('return_id, product_id, product_name, sku, quantity, unit_price, subtotal')
        .in('return_id', returnIds),
    ),
    nameMap(rows.map((r) => r.processed_by)),
    unwrap(await supabase.from('sales').select('id, sale_number, customer_name').in('id', saleIds)),
  ]);
  const saleMap = new Map(sales.map((s) => [s.id, s]));
  return rows.map((r) => ({
    id: r.id,
    returnNumber: r.return_number,
    numericId: numericPart(r.return_number),
    saleDbId: r.sale_id,
    saleId: saleMap.get(r.sale_id)?.sale_number || null,
    customer: saleMap.get(r.sale_id)?.customer_name || null,
    items: items.filter((i) => i.return_id === r.id).map(itemOut),
    total: Number(r.total_amount),
    reason: r.reason,
    processedBy: names.get(r.processed_by) || null,
    createdAt: r.created_at,
  }));
}


async function listReturns({ saleId, from, to, page, limit }, viewer) {
  let query = supabase.from('returns').select(RETURN_COLUMNS, { count: 'exact' }).order('created_at', { ascending: false });
  if (viewer.role === 'CASHIER') query = query.eq('processed_by', viewer.id);
  if (saleId) query = query.eq('sale_id', saleId);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  const start = (page - 1) * limit;
  const res = await query.range(start, start + limit - 1);
  const rows = unwrap(res);
  return { data: (await hydrateReturns(rows)).map(stripInternal), total: res.count ?? rows.length };
}

async function getReturn(id, viewer) {
  const row = unwrap(await supabase.from('returns').select(RETURN_COLUMNS).eq('id', id).maybeSingle());
  if (!row || (viewer.role === 'CASHIER' && row.processed_by !== viewer.id)) throw ApiError.notFound('Return not found.');
  return stripInternal((await hydrateReturns([row]))[0]);
}

async function createReturn({ saleId, reason, items }, userId) {
  const result = unwrap(
    await supabase.rpc('create_return_atomic', {
      p_sale_id: saleId,
      p_reason: reason || '',
      p_items: normaliseItems(items),
      p_user: userId,
    }),
  );
  return result.id;
}

/**
 * Completed sales that still have something left to return, with the remaining quantity per line.
 * Open to every role that can process returns, so any staff member can look up a receipt.
 */
async function eligibleSales({ search }) {
  let query = supabase
    .from('sales')
    .select('id, sale_number, customer_name, total_amount, refunded_total, return_status, created_at')
    .eq('status', 'COMPLETED')
    .order('created_at', { ascending: false })
    .limit(50);
  const term = search ? safeSearchTerm(search) : '';
  if (term) query = query.or(`sale_number.ilike.*${term}*,customer_name.ilike.*${term}*`);
  const sales = unwrap(await query).filter((s) => s.return_status !== 'RETURNED');
  if (!sales.length) return [];

  const ids = sales.map((s) => s.id);
  const [items, returned] = await Promise.all([
    itemsBySale(ids),
    unwrap(await supabase.from('returns').select('id, sale_id').in('sale_id', ids)),
  ]);
  const returnSale = new Map(returned.map((r) => [r.id, r.sale_id]));
  const returnItems = returned.length
    ? unwrap(await supabase.from('return_items').select('return_id, product_id, quantity').in('return_id', returned.map((r) => r.id)))
    : [];
  const doneBy = new Map(); // `${saleId}:${productId}` -> qty returned
  for (const ri of returnItems) {
    const key = `${returnSale.get(ri.return_id)}:${ri.product_id}`;
    doneBy.set(key, (doneBy.get(key) || 0) + ri.quantity);
  }

  return sales.map((s) => ({
    id: s.id,
    saleNumber: s.sale_number,
    customer: s.customer_name,
    total: Number(s.total_amount),
    refundedTotal: Number(s.refunded_total),
    createdAt: s.created_at,
    items: (items.get(s.id) || []).map((i) => ({ ...i, returnable: i.qty - (doneBy.get(`${s.id}:${i.productId}`) || 0) })),
  }));
}

module.exports = {
  listSales, getSale, createSale, completeSale, cancelSale,
  listReturns, getReturn, createReturn, eligibleSales,
};
