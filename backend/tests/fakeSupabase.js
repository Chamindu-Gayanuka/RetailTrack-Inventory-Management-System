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
  otp_codes: () => ({ id: crypto.randomUUID(), attempts: 0, consumed_at: null, created_at: new Date().toISOString() }),
};

const UNIQUE = { users: ['email'] };

const tables = {};
const rpcHandlers = {};
const reset = () => {
  for (const k of Object.keys(tables)) delete tables[k];
};
const rows = (name) => (tables[name] ||= []);

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

  select(columns = '*') {
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
        table.push(row);
        affected.push(row);
      }
    } else {
      const matching = table.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === 'update') {
        matching.forEach((r) => Object.assign(r, this.values, { updated_at: new Date().toISOString() }));
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
    if (this.max != null) affected = affected.slice(0, this.max);

    if (this.op !== 'select' && !this.returning) return { data: null, error: null };
    const out = affected.map((r) => this.project(r));
    if (this.shape === 'many') return { data: out, error: null };
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
    if (rpcHandlers[name]) return { data: rpcHandlers[name](args), error: null };
    return { data: null, error: { code: '42883', message: `function ${name} not mocked` } };
  },
};

rpcHandlers.increment_otp_attempts = ({ p_otp_id }) => {
  const otp = rows('otp_codes').find((r) => r.id === p_otp_id);
  if (otp) otp.attempts += 1;
  return null;
};

module.exports = { client, tables, rows, reset, rpcHandlers };
