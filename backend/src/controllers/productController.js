'use strict';

const asyncHandler = require('../utils/asyncHandler');
const products = require('../services/productService');

const ok = (res, data, message, status = 200, meta) =>
  res.status(status).json({ success: true, data, ...(meta && { meta }), ...(message && { message }) });

const viewer = (req) => ({ canSeeCost: req.user.role !== 'CASHIER' });

exports.list = asyncHandler(async (req, res) => {
  const query = req.valid.query;
  const { rows, total } = await products.list(query);
  const names = await products.categoryNameMap();
  ok(res, rows.map((r) => products.toPublic(r, names, viewer(req))), undefined, 200, {
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  });
});

exports.nextSku = asyncHandler(async (req, res) => {
  ok(res, { sku: await products.nextSku(req.valid.query.categoryId) });
});

exports.get = asyncHandler(async (req, res) => {
  const row = await products.findRow(req.valid.params.id);
  ok(res, products.toPublic(row, await products.categoryNameMap(), viewer(req)));
});

exports.create = asyncHandler(async (req, res) => {
  const row = await products.create(req.valid.body, req.user.id);
  ok(res, products.toPublic(row, await products.categoryNameMap(), viewer(req)), 'Product created.', 201);
});

exports.update = asyncHandler(async (req, res) => {
  const row = await products.update(req.valid.params.id, req.valid.body);
  ok(res, products.toPublic(row, await products.categoryNameMap(), viewer(req)), 'Product updated.');
});

exports.setStatus = asyncHandler(async (req, res) => {
  const { active } = req.valid.body;
  const row = await products.setActive(req.valid.params.id, active);
  ok(res, products.toPublic(row, await products.categoryNameMap(), viewer(req)), active ? 'Product activated.' : 'Product deactivated.');
});

exports.remove = asyncHandler(async (req, res) => {
  await products.remove(req.valid.params.id);
  ok(res, undefined, 'Product deleted.');
});
