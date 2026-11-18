'use strict';

const router = require('express').Router();
const validate = require('../utils/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/userController');
const s = require('../validators/userSchemas');

router.use(authenticate);

// Own profile: any signed-in role. Declared before '/:id' so "me" is not read as an id.
router.get('/me', c.getProfile);
router.patch('/me', validate({ body: s.profileBody }), c.updateProfile);

// User management: administrators only.
router.use(authorize('ADMIN'));
router.get('/', validate({ query: s.listQuery }), c.list);
router.post('/', validate({ body: s.createBody }), c.create);
router.get('/:id', validate({ params: s.idParams }), c.get);
router.patch('/:id', validate({ params: s.idParams, body: s.updateBody }), c.update);
router.patch('/:id/status', validate({ params: s.idParams, body: s.statusBody }), c.setStatus);

module.exports = router;
