'use strict';

const config = require('./config/env');
const app = require('./app');
const bootstrapAdmin = require('./services/bootstrapAdmin');

let server;

async function start() {
  await bootstrapAdmin();
  server = app.listen(config.port, () => {
    console.log(`RetailTrack API listening on http://localhost:${config.port} (${config.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('Failed to start the API (check SUPABASE_URL, the service-role key and that schema.sql was run):', err.message || err);
  process.exit(1);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down.`);
  if (!server) process.exit(0);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
