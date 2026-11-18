'use strict';

const asyncHandler = require('../utils/asyncHandler');
const backup = require('../services/backupService');

/** Sends the backup document itself (not wrapped), so the response can be saved straight to a file. */
exports.export = asyncHandler(async (req, res) => {
  const doc = await backup.exportAll();
  res.setHeader('Content-Disposition', `attachment; filename="retailtrack-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.type('application/json').send(JSON.stringify(doc, null, 2));
});

exports.import = asyncHandler(async (req, res) => {
  const result = await backup.importBackup(req.valid.body, req.user);
  res.json({
    success: true,
    data: result,
    message: result.applied ? 'Backup imported successfully.' : 'Backup is valid. Nothing was changed yet.',
  });
});
