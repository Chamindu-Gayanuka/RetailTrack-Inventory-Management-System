'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, fake } = require('./helpers');
const { hashPassword } = require('../src/utils/password');
const { classifyMovement, bucketKeys, autoBucket } = require('../src/services/reportService');

let app;
let tokens;
let categories;
let products;

// Four local days in Sri Lanka time (UTC+5:30): 1-4 March 2025.
const WINDOW = `from=${encodeURIComponent('2025-02-28T18:30:00.000Z')}&to=${encodeURIComponent('2025-03-04T18:30:00.000Z')}`;

before(async () => {
  app = await startApp();
});
after(() => app.close());

const as = (who) => app.auth(tokens[who]);
const get = (who, path) => app.request('GET', path, { headers: as(who) });

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
  categories = {};
  for (const name of ['Plastic', 'School']) {
    categories[name] = (await app.request('POST', '/api/categories', { headers: as('admin'), body: { name } })).body.data.id;
  }
  products = {};
  for (const [key, name, cat, price, cost, stock] of [['A', 'Alpha', 'Plastic', 100, 60, 100], ['B', 'Bravo', 'School', 200, 150, 50], ['C', 'Charlie', 'School', 300, 100, 10]]) {
    products[key] = (await app.request('POST', '/api/products', { headers: as('admin'), body: { name, categoryId: categories[cat], price, cost, stock, minStock: 5 } })).body.data;
  }
});

const sell = async (who, items) => (await app.request('POST', '/api/sales', { headers: as(who), body: { items } })).body.data;
const moveSale = (sale, iso) => { fake.rows('sales').find((s) => s.id === sale.id).created_at = iso; };

/** sale1 (1 Mar): A x10, B x2, then 2 of A returned; sale2 (3 Mar): A x1 by another cashier. */
async function seedSales() {
  const sale1 = await sell('cashier', [{ productId: products.A.id, qty: 10 }, { productId: products.B.id, qty: 2 }]);
  const sale2 = await sell('cashier2', [{ productId: products.A.id, qty: 1 }]);
  moveSale(sale1, '2025-03-01T08:00:00.000Z');
  moveSale(sale2, '2025-03-03T08:00:00.000Z');
  await app.request('POST', '/api/returns', { headers: as('cashier'), body: { saleId: sale1.id, items: [{ productId: products.A.id, qty: 2 }] } });
  return { sale1, sale2 };
}

test('role gating: profit and sales reports are admin-only, inventory reports include staff, cashiers get none', async () => {
  for (const path of ['/api/reports/sales', '/api/reports/profit']) {
    assert.equal((await get('admin', path)).status, 200);
    assert.equal((await get('staff', path)).status, 403);
    assert.equal((await get('cashier', path)).status, 403);
  }
  for (const path of ['/api/reports/inventory', '/api/reports/movement']) {
    assert.equal((await get('staff', path)).status, 200);
    assert.equal((await get('cashier', path)).status, 403);
  }
  assert.equal((await get('admin', '/api/dashboard')).status, 200);
  assert.equal((await app.request('GET', '/api/dashboard')).status, 401);
});

test('sales report is net of returns, zero-filled and bucketed in local time', async () => {
  await seedSales();
  const res = await get('admin', `/api/reports/sales?${WINDOW}`);
  assert.equal(res.status, 200);
  const r = res.body.data;
  assert.equal(r.period.bucket, 'day');
  assert.equal(r.totals.revenue, 1300);
  assert.equal(r.totals.orders, 2);
  assert.equal(r.totals.units, 11);
  assert.equal(r.totals.averageOrderValue, 650);
  assert.deepEqual(r.series.map((s) => [s.bucket, s.revenue, s.orders]), [['2025-03-01', 1200, 1], ['2025-03-02', 0, 0], ['2025-03-03', 100, 1], ['2025-03-04', 0, 0]]);
  assert.equal(r.bestPeriod.bucket, '2025-03-01');
  assert.deepEqual(r.topProducts.map((p) => [p.name, p.units, p.revenue, p.rank]), [['Alpha', 9, 900, 1], ['Bravo', 2, 400, 2]]);
  assert.deepEqual(r.byCategory.map((c) => [c.categoryName, c.revenue]), [['Plastic', 900], ['School', 400]]);

  // sales outside the window are excluded
  const empty = (await get('admin', `/api/reports/sales?from=${encodeURIComponent('2025-04-01T00:00:00Z')}&to=${encodeURIComponent('2025-04-05T00:00:00Z')}`)).body.data;
  assert.equal(empty.totals.revenue, 0);
  assert.equal(empty.series.length, 5); // 05:30 local start spans five calendar days

  const school = (await get('admin', `/api/reports/sales?${WINDOW}&categoryId=${categories.School}`)).body.data;
  assert.equal(school.totals.revenue, 400);

  const monthly = (await get('admin', `/api/reports/sales?${WINDOW}&bucket=month`)).body.data;
  assert.deepEqual(monthly.series.map((s) => [s.bucket, s.revenue]), [['2025-03-01', 1300]]);
});

test('without from the report starts at the first sale; without to it runs until now', async () => {
  await seedSales();
  const r = (await get('admin', '/api/reports/sales')).body.data;
  assert.equal(r.totals.revenue, 1300);
  assert.equal(r.period.from.startsWith('2025-03-01'), true);
  assert.ok(Date.parse(r.period.to) > Date.parse('2025-03-04'));
  const long = (await get('admin', `/api/reports/sales?to=${encodeURIComponent('2028-01-01T00:00:00Z')}`)).body.data;
  assert.equal(long.period.bucket, 'year'); // more than two years of history
});

test('report parameters are validated', async () => {
  assert.equal((await get('admin', '/api/reports/sales?from=not-a-date')).status, 400);
  assert.equal((await get('admin', '/api/reports/sales?bucket=hour')).status, 400);
  assert.equal((await get('admin', '/api/reports/sales?categoryId=abc')).status, 400);
  const backwards = await get('admin', `/api/reports/sales?from=${encodeURIComponent('2025-03-05T00:00:00Z')}&to=${encodeURIComponent('2025-03-01T00:00:00Z')}`);
  assert.equal(backwards.status, 400);
});

test('profit report: revenue minus cost of goods sold, using the cost at time of sale', async () => {
  await seedSales();
  await app.request('PATCH', `/api/products/${products.A.id}`, { headers: as('admin'), body: { cost: 99 } }); // must not rewrite history
  const r = (await get('admin', `/api/reports/profit?${WINDOW}`)).body.data;
  assert.equal(r.totals.revenue, 1300);
  assert.equal(r.totals.cogs, 9 * 60 + 2 * 150);
  assert.equal(r.totals.grossProfit, 460);
  assert.equal(r.totals.marginPercent, 35.38);
  assert.deepEqual(r.byProduct.map((p) => [p.name, p.profit, p.marginPercent]), [['Alpha', 360, 40], ['Bravo', 100, 25]]);
  assert.equal(r.series[0].profit, 1200 - (8 * 60 + 2 * 150)); // 1 Mar: A net 8, B 2
});

test('movement report labels fast, slow and non-moving products', async () => {
  await seedSales();
  const r = (await get('staff', `/api/reports/movement?${WINDOW}`)).body.data;
  const by = Object.fromEntries(r.products.map((p) => [p.name, p]));
  assert.equal(by.Alpha.movement, 'FAST');
  assert.equal(by.Bravo.movement, 'SLOW');
  assert.equal(by.Charlie.movement, 'NO_SALES');
  assert.equal(by.Alpha.unitsSold, 9);
  assert.equal(by.Alpha.unitsPerDay, 2.25);
  assert.equal(by.Charlie.lastSoldAt, null);
  assert.deepEqual(r.summary, { fast: 1, normal: 0, slow: 1, noSales: 1 });

  const only = (await get('staff', `/api/reports/movement?${WINDOW}&movement=NO_SALES`)).body.data;
  assert.deepEqual(only.products.map((p) => p.name), ['Charlie']);
  const cat = (await get('staff', `/api/reports/movement?${WINDOW}&categoryId=${categories.School}`)).body.data;
  assert.deepEqual(cat.products.map((p) => p.name).sort(), ['Bravo', 'Charlie']);
});

test('classifyMovement: thirds by units, ties share a class, one product is fast', () => {
  const mk = (units) => units.map((u, i) => ({ productId: `p${i}`, name: `P${i}`, units: u }));
  const cls = (units) => classifyMovement(mk(units)).map((r) => r.movement);
  assert.deepEqual(cls([30, 20, 10, 5, 2, 1]), ['FAST', 'FAST', 'NORMAL', 'NORMAL', 'SLOW', 'SLOW']);
  assert.deepEqual(cls([5]), ['FAST']);
  assert.deepEqual(cls([5, 0]), ['FAST', 'NO_SALES']);
  assert.deepEqual(cls([7, 7, 7]), ['FAST', 'FAST', 'FAST']);
  assert.deepEqual(cls([0, 0]), ['NO_SALES', 'NO_SALES']);
});

test('bucket helpers: Monday weeks, local midnight, sensible automatic size', () => {
  const day = 86_400_000;
  assert.deepEqual(bucketKeys(Date.parse('2025-02-28T18:30:00Z'), Date.parse('2025-03-04T18:30:00Z'), 'day', 330), ['2025-03-01', '2025-03-02', '2025-03-03', '2025-03-04']);
  // 5 March 2025 is a Wednesday: its week starts Monday 3 March
  assert.deepEqual(bucketKeys(Date.parse('2025-03-05T06:00:00Z'), Date.parse('2025-03-12T06:00:00Z'), 'week', 0), ['2025-03-03', '2025-03-10']);
  assert.deepEqual(bucketKeys(Date.parse('2025-01-15T00:00:00Z'), Date.parse('2025-03-02T00:00:00Z'), 'month', 0), ['2025-01-01', '2025-02-01', '2025-03-01']);
  assert.equal(autoBucket(0, 7 * day), 'day');
  assert.equal(autoBucket(0, 60 * day), 'week');
  assert.equal(autoBucket(0, 365 * day), 'month');
  assert.equal(autoBucket(0, 1000 * day), 'year');
});

test('inventory report values stock at cost and retail', async () => {
  const r = (await get('staff', '/api/reports/inventory')).body.data;
  // A 100x60 + B 50x150 + C 10x100 = 6000 + 7500 + 1000
  assert.equal(r.totals.costValue, 14500);
  assert.equal(r.totals.retailValue, 100 * 100 + 50 * 200 + 10 * 300);
  assert.equal(r.totals.potentialMargin, r.totals.retailValue - 14500);
  assert.equal(r.totals.units, 160);
  assert.equal(r.products[0].name, 'Bravo'); // highest stock value first
  assert.equal((await get('staff', '/api/reports/inventory?status=LOW_STOCK')).body.data.products.length, 0);
  assert.equal((await get('staff', `/api/reports/inventory?categoryId=${categories.School}`)).body.data.products.length, 2);
  assert.equal((await get('staff', '/api/reports/inventory?search=char')).body.data.products.length, 1);
});

test('dashboard is shaped by role; cashiers see only their own sales and no cost data', async () => {
  const sale1 = await sell('cashier', [{ productId: products.A.id, qty: 5 }]);
  await sell('cashier2', [{ productId: products.B.id, qty: 1 }]);
  await app.request('POST', '/api/inventory/adjustments', { headers: as('admin'), body: { productId: products.C.id, change: -8, reason: 'Damaged' } });

  const admin = (await get('admin', '/api/dashboard')).body.data;
  assert.equal(admin.stats.periodRevenue, 700);
  assert.equal(admin.stats.periodOrders, 2);
  assert.equal(admin.stats.activeProducts, 3);
  assert.equal(admin.stats.categories, 2);
  assert.equal(admin.stats.unitsInStock, 95 + 49 + 2);
  assert.equal(admin.stats.inventoryValue, 95 * 60 + 49 * 150 + 2 * 100);
  assert.equal(admin.stats.lowStockProducts, 1);
  assert.deepEqual(admin.stockBreakdown, { inStock: 2, lowStock: 0, critical: 1, outOfStock: 0 });
  assert.equal(admin.lowStock[0].name, 'Charlie');
  assert.equal(admin.recentSales.length, 2);
  assert.ok(admin.recentTransactions.length > 0);
  assert.equal(admin.salesSeries.length, 7);

  const cashier = (await get('cashier', '/api/dashboard')).body.data;
  assert.equal(cashier.stats.periodRevenue, 500);
  assert.equal(cashier.stats.periodOrders, 1);
  assert.equal(cashier.stats.salesRecords, 1);
  assert.equal(cashier.stats.inventoryValue, undefined);
  assert.equal(cashier.recentSales.length, 1);
  assert.equal(cashier.recentSales[0].id, sale1.id);
  assert.deepEqual(cashier.recentTransactions, []);

  const staff = (await get('staff', '/api/dashboard')).body.data;
  assert.equal(staff.stats.inventoryValue, admin.stats.inventoryValue);
  assert.equal(staff.stats.periodRevenue, 700);
});
