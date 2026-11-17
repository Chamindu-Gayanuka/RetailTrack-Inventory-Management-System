'use strict';

const asyncHandler = require('../utils/asyncHandler');
const inventory = require('../services/inventoryService');

const ok = (res, data, message, status = 200, meta) =>
  res.status(status).json({ success: true, data, ...(meta && { meta }), ...(message && { message }) });

exports.summary = asyncHandler(async (req, res) => ok(res, await inventory.summary()));

exports.alerts = asyncHandler(async (req, res) => ok(res, await inventory.alerts(req.valid.query)));

exports.transactions = asyncHandler(async (req, res) => {
  const query = req.valid.query;
  const { data, total } = await inventory.transactions(query);
  ok(res, data, undefined, 200, {
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  });
});

exports.restock = asyncHandler(async (req, res) => {
  ok(res, await inventory.addStock(req.valid.body, req.user.id), 'Stock added.', 201);
});

exports.adjust = asyncHandler(async (req, res) => {
  ok(res, await inventory.adjustStock(req.valid.body, req.user.id), 'Stock adjusted.', 201);
});
