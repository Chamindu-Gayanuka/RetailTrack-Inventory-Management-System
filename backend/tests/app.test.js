'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, fake } = require('./helpers');

let app;
before(async () => {
  app = await startApp();
});
after(() => app.close());

test('GET /api/health returns ok', async () => {
  const res = await app.request('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.status, 'ok');
});

test('GET /api/health/db queries the database and returns no rows', async () => {
  fake.reset();
  fake.rows('categories').push({ id: 'category-1', name: 'Drinks' });
  const res = await app.request('GET', '/api/health/db');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(Object.keys(res.body.data).sort(), ['database', 'timestamp']);
  assert.equal(res.body.data.database, 'ok');
});

test('GET /api/health/db returns 503 without error details when the database fails', async (t) => {
  t.mock.method(console, 'error', () => {});
  const from = t.mock.method(fake.client, 'from', () => ({
    select: () => ({ limit: async () => ({ data: null, error: { message: 'secret connection detail' } }) }),
  }));
  const res = await app.request('GET', '/api/health/db');
  assert.equal(from.mock.callCount(), 1);
  assert.deepEqual(from.mock.calls[0].arguments, ['categories']);
  assert.equal(res.status, 503);
  assert.deepEqual(res.body, { success: false, message: 'Database is unreachable.' });
});

test('unknown routes return a JSON 404', async () => {
  const res = await app.request('GET', '/api/nope');
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});

test('malformed JSON returns 400, not 500', async () => {
  const res = await app.request('POST', '/api/health', { body: '{bad json' });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /JSON/);
});

test('disallowed CORS origin is rejected', async () => {
  const res = await app.request('GET', '/api/health', { headers: { origin: 'https://evil.example' } });
  assert.equal(res.status, 403);
});

test('allowed CORS origin is accepted', async () => {
  const res = await app.request('GET', '/api/health', { headers: { origin: 'http://localhost:5173' } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});

test('security headers are set and x-powered-by is hidden', async () => {
  const res = await app.request('GET', '/api/health');
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.ok(res.headers.get('x-content-type-options'));
});
