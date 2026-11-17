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

module.exports = { client, tables, rows, reset, rpcHandlers };
