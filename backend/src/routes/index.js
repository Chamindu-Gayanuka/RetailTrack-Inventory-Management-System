'use strict';

const router = require('express').Router();
const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: { service: 'RetailTrack API', status: 'ok', timestamp: new Date().toISOString() },
  });
});

// Public, for uptime monitors: a minimal query that also keeps the database active.
// No data is returned, and database error details stay in the server log.
router.get('/health/db', asyncHandler(async (req, res) => {
  const { error } = await supabase.from('categories').select('id').limit(1);
  if (error) {
    console.error('Database health check failed:', error.message);
    throw new ApiError(503, 'Database is unreachable.');
  }
  res.json({ success: true, data: { database: 'ok', timestamp: new Date().toISOString() } });
}));

// Feature routers are mounted here as each module is added:
router.use('/auth', require('./authRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/categories', require('./categoryRoutes'));
router.use('/products', require('./productRoutes'));
router.use('/inventory', require('./inventoryRoutes'));
router.use('/sales', require('./salesRoutes'));
router.use('/returns', require('./returnRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/reports', require('./reportRoutes'));
router.use('/purchase-orders', require('./purchaseOrderRoutes'));
router.use('/settings', require('./settingsRoutes'));
router.use('/backup', require('./backupRoutes'));

module.exports = router;
