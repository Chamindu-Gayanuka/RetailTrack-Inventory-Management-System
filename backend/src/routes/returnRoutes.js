'use strict';

const router = require('express').Router();
const validate = require('../utils/validate');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/salesController');
const s = require('../validators/salesSchemas');

// Every signed-in role can process returns. Cashiers only see returns they processed.
router.use(authenticate);

router.get('/', validate({ query: s.returnListQuery }), c.listReturns);
router.get('/eligible-sales', validate({ query: s.eligibleQuery }), c.eligibleSales);
router.get('/:id', validate({ params: s.idParams }), c.getReturn);
router.post('/', validate({ body: s.returnBody }), c.createReturn);

module.exports = router;
