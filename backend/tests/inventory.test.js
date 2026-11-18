'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, fake } = require('./helpers');
const { hashPassword } = require('../src/utils/password');

let app;
let tokens;
let categoryId;

before(async () => {
  app = await startApp();
});
after(() => app.close());

beforeEach(async () => {
  fake.reset();
  const hash = await hashPassword('Password123');
  for (const [role, email] of [['ADMIN', 'admin@x.lk'], ['INVENTORY_STAFF', 'staff@x.lk'], ['CASHIER', 'cash@x.lk']]) {
    fake.rows('users').push({
      id: crypto.randomUUID(), full_name: `${role} user`, email, password_hash: hash, role, token_version: 0, is_active: true,
      email_verified: true, phone: null, avatar_url: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_login_at: null,
    });
  }
  tokens = {};
  for (const [key, email] of [['admin', 'admin@x.lk'], ['staff', 'staff@x.lk'], ['cashier', 'cash@x.lk']]) {
    tokens[key] = (await app.request('POST', '/api/auth/login', { body: { email, password: 'Password123' } })).body.data.token;
  }
  categoryId = (await app.request('POST', '/api/categories', { headers: app.auth(tokens.admin), body: { name: 'Plastic Items' } })).body.data.id;
});

const as = (who) => app.auth(tokens[who]);
const addProduct = async (name, stock, minStock, cost = 100) =>
  (await app.request('POST', '/api/products', { headers: as('admin'), body: { name, categoryId, price: 200, cost, stock, minStock } })).body.data;

test('cashiers have no access to inventory', async () => {
  assert.equal((await app.request('GET', '/api/inventory/summary', { headers: as('cashier') })).status, 403);
  assert.equal((await app.request('POST', '/api/inventory/restock', { headers: as('cashier'), body: {} })).status, 403);
  assert.equal((await app.request('GET', '/api/inventory/alerts')).status, 401);
});

test('restock adds stock, records history and validates input', async () => {
  const p = await addProduct('Water Jug', 5, 8);
  const res = await app.request('POST', '/api/inventory/restock', { headers: as('staff'), body: { productId: p.id, quantity: '20', note: 'Supplier delivery' } });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.newQuantity, 25);
  assert.equal((await app.request('GET', `/api/products/${p.id}`, { headers: as('staff') })).body.data.stock, 25);

  for (const quantity of [0, -3, 1.5, 'abc']) {
    const bad = await app.request('POST', '/api/inventory/restock', { headers: as('staff'), body: { productId: p.id, quantity } });
    assert.equal(bad.status, 400, `quantity ${quantity}`);
  }
  const missing = await app.request('POST', '/api/inventory/restock', { headers: as('staff'), body: { productId: crypto.randomUUID(), quantity: 1 } });
  assert.equal(missing.status, 404);
});

test('adjustments need a reason and can never take stock below zero', async () => {
  const p = await addProduct('Bucket', 10, 2);
  const noReason = await app.request('POST', '/api/inventory/adjustments', { headers: as('staff'), body: { productId: p.id, change: -2 } });
  assert.equal(noReason.status, 400);
  const zero = await app.request('POST', '/api/inventory/adjustments', { headers: as('staff'), body: { productId: p.id, change: 0, reason: 'none' } });
  assert.equal(zero.status, 400);

  const ok = await app.request('POST', '/api/inventory/adjustments', { headers: as('staff'), body: { productId: p.id, change: -3, reason: 'Damaged in storage' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.newQuantity, 7);

  const tooMuch = await app.request('POST', '/api/inventory/adjustments', { headers: as('admin'), body: { productId: p.id, change: -50, reason: 'Recount' } });
  assert.equal(tooMuch.status, 400);
  assert.match(tooMuch.body.message, /below zero/);
});

test('history lists movements with direction, titles and who did it', async () => {
  const p = await addProduct('Chair', 7, 12);
  await app.request('POST', '/api/inventory/restock', { headers: as('staff'), body: { productId: p.id, quantity: 5 } });
  await app.request('POST', '/api/inventory/adjustments', { headers: as('admin'), body: { productId: p.id, change: -2, reason: 'Broken' } });

  const res = await app.request('GET', '/api/inventory/transactions', { headers: as('admin') });
  assert.equal(res.status, 200);
  assert.equal(res.body.meta.total, 3);
  const byType = Object.fromEntries(res.body.data.map((t) => [t.transactionType, t]));
  assert.equal(byType.STOCK_ADDED.title.length > 0, true);
  assert.equal(byType.ADJUSTMENT.type, 'outbound');
  assert.equal(byType.ADJUSTMENT.quantity, 2);
  assert.equal(byType.ADJUSTMENT.reason, 'Broken');
  assert.equal(byType.ADJUSTMENT.performedBy, 'ADMIN user');
  assert.equal(byType.ADJUSTMENT.productName, 'Chair');

  const onlyAdj = await app.request('GET', '/api/inventory/transactions?type=ADJUSTMENT', { headers: as('admin') });
  assert.equal(onlyAdj.body.data.length, 1);
  const future = await app.request('GET', `/api/inventory/transactions?from=${encodeURIComponent(new Date(Date.now() + 86_400_000).toISOString())}`, { headers: as('admin') });
  assert.equal(future.body.data.length, 0);
  const badDate = await app.request('GET', '/api/inventory/transactions?from=yesterday-ish', { headers: as('admin') });
  assert.equal(badDate.status, 400);
});

test('alerts and summary follow the low-stock rule (stock <= minimum)', async () => {
  await addProduct('Healthy', 45, 10, 100);
  await addProduct('Out', 0, 8, 100);
  await addProduct('Low', 7, 12, 100);
  await addProduct('At minimum', 10, 10, 100);
  await addProduct('Almost empty', 2, 12, 100);

  const alerts = (await app.request('GET', '/api/inventory/alerts', { headers: as('staff') })).body.data;
  assert.deepEqual(alerts.map((a) => a.name), ['Out', 'Almost empty', 'Low', 'At minimum']);
  const by = Object.fromEntries(alerts.map((a) => [a.name, a]));
  assert.equal(by.Out.severity, 'critical');
  assert.equal(by['Almost empty'].severity, 'warning');
  assert.equal(by.Low.severity, 'attention');
  assert.equal(by.Low.suggestedRestock, 17);

  const critical = (await app.request('GET', '/api/inventory/alerts?severity=critical', { headers: as('staff') })).body.data;
  assert.deepEqual(critical.map((a) => a.name), ['Out']);

  const summary = (await app.request('GET', '/api/inventory/summary', { headers: as('staff') })).body.data;
  assert.equal(summary.activeProducts, 5);
  assert.equal(summary.totalUnits, 64);
  assert.equal(summary.stockValue, 6400);
  assert.equal(summary.outOfStockCount, 1);
  assert.equal(summary.lowStockCount, 3);
});

test('inactive products are left out of alerts and totals', async () => {
  const p = await addProduct('Retired', 0, 5);
  await app.request('PATCH', `/api/products/${p.id}/status`, { headers: as('admin'), body: { active: false } });
  assert.equal((await app.request('GET', '/api/inventory/alerts', { headers: as('admin') })).body.data.length, 0);
  assert.equal((await app.request('GET', '/api/inventory/summary', { headers: as('admin') })).body.data.activeProducts, 0);
});
