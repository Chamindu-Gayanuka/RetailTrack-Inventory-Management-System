'use strict';

const router = require('express').Router();
const validate = require('../utils/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/categoryController');
const s = require('../validators/categorySchemas');

router.use(authenticate);

// Every role can read categories (product filters, sales screen); only administrators change them.
router.get('/', c.list);
router.post('/', authorize('ADMIN'), validate({ body: s.createBody }), c.create);
router.patch('/:id', authorize('ADMIN'), validate({ params: s.idParams, body: s.updateBody }), c.update);
router.delete('/:id', authorize('ADMIN'), validate({ params: s.idParams }), c.remove);

module.exports = router;
