'use strict';

const router = require('express').Router();
const validate = require('../utils/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/purchaseSettingsController');
const s = require('../validators/purchaseSettingsSchemas');

// Purchase orders are raised from low-stock alerts: administrators and inventory staff.
router.use(authenticate, authorize('ADMIN', 'INVENTORY_STAFF'));

router.get('/', validate({ query: s.poListQuery }), c.listOrders);
router.get('/:id', validate({ params: s.idParams }), c.getOrder);
router.post('/', validate({ body: s.poCreateBody }), c.createOrder);

module.exports = router;
