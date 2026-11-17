'use strict';

const router = require('express').Router();
const validate = require('../utils/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/inventoryController');
const s = require('../validators/inventorySchemas');

// Inventory is for administrators and inventory staff only (cashiers have no access).
router.use(authenticate, authorize('ADMIN', 'INVENTORY_STAFF'));

router.get('/summary', c.summary);
router.get('/alerts', validate({ query: s.alertsQuery }), c.alerts);
router.get('/transactions', validate({ query: s.transactionsQuery }), c.transactions);
router.post('/restock', validate({ body: s.restockBody }), c.restock);
router.post('/adjustments', validate({ body: s.adjustBody }), c.adjust);

module.exports = router;
