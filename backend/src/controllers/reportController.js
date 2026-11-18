'use strict';

const asyncHandler = require('../utils/asyncHandler');
const reports = require('../services/reportService');

const ok = (res, data) => res.json({ success: true, data });

exports.sales = asyncHandler(async (req, res) => ok(res, await reports.salesReport(req.valid.query)));
exports.profit = asyncHandler(async (req, res) => ok(res, await reports.profitReport(req.valid.query)));
exports.movement = asyncHandler(async (req, res) => ok(res, await reports.movementReport(req.valid.query)));
exports.inventory = asyncHandler(async (req, res) => ok(res, await reports.inventoryReport(req.valid.query)));
exports.dashboard = asyncHandler(async (req, res) => ok(res, await reports.dashboard(req.valid.query, req.user)));
