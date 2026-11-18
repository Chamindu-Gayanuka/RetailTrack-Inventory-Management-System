'use strict';

const router = require('express').Router();
const validate = require('../utils/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/productController');
const s = require('../validators/productSchemas');

const canManage = authorize('ADMIN', 'INVENTORY_STAFF');

router.use(authenticate);

router.get('/', validate({ query: s.listQuery }), c.list);
router.get('/next-sku', canManage, validate({ query: s.nextSkuQuery }), c.nextSku);
router.get('/:id', validate({ params: s.idParams }), c.get);

router.post('/', canManage, validate({ body: s.createBody }), c.create);
router.patch('/:id', canManage, validate({ params: s.idParams, body: s.updateBody }), c.update);
router.patch('/:id/status', canManage, validate({ params: s.idParams, body: s.statusBody }), c.setStatus);
router.delete('/:id', authorize('ADMIN'), validate({ params: s.idParams }), c.remove);

module.exports = router;
