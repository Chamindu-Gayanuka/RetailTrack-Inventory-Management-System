'use strict';

const router = require('express').Router();
const validate = require('../utils/validate');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/reportController');
const s = require('../validators/reportSchemas');

// Every role gets a dashboard; the content is shaped by the caller's role.
router.get('/', authenticate, validate({ query: s.dashboardQuery }), c.dashboard);

module.exports = router;
