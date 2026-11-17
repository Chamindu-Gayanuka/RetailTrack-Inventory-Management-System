'use strict';

require('./helpers');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');
const { normalizeError } = require('../src/middleware/errorHandler');
const validate = require('../src/utils/validate');
const ApiError = require('../src/utils/ApiError');

test('Postgres errors map to client-safe API errors', () => {
  assert.equal(normalizeError({ code: 'P0001', message: 'Insufficient stock for Chair' }).statusCode, 400);
  assert.equal(normalizeError({ code: 'P0001', message: 'Insufficient stock for Chair' }).message, 'Insufficient stock for Chair');
  assert.equal(normalizeError({ code: '23505', message: 'duplicate key ...' }).statusCode, 409);
  assert.equal(normalizeError({ code: '23503', message: 'fk ...' }).statusCode, 409);
  assert.equal(normalizeError({ code: '23514', message: 'check ...' }).statusCode, 400);
  assert.equal(normalizeError({ code: 'PGRST116', message: 'no rows' }).statusCode, 404);
});

test('unknown errors are not exposed', () => {
  assert.equal(normalizeError(new Error('secret db detail')), null);
});

test('validate() collects field errors and stores parsed values on req.valid', () => {
  const middleware = validate({
    body: z.object({ name: z.string().min(2), qty: z.coerce.number().int().positive() }),
  });

  const bad = { body: { name: 'x', qty: 0 } };
  let error;
  middleware(bad, {}, (e) => (error = e));
  assert.ok(error instanceof ApiError);
  assert.equal(error.statusCode, 400);
  assert.ok(error.errors.name && error.errors.qty);

  const good = { body: { name: 'Chair', qty: '3' } };
  let nextArg = 'unset';
  middleware(good, {}, (e) => (nextArg = e));
  assert.equal(nextArg, undefined);
  assert.deepEqual(good.valid.body, { name: 'Chair', qty: 3 });
});
