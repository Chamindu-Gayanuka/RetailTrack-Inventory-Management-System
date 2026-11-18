'use strict';

const router = require('express').Router();
const validate = require('../utils/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/reportController');
const s = require('../validators/reportSchemas');

router.use(authenticate);

// Sales analytics and profit/loss expose revenue and cost: administrators only.
router.get('/sales', authorize('ADMIN'), validate({ query: s.salesQuery }), c.sales);
router.get('/profit', authorize('ADMIN'), validate({ query: s.salesQuery }), c.profit);

// Stock valuation and product movement: administrators and inventory staff.
router.get('/inventory', authorize('ADMIN', 'INVENTORY_STAFF'), validate({ query: s.inventoryQuery }), c.inventory);
router.get('/movement', authorize('ADMIN', 'INVENTORY_STAFF'), validate({ query: s.movementQuery }), c.movement);

module.exports = router;
