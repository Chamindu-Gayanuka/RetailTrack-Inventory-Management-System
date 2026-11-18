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
  const accounts = [['admin', 'ADMIN'], ['staff', 'INVENTORY_STAFF'], ['cashier', 'CASHIER'], ['cashier2', 'CASHIER']];
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
  categoryId = (await app.request('POST', '/api/categories', { headers: app.auth(tokens.admin), body: { name: 'Plastic Items' } })).body.data.id;
});

const as = (who) => app.auth(tokens[who]);
const addProduct = async (name, price, stock, cost = 100) =>
  (await app.request('POST', '/api/products', { headers: as('admin'), body: { name, categoryId, price, cost, stock, minStock: 2 } })).body.data;
const stockOf = async (id) => (await app.request('GET', `/api/products/${id}`, { headers: as('admin') })).body.data.stock;
const sell = (who, body) => app.request('POST', '/api/sales', { headers: as(who), body });

test('role access: admin and cashier sell, inventory staff is read-only', async () => {
  const p = await addProduct('Bucket', 450, 10);
  const body = { items: [{ productId: p.id, qty: 1 }] };
  assert.equal((await sell('staff', body)).status, 403);
  assert.equal((await sell('cashier', body)).status, 201);
  assert.equal((await sell('admin', body)).status, 201);
  assert.equal((await app.request('GET', '/api/sales', { headers: as('staff') })).status, 200);
  assert.equal((await app.request('GET', '/api/sales')).status, 401);
});

test('a completed sale snapshots prices, deducts stock and logs it', async () => {
  const bucket = await addProduct('Bucket', 450, 10);
  const jug = await addProduct('Jug', 550, 5);
  const res = await sell('cashier', {
    customer: ' Kamal ',
    payment: 'Card',
    status: 'Completed',
    items: [{ productId: bucket.id, qty: 3 }, { productId: jug.id, quantity: 1 }, { productId: bucket.id, qty: 2 }],
  });
  assert.equal(res.status, 201);
  const sale = res.body.data;
  assert.equal(sale.saleNumber, 'SALE-1033');
  assert.equal(sale.numericId, 1033);
  assert.equal(sale.customer, 'Kamal');
  assert.equal(sale.payment, 'CARD');
  assert.equal(sale.status, 'COMPLETED');
  assert.equal(sale.statusLabel, 'Completed');
  assert.equal(sale.total, 450 * 5 + 550);
  assert.equal(sale.cashier, 'cashier person');
  assert.equal(sale.items.length, 2); // duplicate lines merged
  assert.equal(await stockOf(bucket.id), 5);
  assert.equal(await stockOf(jug.id), 4);

  // the client cannot choose the price
  const cheat = await sell('cashier', { items: [{ productId: jug.id, qty: 1, price: 1 }] });
  assert.equal(cheat.body.data.total, 550);

  // later price changes do not rewrite history
  await app.request('PATCH', `/api/products/${bucket.id}`, { headers: as('admin'), body: { price: 999 } });
  const again = await app.request('GET', `/api/sales/${sale.id}`, { headers: as('admin') });
  assert.equal(again.body.data.items.find((i) => i.productId === bucket.id).price, 450);
});

test('overselling and bad input are rejected without side effects', async () => {
  const p = await addProduct('Jug', 550, 2);
  const over = await sell('cashier', { items: [{ productId: p.id, qty: 3 }] });
  assert.equal(over.status, 400);
  assert.match(over.body.message, /Insufficient stock/);
  assert.equal(await stockOf(p.id), 2);
  assert.equal(fake.rows('sales').length, 0);

  assert.equal((await sell('cashier', { items: [] })).status, 400);
  assert.equal((await sell('cashier', { items: [{ productId: p.id, qty: 0 }] })).status, 400);
  assert.equal((await sell('cashier', { items: [{ productId: p.id, qty: 1.5 }] })).status, 400);
  assert.equal((await sell('cashier', { items: [{ productId: 'nope', qty: 1 }] })).status, 400);
  assert.equal((await sell('cashier', { status: 'Cancelled', items: [{ productId: p.id, qty: 1 }] })).status, 400);
  assert.equal((await sell('cashier', { payment: 'Bitcoin', items: [{ productId: p.id, qty: 1 }] })).status, 400);

  await app.request('PATCH', `/api/products/${p.id}/status`, { headers: as('admin'), body: { active: false } });
  assert.equal((await sell('cashier', { items: [{ productId: p.id, qty: 1 }] })).status, 400);
});

test('pending orders reserve nothing until completed; cancelling changes no stock', async () => {
  const p = await addProduct('Chair', 1250, 5);
  const pending = (await sell('cashier', { status: 'Pending', items: [{ productId: p.id, qty: 2 }] })).body.data;
  assert.equal(pending.status, 'PENDING');
  assert.equal(await stockOf(p.id), 5);

  const done = await app.request('POST', `/api/sales/${pending.id}/complete`, { headers: as('cashier') });
  assert.equal(done.status, 200);
  assert.equal(done.body.data.status, 'COMPLETED');
  assert.equal(await stockOf(p.id), 3);
  assert.equal((await app.request('POST', `/api/sales/${pending.id}/complete`, { headers: as('cashier') })).status, 400);
  assert.equal((await app.request('POST', `/api/sales/${pending.id}/cancel`, { headers: as('cashier') })).status, 400);

  const second = (await sell('cashier', { status: 'Pending', items: [{ productId: p.id, qty: 1 }] })).body.data;
  const cancelled = await app.request('POST', `/api/sales/${second.id}/cancel`, { headers: as('admin') });
  assert.equal(cancelled.body.data.status, 'CANCELLED');
  assert.equal(await stockOf(p.id), 3);

  // stock sold elsewhere meanwhile: completing must now fail
  const third = (await sell('cashier', { status: 'Pending', items: [{ productId: p.id, qty: 3 }] })).body.data;
  await sell('cashier', { items: [{ productId: p.id, qty: 1 }] });
  const fail = await app.request('POST', `/api/sales/${third.id}/complete`, { headers: as('cashier') });
  assert.equal(fail.status, 400);
  assert.match(fail.body.message, /Insufficient stock/);

  assert.equal((await app.request('POST', `/api/sales/${pending.id}/complete`, { headers: as('staff') })).status, 403);
  assert.equal((await app.request('POST', `/api/sales/${crypto.randomUUID()}/cancel`, { headers: as('admin') })).status, 404);
});

test('listing: cashiers only see their own sales, others see all; filters work', async () => {
  const p = await addProduct('Bucket', 450, 50);
  await sell('cashier', { customer: 'Nimal', items: [{ productId: p.id, qty: 1 }] });
  await sell('cashier2', { customer: 'Sunil', payment: 'Card', items: [{ productId: p.id, qty: 1 }] });
  const pending = (await sell('cashier2', { status: 'Pending', items: [{ productId: p.id, qty: 1 }] })).body.data;

  const list = async (who, qs = '') => (await app.request('GET', `/api/sales${qs}`, { headers: as(who) })).body;
  assert.equal((await list('cashier')).data.length, 1);
  assert.equal((await list('cashier2')).data.length, 2);
  assert.equal((await list('admin')).meta.total, 3);
  assert.equal((await list('staff')).data.length, 3);
  assert.equal((await list('admin', '?status=Pending')).data.length, 1);
  assert.equal((await list('admin', '?payment=card')).data.length, 1);
  assert.equal((await list('admin', '?search=nimal')).data.length, 1);
  assert.equal((await list('admin', '?search=SALE-1034')).data.length, 1);
  assert.equal((await list('admin', '?search=' + encodeURIComponent('x),is_active.eq.false,(a'))).data.length, 0);

  // someone else's sale looks like it does not exist
  assert.equal((await app.request('GET', `/api/sales/${pending.id}`, { headers: as('cashier') })).status, 404);
  assert.equal((await app.request('GET', `/api/sales/${pending.id}`, { headers: as('cashier2') })).status, 200);
  assert.equal((await app.request('POST', `/api/sales/${pending.id}/cancel`, { headers: as('cashier') })).status, 404);
});

test('returns: any role can process, quantities are capped, stock comes back', async () => {
  const p = await addProduct('Bucket', 450, 10);
  const q = await addProduct('Jug', 550, 10);
  const sale = (await sell('cashier', { customer: 'Kamal', items: [{ productId: p.id, qty: 3 }, { productId: q.id, qty: 1 }] })).body.data;
  assert.equal(await stockOf(p.id), 7);

  const part = await app.request('POST', '/api/returns', { headers: as('staff'), body: { saleId: sale.id, reason: 'Cracked', items: [{ productId: p.id, qty: 2 }] } });
  assert.equal(part.status, 201);
  assert.equal(part.body.data.returnNumber, 'RET-1001');
  assert.equal(part.body.data.saleId, 'SALE-1033');
  assert.equal(part.body.data.total, 900);
  assert.equal(part.body.data.processedBy, 'staff person');
  assert.equal(await stockOf(p.id), 9);

  let detail = (await app.request('GET', `/api/sales/${sale.id}`, { headers: as('admin') })).body.data;
  assert.equal(detail.returnStatus, 'PARTIALLY_RETURNED');
  assert.equal(detail.refundedTotal, 900);
  assert.equal(detail.returns.length, 1);
  assert.equal(detail.returns[0].saleDbId, undefined);

  const over = await app.request('POST', '/api/returns', { headers: as('cashier'), body: { saleId: sale.id, items: [{ productId: p.id, qty: 2 }] } });
  assert.equal(over.status, 400);
  assert.match(over.body.message, /remaining returnable/);

  const notInSale = await app.request('POST', '/api/returns', { headers: as('cashier'), body: { saleId: sale.id, items: [{ productId: crypto.randomUUID(), qty: 1 }] } });
  assert.equal(notInSale.status, 400);

  const rest = await app.request('POST', '/api/returns', {
    headers: as('admin'),
    body: { saleId: sale.id, items: [{ productId: p.id, qty: 1 }, { productId: q.id, qty: 1 }] },
  });
  assert.equal(rest.status, 201);
  assert.equal(rest.body.data.reason, 'Customer return');
  detail = (await app.request('GET', `/api/sales/${sale.id}`, { headers: as('admin') })).body.data;
  assert.equal(detail.returnStatus, 'RETURNED');
  assert.equal(detail.returnStatusLabel, 'Returned');
  assert.equal(detail.refundedTotal, 1900);
  assert.equal(await stockOf(q.id), 10);
});

test('only completed sales can be returned; return history and lookup respect roles', async () => {
  const p = await addProduct('Bucket', 450, 10);
  const pending = (await sell('cashier', { status: 'Pending', items: [{ productId: p.id, qty: 1 }] })).body.data;
  const bad = await app.request('POST', '/api/returns', { headers: as('cashier'), body: { saleId: pending.id, items: [{ productId: p.id, qty: 1 }] } });
  assert.equal(bad.status, 400);
  assert.match(bad.body.message, /completed/);
  assert.equal((await app.request('POST', '/api/returns', { headers: as('cashier'), body: { saleId: crypto.randomUUID(), items: [{ productId: p.id, qty: 1 }] } })).status, 404);

  const sale = (await sell('cashier2', { customer: 'Sunil', items: [{ productId: p.id, qty: 4 }] })).body.data;
  await app.request('POST', '/api/returns', { headers: as('cashier'), body: { saleId: sale.id, items: [{ productId: p.id, qty: 1 }] } });

  // lookup works for every role, and shows the remaining returnable quantity
  const eligible = await app.request('GET', '/api/returns/eligible-sales?search=sunil', { headers: as('cashier') });
  assert.equal(eligible.status, 200);
  assert.equal(eligible.body.data.length, 1);
  assert.equal(eligible.body.data[0].items[0].returnable, 3);
  assert.equal((await app.request('GET', '/api/returns/eligible-sales?search=nobody', { headers: as('cashier') })).body.data.length, 0);

  // history: cashier sees returns they processed; the cashier who made the sale does not see it
  assert.equal((await app.request('GET', '/api/returns', { headers: as('cashier') })).body.data.length, 1);
  assert.equal((await app.request('GET', '/api/returns', { headers: as('cashier2') })).body.data.length, 0);
  assert.equal((await app.request('GET', '/api/returns', { headers: as('staff') })).body.data.length, 1);
  const ret = (await app.request('GET', '/api/returns', { headers: as('admin') })).body.data[0];
  assert.equal((await app.request('GET', `/api/returns/${ret.id}`, { headers: as('cashier2') })).status, 404);
  assert.equal((await app.request('GET', `/api/returns/${ret.id}`, { headers: as('admin') })).status, 200);

  // returned goods appear in stock history
  const history = (await app.request('GET', '/api/inventory/transactions?type=RETURN', { headers: as('admin') })).body.data;
  assert.equal(history.length, 1);
  assert.equal(history[0].type, 'inbound');
  assert.match(history[0].title, /^Customer return RET-1001/);
});
