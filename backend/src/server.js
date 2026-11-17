'use strict';

const config = require('./config/env');
const app = require('./app');

const server = app.listen(config.port, () => {
  console.log(`RetailTrack API listening on http://localhost:${config.port} (${config.nodeEnv})`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
