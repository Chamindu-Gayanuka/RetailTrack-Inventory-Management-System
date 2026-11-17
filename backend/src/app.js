'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const ApiError = require('./utils/ApiError');

const app = express();

app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Non-browser clients (Postman, curl, server-to-server) send no Origin header.
      if (!origin || config.frontendOrigins.includes(origin)) return callback(null, true);
      return callback(ApiError.forbidden('This origin is not allowed by CORS.'));
    },
    credentials: true,
  }),
);
// Product images arrive as base64 data URLs, so the product routes accept a larger body.
// The first parser to run wins; the global one below then skips an already-parsed body.
app.use('/api/products', express.json({ limit: '4mb' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiLimiter, routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
