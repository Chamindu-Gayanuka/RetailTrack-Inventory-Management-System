'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, fake } = require('./helpers');
const { hashPassword } = require('../src/utils/password');
const { CONFIRM_PHRASE } = require('../src/services/backupService');

let app;
let tokens;

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
});

/** A small business: 2 categories, 2 products, a sale with a partial return, a PO and a restock. */
async function seedBusiness() {
  const cat = (name) => app.request('POST', '/api/categories', { headers: as('admin'), body: { name } }).then((r) => r.body.data.id);
  const plastic = await cat('Plastic');
  const school = await cat('School');
  const mk = (name, categoryId, price, cost, stock) =>
    app.request('POST', '/api/products', { headers: as('admin'), body: { name, categoryId, price, cost, stock, minStock: 2 } }).then((r) => r.body.data);
  const bucket = await mk('Bucket', plastic, 450, 285, 20);
  const pen = await mk('Pen', school, 60, 32, 100);
  const sale = (await app.request('POST', '/api/sales', { headers: as('cashier'), body: { customer: 'Kamal', payment: 'Card', items: [{ productId: bucket.id, qty: 4 }, { productId: pen.id, qty: 10 }] } })).body.data;
  await app.request('POST', '/api/returns', { headers: as('staff'), body: { saleId: sale.id, reason: 'Cracked', items: [{ productId: bucket.id, qty: 1 }] } });
  await app.request('POST', '/api/purchase-orders', { headers: as('staff'), body: { productId: bucket.id, quantity: 30, supplier: 'Acme' } });
  await app.request('PATCH', '/api/settings', { headers: as('admin'), body: { storeName: 'Ape Kade Stores' } });
  return { bucket, pen, sale };
}

const doImport = (who, body) => app.request('POST', '/api/backup/import', { headers: as(who), body });

test('backup is for administrators only', async () => {
  for (const who of ['staff', 'cashier']) {
    assert.equal((await app.request('GET', '/api/backup/export', { headers: as(who) })).status, 403);
    assert.equal((await doImport(who, { backup: {} })).status, 403);
  }
  assert.equal((await app.request('GET', '/api/backup/export')).status, 401);
});

test('export contains the whole business but no password data', async () => {
  await seedBusiness();
  const res = await app.request('GET', '/api/backup/export', { headers: as('admin') });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /attachment; filename="retailtrack-backup-\d{4}-\d{2}-\d{2}\.json"/);
  const doc = res.body;
  assert.equal(doc.formatVersion, 3);
  assert.deepEqual([doc.categories.length, doc.products.length, doc.sales.length, doc.returns.length, doc.purchaseOrders.length], [2, 2, 1, 1, 1]);
  assert.equal(doc.settings.storeName, 'Ape Kade Stores');
  assert.equal(doc.sales[0].items.length, 2);
  assert.equal(doc.sales[0].cashierEmail, 'cashier@x.lk');
  assert.ok(doc.inventoryTransactions.length >= 4);
  const text = JSON.stringify(doc).toLowerCase();
  for (const secret of ['password', 'hash', 'token', 'otp']) assert.equal(text.includes(secret), false, secret);
});

test('an export can be validated and restored (round trip) with consistent totals', async () => {
  await seedBusiness();
  const doc = (await app.request('GET', '/api/backup/export', { headers: as('admin') })).body;

  const check = await doImport('admin', { backup: doc });
  assert.equal(check.status, 200);
  assert.equal(check.body.data.applied, false);
  assert.deepEqual(check.body.data.summary, { usersToAdd: 0, categories: 2, products: 2, sales: 1, returns: 1, inventoryTransactions: doc.inventoryTransactions.length, purchaseOrders: 1 });
  assert.equal(fake.imports.length, 0); // validating changes nothing

  const done = await doImport('admin', { backup: doc, mode: 'replace', password: 'Password123', confirm: CONFIRM_PHRASE });
  assert.equal(done.status, 200);
  assert.equal(done.body.data.applied, true);
  const payload = fake.imports[0];
  assert.equal(payload.products.length, 2);
  assert.equal(payload.sales[0].total_amount, 4 * 450 + 10 * 60);
  assert.equal(payload.sales[0].item_count, 14);
  assert.equal(payload.sales[0].refunded_total, 450);
  assert.equal(payload.sales[0].return_status, 'PARTIALLY_RETURNED');
  assert.equal(payload.returns[0].total_amount, 450);
  assert.equal(payload.users.length, 0); // everyone already has an account
  // every reference points at a record in the same payload
  const ids = (rows) => new Set(rows.map((r) => r.id));
  const [products, sales, returns, userIds] = [ids(payload.products), ids(payload.sales), ids(payload.returns), new Set(fake.rows('users').map((u) => u.id))];
  assert.ok(payload.sale_items.every((i) => products.has(i.product_id) && sales.has(i.sale_id)));
  assert.ok(payload.return_items.every((i) => products.has(i.product_id) && returns.has(i.return_id)));
  assert.ok(payload.products.every((p) => ids(payload.categories).has(p.category_id)));
  assert.ok(payload.sales.every((s) => userIds.has(s.processed_by)));
  assert.equal(payload.settings.store_name, 'Ape Kade Stores');
});

test('replacing needs the confirmation phrase and the admin password', async () => {
  await seedBusiness();
  const doc = (await app.request('GET', '/api/backup/export', { headers: as('admin') })).body;
  const noPhrase = await doImport('admin', { backup: doc, mode: 'replace', password: 'Password123' });
  assert.equal(noPhrase.status, 400);
  assert.ok(noPhrase.body.errors.confirm);
  const badPassword = await doImport('admin', { backup: doc, mode: 'replace', password: 'wrong-password', confirm: CONFIRM_PHRASE });
  assert.equal(badPassword.status, 400);
  assert.ok(badPassword.body.errors.password);
  const noPassword = await doImport('admin', { backup: doc, mode: 'replace', confirm: CONFIRM_PHRASE });
  assert.equal(noPassword.status, 400);
  assert.equal(fake.imports.length, 0);
});

test('invalid backups are rejected with a clear message and nothing is applied', async () => {
  await seedBusiness();
  const good = (await app.request('GET', '/api/backup/export', { headers: as('admin') })).body;
  const clone = () => JSON.parse(JSON.stringify(good));
  const rejected = async (mutate, pattern) => {
    const doc = clone();
    mutate(doc);
    const res = await doImport('admin', { backup: doc });
    assert.equal(res.status, 400, pattern.source);
    assert.match(res.body.message, pattern);
  };

  await rejected((d) => { d.formatVersion = 99; }, /not supported/);
  await rejected((d) => { d.products[1].sku = d.products[0].sku; }, /duplicate SKU/i);
  await rejected((d) => { d.products[0].categoryId = 'ghost'; }, /unknown category/);
  await rejected((d) => { d.sales[0].items[0].productId = 'ghost'; }, /unknown product/);
  await rejected((d) => { d.returns[0].items[0].qty = 99; }, /more than was sold/);
  await rejected((d) => { d.returns[0].saleId = 'ghost'; }, /unknown sale/);
  await rejected((d) => { d.products[0].price = -5; }, /not valid/);
  await rejected((d) => { d.inventoryTransactions[0].newQuantity += 1; }, /inconsistent/);
  await rejected((d) => { d.sales.push({ ...d.sales[0], id: 'dup' }); }, /duplicate sale number/);
  assert.equal((await doImport('admin', { backup: [] })).status, 400);
  assert.equal((await doImport('admin', {})).status, 400);
  assert.equal(fake.imports.length, 0);
});

test('a frontend (browser demo) backup can be imported: labels, names and returns are converted', async () => {
  const frontend = {
    formatVersion: 2,
    settings: { storeName: 'Demo Shop', location: 'Galle', lowStockAlerts: false },
    categories: [{ id: 'plastic', name: 'Plastic Items', description: 'Buckets', color: '#6574e8' }],
    products: [
      { id: 'p1', sku: 'pl-001', name: 'Bucket', categoryId: 'plastic', price: 450, cost: 285, stock: 45, minStock: 10, active: true, image: '/products/plastic-bucket.webp' },
      { id: 'p2', sku: 'PL-002', name: 'Chair', categoryId: 'plastic', price: 1250, cost: 790, stock: 7, minStock: 12, active: true, image: 'javascript:alert(1)' },
    ],
    sales: [{ id: 'SALE-1033', customer: 'Walk-in Customer', payment: 'Cash', status: 'Completed', cashier: 'cashier person', createdAt: '2025-03-01T08:00:00Z', items: [{ productId: 'p1', name: 'Bucket', sku: 'PL-001', qty: 3, price: 450 }] }],
    returns: [{ id: 'RET-1001', saleId: 'SALE-1033', reason: 'Cracked', processedBy: 'staff person', createdAt: '2025-03-02T08:00:00Z', items: [{ productId: 'p1', name: 'Bucket', sku: 'PL-001', qty: 3, price: 450 }] }],
    purchaseOrders: [{ id: 'PO-000007', productId: 'p2', supplier: 'Acme', quantity: 10, currentStock: 7, minStock: 12, unitCost: 790, createdBy: 'admin person', createdAt: '2025-03-03T08:00:00Z' }],
    transactions: [
      { id: 'tx1', type: 'inbound', title: 'Customer return RET-1001', productId: 'p1', quantity: 3, createdAt: '2025-03-02T08:00:00Z', note: 'SALE-1033 - Cracked' },
      { id: 'tx2', type: 'outbound', title: 'Sale #SALE-1033', productId: 'p1', quantity: 3, createdAt: '2025-03-01T08:00:00Z', note: 'Sold' },
      { id: 'tx3', type: 'inbound', title: 'Old movement', productId: 'p2', quantity: 500, createdAt: '2025-02-01T08:00:00Z', note: '' },
    ],
    users: [
      { id: 'u1', name: 'Dilshan Admin', email: 'New.Admin@apekade.lk', role: 'Administrator', active: true, emailVerified: true },
      { id: 'u2', name: 'staff person', email: 'staff@x.lk', role: 'Inventory Staff', active: true },
    ],
  };
  const check = await doImport('admin', { backup: frontend });
  assert.equal(check.status, 200, JSON.stringify(check.body));
  assert.deepEqual(check.body.data.summary, { usersToAdd: 1, categories: 1, products: 2, sales: 1, returns: 1, inventoryTransactions: 2, purchaseOrders: 1 });
  assert.ok(check.body.data.warnings.some((w) => /could not be reconciled/.test(w)));
  assert.ok(check.body.data.warnings.some((w) => /without a password/.test(w)));
  assert.ok(check.body.data.warnings.some((w) => /image/.test(w)));

  await doImport('admin', { backup: frontend, mode: 'replace', password: 'Password123', confirm: CONFIRM_PHRASE });
  const p = fake.imports[0];
  assert.deepEqual(p.products.map((x) => [x.sku, x.image_url]), [['PL-001', '/products/plastic-bucket.webp'], ['PL-002', null]]);
  assert.equal(p.sales[0].payment_method, 'CASH');
  assert.equal(p.sales[0].status, 'COMPLETED');
  assert.equal(p.sales[0].return_status, 'RETURNED');
  assert.equal(p.sales[0].refunded_total, 1350);
  assert.equal(p.sale_items[0].unit_cost, 285); // cost taken from the product
  assert.equal(p.sales[0].processed_by, fake.rows('users').find((u) => u.email === 'cashier@x.lk').id); // matched by name
  assert.equal(p.returns[0].processed_by, fake.rows('users').find((u) => u.email === 'staff@x.lk').id);
  assert.equal(p.users[0].email, 'new.admin@apekade.lk');
  assert.equal(p.users[0].role, 'ADMIN');
  assert.ok(p.users[0].password_hash.length > 20 && p.users[0].password_hash !== 'Password123');
  assert.equal(p.purchase_orders[0].po_number, 'PO-000007');
  // rebuilt stock history ends at the current stock and chains correctly
  const tx = p.inventory_transactions;
  const ret = tx.find((t) => t.transaction_type === 'RETURN');
  const sold = tx.find((t) => t.transaction_type === 'SALE_DEDUCTION');
  assert.deepEqual([ret.previous_quantity, ret.new_quantity], [42, 45]);
  assert.deepEqual([sold.previous_quantity, sold.new_quantity], [45, 42]);
  assert.equal(ret.related_return_id, p.returns[0].id);
  assert.equal(sold.related_sale_id, p.sales[0].id);
  assert.equal(p.settings.store_name, 'Demo Shop');
  assert.equal(p.settings.low_stock_alerts, false);
});
