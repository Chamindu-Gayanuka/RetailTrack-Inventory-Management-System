'use strict';

const asyncHandler = require('../utils/asyncHandler');
const sales = require('../services/salesService');

const ok = (res, data, message, status = 200, meta) =>
  res.status(status).json({ success: true, data, ...(meta && { meta }), ...(message && { message }) });
const paged = (query, total) => ({ page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) });

exports.list = asyncHandler(async (req, res) => {
  const query = req.valid.query;
  const { data, total } = await sales.listSales(query, req.user);
  ok(res, data, undefined, 200, paged(query, total));
});

exports.get = asyncHandler(async (req, res) => ok(res, await sales.getSale(req.valid.params.id, req.user)));

exports.create = asyncHandler(async (req, res) => {
  const id = await sales.createSale(req.valid.body, req.user.id);
  const sale = await sales.getSale(id, req.user);
  ok(res, sale, sale.status === 'COMPLETED' ? 'Sale completed and stock updated.' : 'Sale saved as a pending order.', 201);
});

exports.complete = asyncHandler(async (req, res) => {
  await sales.getSale(req.valid.params.id, req.user); // 404 for sales the caller may not see
  await sales.completeSale(req.valid.params.id, req.user.id);
  ok(res, await sales.getSale(req.valid.params.id, req.user), 'Sale completed and stock updated.');
});

exports.cancel = asyncHandler(async (req, res) => {
  await sales.getSale(req.valid.params.id, req.user);
  await sales.cancelSale(req.valid.params.id);
  ok(res, await sales.getSale(req.valid.params.id, req.user), 'Sale cancelled. No stock was changed.');
});

// ----- Returns -----

exports.listReturns = asyncHandler(async (req, res) => {
  const query = req.valid.query;
  const { data, total } = await sales.listReturns(query, req.user);
  ok(res, data, undefined, 200, paged(query, total));
});

exports.eligibleSales = asyncHandler(async (req, res) => ok(res, await sales.eligibleSales(req.valid.query)));

exports.getReturn = asyncHandler(async (req, res) => ok(res, await sales.getReturn(req.valid.params.id, req.user)));

exports.createReturn = asyncHandler(async (req, res) => {
  const id = await sales.createReturn(req.valid.body, req.user.id);
  ok(res, await sales.getReturn(id, req.user), 'Return processed. Stock was updated.', 201);
});
