'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, fake } = require('./helpers');
const { hashPassword } = require('../src/utils/password');
const config = require('../src/config/env');
const imageService = require('../src/services/imageService');

let app;
let tokens;
let plastic;
let school;

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

before(async () => {
  app = await startApp();
});
after(() => app.close());

beforeEach(async () => {
  fake.reset();
  const hash = await hashPassword('Password123');
  for (const [role, email] of [['ADMIN', 'admin@x.lk'], ['INVENTORY_STAFF', 'staff@x.lk'], ['CASHIER', 'cash@x.lk']]) {
    fake.rows('users').push({
      id: crypto.randomUUID(), full_name: role, email, password_hash: hash, role, token_version: 0, is_active: true,
      email_verified: true, phone: null, avatar_url: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_login_at: null,
    });
  }
  tokens = {};
  for (const [key, email] of [['admin', 'admin@x.lk'], ['staff', 'staff@x.lk'], ['cashier', 'cash@x.lk']]) {
    tokens[key] = (await app.request('POST', '/api/auth/login', { body: { email, password: 'Password123' } })).body.data.token;
  }
  plastic = (await app.request('POST', '/api/categories', { headers: app.auth(tokens.admin), body: { name: 'Plastic Items', color: '#6574e8' } })).body.data;
  school = (await app.request('POST', '/api/categories', { headers: app.auth(tokens.admin), body: { name: 'School Supplies' } })).body.data;
});

const as = (who) => app.auth(tokens[who]);
const newProduct = (over = {}) => ({ name: 'Plastic Bucket 10L', categoryId: plastic.id, price: '450', cost: '285', stock: '45', minStock: '10', ...over });

test('categories: everyone reads, only admin writes, names are unique, delete blocked while used', async () => {
  assert.equal((await app.request('GET', '/api/categories', { headers: as('cashier') })).status, 200);
  assert.equal((await app.request('POST', '/api/categories', { headers: as('staff'), body: { name: 'Nope' } })).status, 403);
  assert.equal((await app.request('POST', '/api/categories', { headers: as('admin'), body: { name: 'plastic items' } })).status, 409);
  assert.equal((await app.request('POST', '/api/categories', { headers: as('admin'), body: { name: 'X', color: 'red' } })).status, 400);

  const upd = await app.request('PATCH', `/api/categories/${school.id}`, { headers: as('admin'), body: { description: 'Books' } });
  assert.equal(upd.body.data.description, 'Books');

  await app.request('POST', '/api/products', { headers: as('staff'), body: newProduct() });
  const list = await app.request('GET', '/api/categories', { headers: as('admin') });
  assert.equal(list.body.data.find((c) => c.id === plastic.id).productCount, 1);
  assert.equal((await app.request('DELETE', `/api/categories/${plastic.id}`, { headers: as('admin') })).status, 409);
  assert.equal((await app.request('DELETE', `/api/categories/${school.id}`, { headers: as('admin') })).status, 200);
});

test('products: admin and staff create, cashier cannot; opening stock is recorded', async () => {
  assert.equal((await app.request('POST', '/api/products', { headers: as('cashier'), body: newProduct() })).status, 403);

  const res = await app.request('POST', '/api/products', { headers: as('staff'), body: newProduct() });
  assert.equal(res.status, 201);
  const p = res.body.data;
  assert.equal(p.sku, 'PL-001'); // auto-generated
  assert.equal(p.stock, 45);
  assert.equal(p.price, 450);
  assert.equal(p.cost, 285);
  assert.equal(p.categoryName, 'Plastic Items');
  assert.equal(p.stockStatus, 'IN_STOCK');
  assert.equal(fake.rows('inventory_transactions').length, 1);

  const second = await app.request('POST', '/api/products', { headers: as('admin'), body: newProduct({ name: 'Water Jug 2L' }) });
  assert.equal(second.body.data.sku, 'PL-002');

  const dup = await app.request('POST', '/api/products', { headers: as('admin'), body: newProduct({ name: 'Other', sku: 'pl-001' }) });
  assert.equal(dup.status, 409);

  const bad = await app.request('POST', '/api/products', { headers: as('admin'), body: { name: 'x', categoryId: 'nope', price: -1 } });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.errors.name && bad.body.errors.categoryId && bad.body.errors.price);

  const noCat = await app.request('POST', '/api/products', { headers: as('admin'), body: newProduct({ categoryId: crypto.randomUUID() }) });
  assert.equal(noCat.status, 400);
});

test('cashiers can view products but never see cost price', async () => {
  await app.request('POST', '/api/products', { headers: as('admin'), body: newProduct() });
  const cash = await app.request('GET', '/api/products', { headers: as('cashier') });
  assert.equal(cash.status, 200);
  assert.equal(cash.body.data[0].cost, undefined);
  assert.ok(cash.body.data[0].price);
  const staff = await app.request('GET', '/api/products', { headers: as('staff') });
  assert.equal(staff.body.data[0].cost, 285);
  assert.equal((await app.request('GET', '/api/products')).status, 401);
});

test('product list: search, filters, pagination and injection-safe search', async () => {
  for (const [name, stock, min, cat] of [['Plastic Bucket', 45, 10, plastic], ['Water Jug', 0, 8, plastic], ['Pencil Box', 4, 5, school], ['Glue Stick', 54, 20, school]]) {
    await app.request('POST', '/api/products', { headers: as('admin'), body: newProduct({ name, stock, minStock: min, categoryId: cat.id }) });
  }
  const get = async (qs) => (await app.request('GET', `/api/products${qs}`, { headers: as('admin') })).body;

  assert.equal((await get('?search=bucket')).data.length, 1);
  assert.equal((await get('?search=PL-00')).data.length, 2);
  assert.equal((await get(`?categoryId=${school.id}`)).data.length, 2);
  assert.deepEqual((await get('?status=OUT_OF_STOCK')).data.map((p) => p.name), ['Water Jug']);
  assert.deepEqual((await get('?status=LOW_STOCK')).data.map((p) => p.name), ['Pencil Box']);

  const page = await get('?limit=2&page=2');
  assert.equal(page.data.length, 2);
  assert.equal(page.meta.total, 4);
  assert.equal(page.meta.totalPages, 2);

  // filter-expression characters are neutralised rather than interpreted
  const attack = await app.request('GET', `/api/products?search=${encodeURIComponent('x*),is_active.eq.false,(name.ilike.*')}`, { headers: as('admin') });
  assert.equal(attack.status, 200);
  assert.equal(attack.body.data.length, 0);
});

test('update, deactivate, delete rules', async () => {
  const p = (await app.request('POST', '/api/products', { headers: as('admin'), body: newProduct({ stock: 0 }) })).body.data;

  const upd = await app.request('PATCH', `/api/products/${p.id}`, { headers: as('staff'), body: { price: 500, minStock: 3, stock: 9999 } });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.data.price, 500);
  assert.equal(upd.body.data.stock, 0); // stock is changed only through inventory operations

  const off = await app.request('PATCH', `/api/products/${p.id}/status`, { headers: as('staff'), body: { active: false } });
  assert.equal(off.body.data.stockStatus, 'INACTIVE');

  assert.equal((await app.request('DELETE', `/api/products/${p.id}`, { headers: as('staff') })).status, 403);
  assert.equal((await app.request('DELETE', `/api/products/${p.id}`, { headers: as('admin') })).status, 200);
  assert.equal((await app.request('GET', `/api/products/${p.id}`, { headers: as('admin') })).status, 404);

  const withHistory = (await app.request('POST', '/api/products', { headers: as('admin'), body: newProduct({ name: 'Has History' }) })).body.data;
  const del = await app.request('DELETE', `/api/products/${withHistory.id}`, { headers: as('admin') });
  assert.equal(del.status, 409);
  assert.match(del.body.message, /Deactivate/);
});

test('next-sku suggests the following code for a category', async () => {
  await app.request('POST', '/api/products', { headers: as('admin'), body: newProduct({ sku: 'PL-009' }) });
  const res = await app.request('GET', `/api/products/next-sku?categoryId=${plastic.id}`, { headers: as('staff') });
  assert.equal(res.body.data.sku, 'PL-010');
  const fresh = await app.request('GET', `/api/products/next-sku?categoryId=${school.id}`, { headers: as('staff') });
  assert.equal(fresh.body.data.sku, 'SC-001');
});

test('images: validated, stored inline without Cloudinary, uploaded and cleaned up with it', async () => {
  const bad = await app.request('POST', '/api/products', { headers: as('admin'), body: newProduct({ image: 'data:text/html;base64,PHNjcmlwdD4=' }) });
  assert.equal(bad.status, 400);
  const badUrl = await app.request('POST', '/api/products', { headers: as('admin'), body: newProduct({ image: 'http://evil.example/x.png' }) });
  assert.equal(badUrl.status, 400);

  const inline = await app.request('POST', '/api/products', { headers: as('admin'), body: newProduct({ image: PNG }) });
  assert.equal(inline.status, 201);
  assert.equal(inline.body.data.image, PNG);

  // With Cloudinary enabled (driver stubbed)
  const calls = { uploaded: 0, destroyed: [] };
  const original = { ...imageService.driver };
  imageService.driver.upload = async () => ({ secure_url: `https://res.cloudinary.com/demo/${++calls.uploaded}.png`, public_id: `retailtrack/products/${calls.uploaded}` });
  imageService.driver.destroy = async (id) => calls.destroyed.push(id);
  config.cloudinary.enabled = true;
  try {
    const created = await app.request('POST', '/api/products', { headers: as('admin'), body: newProduct({ name: 'With Cloud', image: PNG }) });
    assert.equal(created.body.data.image, 'https://res.cloudinary.com/demo/1.png');

    const same = await app.request('PATCH', `/api/products/${created.body.data.id}`, { headers: as('admin'), body: { image: created.body.data.image, name: 'Renamed' } });
    assert.equal(same.status, 200);
    assert.equal(calls.uploaded, 1); // unchanged image is not uploaded again

    const replaced = await app.request('PATCH', `/api/products/${created.body.data.id}`, { headers: as('admin'), body: { image: PNG } });
    assert.equal(replaced.body.data.image, 'https://res.cloudinary.com/demo/2.png');
    assert.deepEqual(calls.destroyed, ['retailtrack/products/1']);

    const removed = await app.request('PATCH', `/api/products/${created.body.data.id}`, { headers: as('admin'), body: { image: '' } });
    assert.equal(removed.body.data.image, '');
    assert.deepEqual(calls.destroyed, ['retailtrack/products/1', 'retailtrack/products/2']);
  } finally {
    config.cloudinary.enabled = false;
    Object.assign(imageService.driver, original);
  }
});
