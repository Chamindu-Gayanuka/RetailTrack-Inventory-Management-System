'use strict';

const ApiError = require('./ApiError');

/**
 * Validates request parts against zod schemas. Parsed values are stored on `req.valid`
 * (Express 5 makes `req.query` read-only, so it is never overwritten).
 *
 * @example router.post('/', validate({ body: createSchema }), handler)
 *          // handler reads req.valid.body
 *
 * @param {{ body?: import('zod').ZodType, query?: import('zod').ZodType, params?: import('zod').ZodType }} schemas
 */
module.exports = (schemas) => (req, res, next) => {
  const valid = {};
  const errors = {};

  for (const part of ['params', 'query', 'body']) {
    const schema = schemas[part];
    if (!schema) continue;

    const result = schema.safeParse(req[part] ?? {});
    if (result.success) {
      valid[part] = result.data;
      continue;
    }

    for (const issue of result.error.issues) {
      const field = issue.path.length ? issue.path.join('.') : part;
      (errors[field] ||= []).push(issue.message);
    }
  }

  if (Object.keys(errors).length) {
    return next(ApiError.badRequest('Validation failed.', errors));
  }

  req.valid = valid;
  return next();
};
