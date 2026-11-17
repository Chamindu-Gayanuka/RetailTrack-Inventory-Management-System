'use strict';

const router = require('express').Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: { service: 'RetailTrack API', status: 'ok', timestamp: new Date().toISOString() },
  });
});

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
