'use strict';

const router = require('express').Router();
const { z } = require('zod');
const validate = require('../utils/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const c = require('../controllers/backupController');

const importBody = z.object({
  // The backup document is validated in depth by the service; here it only has to be an object.
  backup: z.record(z.string(), z.unknown(), { error: 'Send the backup document in "backup".' }),
  mode: z.enum(['validate', 'replace']).default('validate'),
  password: z.string().max(200).optional(),
  confirm: z.string().max(100).optional(),
});

// A backup holds the whole business and a restore replaces it: administrators only.
router.use(authenticate, authorize('ADMIN'));

router.get('/export', c.export);
router.post('/import', authLimiter, validate({ body: importBody }), c.import);

module.exports = router;
