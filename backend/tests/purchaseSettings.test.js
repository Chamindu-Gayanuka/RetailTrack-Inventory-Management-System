'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, fake } = require('./helpers');
const { hashPassword } = require('../src/utils/password');

let app;
let tokens;
let product;

before(async () => {
  app = await startApp();
});
after(() => app.close());

const as = (who) => app.auth(tokens[who]);

beforeEach(async () => {
  fake.reset();
  const hash = await hashPassword('Password123');
  const accounts = [['admin', 'ADMIN'], ['staff', 'INVENTORY_STAFF'], ['cashier', 'CASHIER']];
  for (const [key, role] of accounts) {
    fake.rows('users').push({
      id: crypto.randomUUID(), full_name: `${key} person`, email: `${key}@x.lk`, password_hash: hash, role, token_version: 0, is_active: true,
      email_verified: true, phone: null, avatar_url: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_login_at: null,
    });
  }
  tokens = {};
  for (const [key] of accounts) {
    tokens[key] = (await app.request('POST', '/api/auth/login', { body: { email: `${key}@x.lk`, password: 'Password123' } })).body.data.token;
  }
  const categoryId = (await app.request('POST', '/api/categories', { headers: as('admin'), body: { name: 'Plastic' } })).body.data.id;
  product = (await app.request('POST', '/api/products', { headers: as('admin'), body: { name: 'Water Jug', categoryId, price: 550, cost: 340, stock: 3, minStock: 8 } })).body.data;
});

test('purchase orders: admin and inventory staff only', async () => {
  const body = { productId: product.id, quantity: 20 };
  assert.equal((await app.request('POST', '/api/purchase-orders', { headers: as('cashier'), body })).status, 403);
  assert.equal((await app.request('GET', '/api/purchase-orders', { headers: as('cashier') })).status, 403);
  assert.equal((await app.request('POST', '/api/purchase-orders', { body })).status, 401);
  assert.equal((await app.request('POST', '/api/purchase-orders', { headers: as('staff'), body })).status, 201);
});

test('a purchase order snapshots stock and cost and numbers itself PO-000001', async () => {
  const res = await app.request('POST', '/api/purchase-orders', { headers: as('staff'), body: { productId: product.id, quantity: '20', supplier: ' Acme Plastics ' } });
  assert.equal(res.status, 201);
  const po = res.body.data;
  assert.equal(po.poNumber, 'PO-000001');
  assert.equal(po.numericId, 1);
  assert.equal(po.supplier, 'Acme Plastics');
  assert.equal(po.quantity, 20);
  assert.equal(po.unitCost, 340);
  assert.equal(po.totalCost, 6800);
  assert.equal(po.currentStock, 3);
  assert.equal(po.minStock, 8);
  assert.equal(po.status, 'CREATED');
  assert.equal(po.statusLabel, 'Created');
  assert.equal(po.createdBy, 'staff person');
  assert.equal(po.productName, 'Water Jug');

  // later changes to the product do not alter the order
  await app.request('PATCH', `/api/products/${product.id}`, { headers: as('admin'), body: { cost: 999 } });
  await app.request('POST', '/api/inventory/restock', { headers: as('admin'), body: { productId: product.id, quantity: 50 } });
  const again = (await app.request('GET', `/api/purchase-orders/${po.id}`, { headers: as('admin') })).body.data;
  assert.equal(again.unitCost, 340);
  assert.equal(again.currentStock, 3);

  const second = (await app.request('POST', '/api/purchase-orders', { headers: as('admin'), body: { productId: product.id, quantity: 5 } })).body.data;
  assert.equal(second.poNumber, 'PO-000002');
  assert.equal(second.supplier, '');
  assert.equal(second.unitCost, 999);
});

test('purchase order validation and lookup', async () => {
  for (const quantity of [0, -1, 2.5, 'abc']) {
    assert.equal((await app.request('POST', '/api/purchase-orders', { headers: as('admin'), body: { productId: product.id, quantity } })).status, 400, `quantity ${quantity}`);
  }
  assert.equal((await app.request('POST', '/api/purchase-orders', { headers: as('admin'), body: { productId: crypto.randomUUID(), quantity: 1 } })).status, 404);
  assert.equal((await app.request('POST', '/api/purchase-orders', { headers: as('admin'), body: { productId: 'x', quantity: 1 } })).status, 400);
  assert.equal((await app.request('GET', `/api/purchase-orders/${crypto.randomUUID()}`, { headers: as('admin') })).status, 404);

  await app.request('POST', '/api/purchase-orders', { headers: as('admin'), body: { productId: product.id, quantity: 4, supplier: 'Lanka Traders' } });
  await app.request('POST', '/api/purchase-orders', { headers: as('admin'), body: { productId: product.id, quantity: 6, supplier: 'Acme' } });
  const all = (await app.request('GET', '/api/purchase-orders', { headers: as('staff') })).body;
  assert.equal(all.meta.total, 2);
  assert.equal((await app.request('GET', '/api/purchase-orders?search=lanka', { headers: as('staff') })).body.data.length, 1);
  assert.equal((await app.request('GET', '/api/purchase-orders?search=PO-000002', { headers: as('staff') })).body.data.length, 1);
  assert.equal((await app.request('GET', `/api/purchase-orders?productId=${product.id}&limit=1`, { headers: as('staff') })).body.data.length, 1);
});

test('a product with purchase orders cannot be deleted', async () => {
  await app.request('POST', '/api/purchase-orders', { headers: as('admin'), body: { productId: product.id, quantity: 4 } });
  const del = await app.request('DELETE', `/api/products/${product.id}`, { headers: as('admin') });
  assert.equal(del.status, 409);
});

test('public settings expose only the store name and location', async () => {
  const res = await app.request('GET', '/api/settings/public');
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body.data).sort(), ['location', 'storeName']);
  assert.equal(res.body.data.storeName, 'Ape Kade');
});

test('settings: everyone signed in reads, only admin changes, input is validated', async () => {
  assert.equal((await app.request('GET', '/api/settings')).status, 401);
  const read = await app.request('GET', '/api/settings', { headers: as('cashier') });
  assert.equal(read.status, 200);
  assert.equal(read.body.data.lowStockAlerts, true);
  assert.equal(read.body.data.currency, 'Sri Lankan Rupee (LKR)');

  assert.equal((await app.request('PATCH', '/api/settings', { headers: as('staff'), body: { storeName: 'Hacked' } })).status, 403);

  const upd = await app.request('PATCH', '/api/settings', {
    headers: as('admin'),
    body: { storeName: ' Ape Kade Stores ', location: 'Padiyathalawa', phone: '+94 55 224 6800', email: 'Hello@ApeKade.lk', emailAlerts: true },
  });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.data.storeName, 'Ape Kade Stores');
  assert.equal(upd.body.data.email, 'hello@apekade.lk');
  assert.equal(upd.body.data.emailAlerts, true);
  assert.equal(upd.body.data.weeklySummary, true); // untouched

  const pub = (await app.request('GET', '/api/settings/public')).body.data;
  assert.equal(pub.storeName, 'Ape Kade Stores');
  assert.equal(pub.location, 'Padiyathalawa');

  const cleared = await app.request('PATCH', '/api/settings', { headers: as('admin'), body: { email: '' } });
  assert.equal(cleared.body.data.email, '');

  for (const body of [{}, { storeName: '   ' }, { email: 'nope' }, { phone: 'call me' }, { lowStockAlerts: 'yes' }]) {
    assert.equal((await app.request('PATCH', '/api/settings', { headers: as('admin'), body })).status, 400, JSON.stringify(body));
  }
});
