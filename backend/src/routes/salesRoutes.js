'use strict';

const router = require('express').Router();
const validate = require('../utils/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/salesController');
const s = require('../validators/salesSchemas');

router.use(authenticate);

// Reading: administrators and inventory staff see every sale; cashiers see their own.
router.get('/', validate({ query: s.listQuery }), c.list);
router.get('/:id', validate({ params: s.idParams }), c.get);

// Selling: administrators and cashiers. Inventory staff are read-only here.
const canSell = authorize('ADMIN', 'CASHIER');
router.post('/', canSell, validate({ body: s.createBody }), c.create);
router.post('/:id/complete', canSell, validate({ params: s.idParams }), c.complete);
router.post('/:id/cancel', canSell, validate({ params: s.idParams }), c.cancel);

module.exports = router;
