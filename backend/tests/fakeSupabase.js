'use strict';

const crypto = require('node:crypto');

/**
 * A tiny in-memory stand-in for the supabase-js query builder, enough for the API tests.
 * It supports the calls the services make (select/insert/update/delete, eq/neq/is/gt/lt,
 * order, limit, single/maybeSingle, rpc) and, like PostgREST, only returns the columns
 * that were selected, so tests catch accidental leaks such as password_hash.
 */
const DEFAULTS = {
  users: () => ({
    id: crypto.randomUUID(),
    phone: null,
    avatar_url: null,
    role: 'CASHIER',
    email_verified: false,
    is_active: true,
    token_version: 0,
    last_login_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  categories: () => ({ id: crypto.randomUUID(), description: null, color: '#6574e8', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  products: () => ({
    id: crypto.randomUUID(),
    cost_price: 0,
    current_stock: 0,
    minimum_stock: 0,
    image_url: null,
    image_public_id: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  otp_codes: () => ({ id: crypto.randomUUID(), attempts: 0, consumed_at: null, created_at: new Date().toISOString() }),
};

const UNIQUE = { users: ['email'], products: ['sku'] };

/** Mirrors the generated stock_status column of the products table. */
const derive = (table, row) => {
  if (table === 'products') {
    row.stock_status = !row.is_active ? 'INACTIVE' : row.current_stock === 0 ? 'OUT_OF_STOCK' : row.current_stock <= row.minimum_stock ? 'LOW_STOCK' : 'IN_STOCK';
  }
  return row;
};

const tables = {};
const rpcHandlers = {};
const fail = (code, message) => ({ __error: { code, message } });
const reset = () => {
  for (const k of Object.keys(tables)) delete tables[k];
  resetCounters();
};
const rows = (name) => (tables[name] ||= []);

const likeFilter = (col, pattern) => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^' + escaped.replace(/[*%]/g, '.*') + '$', 'i');
  return (r) => re.test(String(r[col] ?? ''));
};

class Query {
  constructor(table) {
    this.table = table;
    this.op = 'select';
    this.filters = [];
    this.columns = null;
    this.sort = null;
    this.max = null;
    this.shape = 'many';
    this.returning = false;
  }

  select(columns = '*', opts = {}) {
    this.opts = opts;
    if (this.op === 'select') this.columns = columns;
    else {
      this.returning = true;
      this.columns = columns;
    }
    return this;
  }
  insert(values) { this.op = 'insert'; this.values = values; return this; }
  update(values) { this.op = 'update'; this.values = values; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
  neq(c, v) { this.filters.push((r) => r[c] !== v); return this; }
  is(c, v) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  in(c, list) { this.filters.push((r) => list.includes(r[c])); return this; }
  ilike(c, pattern) { this.filters.push(likeFilter(c, pattern)); return this; }
  or(expr) {
    const parts = expr.split(',').map((p) => {
      const [col, op, ...rest] = p.split('.');
      if (op !== 'ilike') throw new Error('fake or(): only ilike supported');
      return likeFilter(col, rest.join('.'));
    });
    this.filters.push((r) => parts.some((f) => f(r)));
    return this;
  }
  range(from, to) { this.rangeFrom = from; this.rangeTo = to; return this; }
  gte(c, v) { this.filters.push((r) => r[c] >= v); return this; }
  lte(c, v) { this.filters.push((r) => r[c] <= v); return this; }
  gt(c, v) { this.filters.push((r) => r[c] > v); return this; }
  order(c, { ascending = true } = {}) { this.sort = { c, ascending }; return this; }
  limit(n) { this.max = n; return this; }
  single() { this.shape = 'single'; return this; }
  maybeSingle() { this.shape = 'maybe'; return this; }

  project(row) {
    if (!this.columns || this.columns === '*') return { ...row };
    return Object.fromEntries(this.columns.split(',').map((c) => c.trim()).map((c) => [c, row[c]]));
  }

  execute() {
    const table = rows(this.table);
    let affected;
    if (this.op === 'insert') {
      const list = Array.isArray(this.values) ? this.values : [this.values];
      affected = [];
      for (const value of list) {
        for (const col of UNIQUE[this.table] || []) {
          if (table.some((r) => r[col] === value[col])) return { data: null, error: { code: '23505', message: 'duplicate key' } };
        }
        const row = { ...(DEFAULTS[this.table]?.() || { id: crypto.randomUUID() }), ...value };
        table.push(derive(this.table, row));
        affected.push(row);
      }
    } else {
      const matching = table.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === 'update') {
        matching.forEach((r) => derive(this.table, Object.assign(r, this.values, { updated_at: new Date().toISOString() })));
        affected = matching;
      } else if (this.op === 'delete') {
        affected = matching;
        tables[this.table] = table.filter((r) => !matching.includes(r));
      } else {
        affected = matching;
      }
    }

    if (this.sort) {
      const { c, ascending } = this.sort;
      affected = [...affected].sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (ascending ? 1 : -1));
    }
    const total = affected.length;
    if (this.rangeFrom != null) affected = affected.slice(this.rangeFrom, this.rangeTo + 1);
    if (this.max != null) affected = affected.slice(0, this.max);
    if (this.opts?.head) return { data: null, count: total, error: null };

    if (this.op !== 'select' && !this.returning) return { data: null, error: null };
    const out = affected.map((r) => this.project(r));
    if (this.shape === 'many') return { data: out, count: total, error: null };
    if (out.length > 1 && this.shape === 'single') return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } };
    if (out.length === 0) {
      return this.shape === 'single' ? { data: null, error: { code: 'PGRST116', message: 'no rows' } } : { data: null, error: null };
    }
    return { data: out[0], error: null };
  }

  then(resolve, reject) {
    return Promise.resolve().then(() => this.execute()).then(resolve, reject);
  }
}

const client = {
  from: (table) => new Query(table),
  rpc: async (name, args) => {
    if (rpcHandlers[name]) {
      const out = rpcHandlers[name](args);
      return out && out.__error ? { data: null, error: out.__error } : { data: out, error: null };
    }
    return { data: null, error: { code: '42883', message: `function ${name} not mocked` } };
  },
};

rpcHandlers.increment_otp_attempts = ({ p_otp_id }) => {
  const otp = rows('otp_codes').find((r) => r.id === p_otp_id);
  if (otp) otp.attempts += 1;
  return null;
};

rpcHandlers.add_stock_atomic = ({ p_product_id, p_quantity, p_note, p_user }) => {
  const product = rows('products').find((r) => r.id === p_product_id);
  if (!product) return fail('P0002', 'Product not found');
  const previous = product.current_stock;
  derive('products', Object.assign(product, { current_stock: previous + p_quantity }));
  rows('inventory_transactions').push({ id: crypto.randomUUID(), product_id: p_product_id, transaction_type: 'STOCK_ADDED', quantity_change: p_quantity, previous_quantity: previous, new_quantity: previous + p_quantity, note: p_note, performed_by: p_user, created_at: new Date().toISOString() });
  return { productId: p_product_id, previousQuantity: previous, newQuantity: previous + p_quantity };
};

rpcHandlers.adjust_stock_atomic = ({ p_product_id, p_change, p_reason, p_user }) => {
  const product = rows('products').find((r) => r.id === p_product_id);
  if (!product) return fail('P0002', 'Product not found');
  if (!p_reason || !p_reason.trim()) return fail('P0001', 'A reason is required for stock adjustments');
  const previous = product.current_stock;
  if (previous + p_change < 0) return fail('P0001', `Stock cannot go below zero (current stock: ${previous})`);
  derive('products', Object.assign(product, { current_stock: previous + p_change }));
  rows('inventory_transactions').push({ id: crypto.randomUUID(), product_id: p_product_id, transaction_type: 'ADJUSTMENT', quantity_change: p_change, previous_quantity: previous, new_quantity: previous + p_change, reason: p_reason, performed_by: p_user, created_at: new Date().toISOString() });
  return { productId: p_product_id, previousQuantity: previous, newQuantity: previous + p_change };
};

// ---- Fakes of the SQL sale/return functions (the real ones are exercised against Postgres separately) ----
let saleSeq = 1033;
let returnSeq = 1001;
const now = () => new Date().toISOString();
const aggregate = (items) => {
  const m = new Map();
  for (const it of items) m.set(it.productId, (m.get(it.productId) || 0) + Number(it.quantity));
  return [...m.entries()].map(([productId, qty]) => ({ productId, qty }));
};
const stockTx = (product, change, type, user, extra = {}) =>
  rows('inventory_transactions').push({ id: crypto.randomUUID(), product_id: product.id, transaction_type: type, quantity_change: change, previous_quantity: product.current_stock - change, new_quantity: product.current_stock, performed_by: user, created_at: now(), ...extra });

rpcHandlers.create_sale_atomic = ({ p_items, p_customer, p_payment, p_status, p_user }) => {
  if (!p_items.length) return fail('P0001', 'At least one item is required');
  const lines = aggregate(p_items);
  const checked = [];
  for (const { productId, qty } of lines) {
    const product = rows('products').find((r) => r.id === productId);
    if (!product || !product.is_active) return fail('P0001', 'Product not found or inactive');
    if (product.current_stock < qty) return fail('P0001', `Insufficient stock for ${product.name} (available: ${product.current_stock})`);
    checked.push({ product, qty });
  }
  const sale = { id: crypto.randomUUID(), sale_number: `SALE-${saleSeq++}`, customer_name: p_customer || 'Walk-in Customer', payment_method: p_payment, status: p_status, total_amount: 0, item_count: 0, refunded_total: 0, return_status: null, processed_by: p_user, completed_at: p_status === 'COMPLETED' ? now() : null, created_at: now() };
  for (const { product, qty } of checked) {
    const subtotal = Number(product.selling_price) * qty;
    rows('sale_items').push({ id: crypto.randomUUID(), sale_id: sale.id, product_id: product.id, product_name: product.name, sku: product.sku, quantity: qty, unit_price: product.selling_price, unit_cost: product.cost_price, subtotal });
    sale.total_amount += subtotal;
    sale.item_count += qty;
    if (p_status === 'COMPLETED') {
      derive('products', Object.assign(product, { current_stock: product.current_stock - qty }));
      stockTx(product, -qty, 'SALE_DEDUCTION', p_user, { note: sale.sale_number, related_sale_id: sale.id });
    }
  }
  rows('sales').push(sale);
  return { id: sale.id, saleNumber: sale.sale_number, status: p_status };
};

rpcHandlers.complete_sale_atomic = ({ p_sale_id, p_user }) => {
  const sale = rows('sales').find((r) => r.id === p_sale_id);
  if (!sale) return fail('P0002', 'Sale not found');
  if (sale.status !== 'PENDING') return fail('P0001', 'Only pending sales can be completed');
  const lines = rows('sale_items').filter((i) => i.sale_id === p_sale_id);
  for (const l of lines) {
    const product = rows('products').find((r) => r.id === l.product_id);
    if (product.current_stock < l.quantity) return fail('P0001', `Insufficient stock for ${product.name} (available: ${product.current_stock})`);
  }
  for (const l of lines) {
    const product = rows('products').find((r) => r.id === l.product_id);
    derive('products', Object.assign(product, { current_stock: product.current_stock - l.quantity }));
    stockTx(product, -l.quantity, 'SALE_DEDUCTION', p_user, { note: sale.sale_number, related_sale_id: sale.id });
  }
  Object.assign(sale, { status: 'COMPLETED', completed_at: now() });
  return { id: sale.id, status: 'COMPLETED' };
};

rpcHandlers.cancel_sale_atomic = ({ p_sale_id }) => {
  const sale = rows('sales').find((r) => r.id === p_sale_id);
  if (!sale) return fail('P0002', 'Sale not found');
  if (sale.status !== 'PENDING') return fail('P0001', 'Only pending sales can be cancelled');
  sale.status = 'CANCELLED';
  return { id: sale.id, status: 'CANCELLED' };
};

rpcHandlers.create_return_atomic = ({ p_sale_id, p_reason, p_items, p_user }) => {
  const sale = rows('sales').find((r) => r.id === p_sale_id);
  if (!sale) return fail('P0002', 'Sale not found');
  if (sale.status !== 'COMPLETED') return fail('P0001', 'Only completed sales can be returned');
  const ret = { id: crypto.randomUUID(), return_number: `RET-${returnSeq++}`, sale_id: p_sale_id, reason: p_reason || 'Customer return', total_amount: 0, processed_by: p_user, created_at: now() };
  const planned = [];
  for (const { productId, qty } of aggregate(p_items)) {
    const line = rows('sale_items').find((i) => i.sale_id === p_sale_id && i.product_id === productId);
    if (!line) return fail('P0001', 'Item is not part of this sale');
    const already = rows('return_items')
      .filter((ri) => ri.product_id === productId && rows('returns').find((r) => r.id === ri.return_id)?.sale_id === p_sale_id)
      .reduce((sum, ri) => sum + ri.quantity, 0);
    if (qty > line.quantity - already) return fail('P0001', `Return quantity for ${line.product_name} exceeds the remaining returnable quantity (${line.quantity - already})`);
    planned.push({ line, qty });
  }
  for (const { line, qty } of planned) {
    const subtotal = Number(line.unit_price) * qty;
    rows('return_items').push({ id: crypto.randomUUID(), return_id: ret.id, product_id: line.product_id, product_name: line.product_name, sku: line.sku, quantity: qty, unit_price: line.unit_price, unit_cost: line.unit_cost, subtotal });
    ret.total_amount += subtotal;
    const product = rows('products').find((r) => r.id === line.product_id);
    derive('products', Object.assign(product, { current_stock: product.current_stock + qty }));
    stockTx(product, qty, 'RETURN', p_user, { note: `${sale.sale_number} - ${ret.return_number}`, related_sale_id: sale.id, related_return_id: ret.id });
  }
  rows('returns').push(ret);
  sale.refunded_total += ret.total_amount;
  const allBack = rows('sale_items').filter((i) => i.sale_id === p_sale_id).every((i) => {
    const done = rows('return_items').filter((ri) => ri.product_id === i.product_id && rows('returns').find((r) => r.id === ri.return_id)?.sale_id === p_sale_id).reduce((sum, ri) => sum + ri.quantity, 0);
    return done >= i.quantity;
  });
  sale.return_status = allBack ? 'RETURNED' : 'PARTIALLY_RETURNED';
  return { id: ret.id, returnNumber: ret.return_number };
};

// ---- Fakes of the SQL reporting functions (the real ones are exercised against Postgres separately) ----
const netLines = () =>
  rows('sale_items').flatMap((si) => {
    const sale = rows('sales').find((x) => x.id === si.sale_id);
    if (!sale || sale.status !== 'COMPLETED') return [];
    const returned = rows('return_items')
      .filter((ri) => ri.product_id === si.product_id && rows('returns').find((r) => r.id === ri.return_id)?.sale_id === si.sale_id)
      .reduce((sum, ri) => sum + ri.quantity, 0);
    const product = rows('products').find((x) => x.id === si.product_id);
    return [{ sale_id: sale.id, created_at: sale.created_at, processed_by: sale.processed_by, product_id: si.product_id, product_name: si.product_name, sku: si.sku, category_id: product?.category_id, net_qty: si.quantity - returned, unit_price: Number(si.unit_price), unit_cost: Number(si.unit_cost) }];
  });

const bucketOf = (iso, bucket, tz) => {
  const d = new Date(new Date(iso).getTime() + tz * 60000);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (bucket === 'week') t -= ((d.getUTCDay() + 6) % 7) * 86400000;
  if (bucket === 'month') t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  if (bucket === 'year') t = Date.UTC(d.getUTCFullYear(), 0, 1);
  return new Date(t).toISOString().slice(0, 10);
};

rpcHandlers.report_sales = ({ p_from, p_to, p_bucket, p_tz, p_category, p_cashier }) => {
  const lines = netLines().filter((l) => (!p_from || l.created_at >= p_from) && (!p_to || l.created_at < p_to) && (!p_category || l.category_id === p_category) && (!p_cashier || l.processed_by === p_cashier));
  const sum = (arr, f) => arr.reduce((t, x) => t + f(x), 0);
  const group = (arr, key) => arr.reduce((m, x) => (m.get(key(x)) ? m.get(key(x)).push(x) : m.set(key(x), [x]), m), new Map());
  const positive = lines.filter((l) => l.net_qty > 0);
  return {
    totals: { revenue: sum(lines, (l) => l.net_qty * l.unit_price), cogs: sum(lines, (l) => l.net_qty * l.unit_cost), units: sum(lines, (l) => l.net_qty), orders: new Set(lines.map((l) => l.sale_id)).size },
    series: [...group(lines, (l) => bucketOf(l.created_at, p_bucket, p_tz))].map(([bucket, ls]) => ({ bucket, revenue: sum(ls, (l) => l.net_qty * l.unit_price), cost: sum(ls, (l) => l.net_qty * l.unit_cost), orders: new Set(ls.map((l) => l.sale_id)).size })).sort((a, b) => (a.bucket < b.bucket ? -1 : 1)),
    byProduct: [...group(positive, (l) => l.product_id)].map(([productId, ls]) => ({ productId, name: ls[0].product_name, sku: ls[0].sku, categoryId: ls[0].category_id, units: sum(ls, (l) => l.net_qty), revenue: sum(ls, (l) => l.net_qty * l.unit_price), cost: sum(ls, (l) => l.net_qty * l.unit_cost) })).sort((a, b) => b.revenue - a.revenue),
    byCategory: [...group(positive, (l) => l.category_id)].map(([categoryId, ls]) => ({ categoryId, revenue: sum(ls, (l) => l.net_qty * l.unit_price), units: sum(ls, (l) => l.net_qty) })).sort((a, b) => b.revenue - a.revenue),
  };
};

rpcHandlers.report_movement = ({ p_from, p_to, p_category }) => {
  const all = netLines();
  return rows('products')
    .filter((p) => p.is_active && (!p_category || p.category_id === p_category))
    .map((p) => {
      const mine = all.filter((l) => l.product_id === p.id);
      const inPeriod = mine.filter((l) => (!p_from || l.created_at >= p_from) && (!p_to || l.created_at < p_to));
      const last = mine.map((l) => l.created_at).sort().at(-1) || null;
      return { productId: p.id, sku: p.sku, name: p.name, categoryId: p.category_id, stock: p.current_stock, minStock: p.minimum_stock, units: inPeriod.reduce((t, l) => t + l.net_qty, 0), revenue: inPeriod.reduce((t, l) => t + l.net_qty * l.unit_price, 0), lastSoldAt: last };
    })
    .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name));
};

const resetCounters = () => {
  saleSeq = 1033;
  returnSeq = 1001;
};

module.exports = { client, tables, rows, reset, rpcHandlers };
