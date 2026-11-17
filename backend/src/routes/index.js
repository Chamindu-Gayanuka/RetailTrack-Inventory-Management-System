'use strict';

const router = require('express').Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: { service: 'RetailTrack API', status: 'ok', timestamp: new Date().toISOString() },
  });
});

// Feature routers are mounted here as each module is added:
// router.use('/auth', require('./authRoutes'));
// router.use('/users', require('./userRoutes'));
// ...

module.exports = router;
