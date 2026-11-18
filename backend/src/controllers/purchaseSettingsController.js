'use strict';

const asyncHandler = require('../utils/asyncHandler');
const purchaseOrders = require('../services/purchaseOrderService');
const settings = require('../services/settingsService');

const ok = (res, data, message, status = 200, meta) =>
  res.status(status).json({ success: true, data, ...(meta && { meta }), ...(message && { message }) });

// ----- Purchase orders -----

exports.listOrders = asyncHandler(async (req, res) => {
  const query = req.valid.query;
  const { data, total } = await purchaseOrders.list(query);
  ok(res, data, undefined, 200, { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) });
});

exports.getOrder = asyncHandler(async (req, res) => ok(res, await purchaseOrders.get(req.valid.params.id)));

exports.createOrder = asyncHandler(async (req, res) => {
  const order = await purchaseOrders.create(req.valid.body, req.user.id);
  ok(res, order, `${order.poNumber} created for ${order.productName}.`, 201);
});

// ----- Store settings -----

exports.getSettings = asyncHandler(async (req, res) => ok(res, await settings.get()));
exports.getPublicSettings = asyncHandler(async (req, res) => ok(res, await settings.getPublic()));
exports.updateSettings = asyncHandler(async (req, res) => ok(res, await settings.update(req.valid.body), 'Settings saved successfully.'));
