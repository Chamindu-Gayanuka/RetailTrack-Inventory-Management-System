'use strict';

const ApiError = require('../utils/ApiError');
const config = require('../config/env');

/**
 * Translates database and body-parser errors into client-safe ApiErrors.
 * Anything unrecognised is treated as an internal error and its details stay in the server log.
 */
function normalizeError(err) {
  if (err instanceof ApiError) return err;

  // body-parser errors
  if (err.type === 'entity.parse.failed') return ApiError.badRequest('Request body is not valid JSON.');
  if (err.type === 'entity.too.large') return new ApiError(413, 'Request body is too large.');

  // multer-style upload limits
  if (err.code === 'LIMIT_FILE_SIZE') return ApiError.badRequest('The uploaded file is too large.');

  // Postgres / PostgREST errors returned by supabase-js
  switch (err.code) {
    case 'P0001': // RAISE EXCEPTION inside our SQL functions: messages are written for users
      return ApiError.badRequest(err.message);
    case '23505':
      return ApiError.conflict('A record with the same unique value already exists.');
    case '23503':
      return ApiError.conflict('This record is linked to other records and cannot be changed this way.');
    case '23514':
    case '23502':
    case '22P02':
    case '22003':
      return ApiError.badRequest('The submitted data is not valid.');
    case 'P0002': // our SQL functions raise this for "not found"
    case 'PGRST116':
      return ApiError.notFound();
    default:
      return null;
  }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const apiError = normalizeError(err);

  if (!apiError) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }

  if (apiError.statusCode >= 500) console.error(`[${req.method} ${req.originalUrl}]`, err);

  const body = { success: false, message: apiError.message };
  if (apiError.errors) body.errors = apiError.errors;
  if (!config.isProduction && err.code) body.code = err.code;

  return res.status(apiError.statusCode).json(body);
}

function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Route not found.' });
}

module.exports = { errorHandler, notFound, normalizeError };
