'use strict';

const router = require('express').Router();
const validate = require('../utils/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/purchaseSettingsController');
const s = require('../validators/purchaseSettingsSchemas');

// Public: only the store name and location, so the sign-in page can show them.
router.get('/public', c.getPublicSettings);

// Any signed-in user can read the settings (receipts, headers); only administrators change them.
router.get('/', authenticate, c.getSettings);
router.patch('/', authenticate, authorize('ADMIN'), validate({ body: s.settingsBody }), c.updateSettings);

module.exports = router;
