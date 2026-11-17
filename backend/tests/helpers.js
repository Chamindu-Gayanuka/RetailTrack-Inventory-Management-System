'use strict';

// Must be required before any module that loads src/config/env.js.
Object.assign(process.env, {
  NODE_ENV: 'test',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
  FRONTEND_URL: 'http://localhost:5173',
});

/** Starts the Express app on an ephemeral port and returns a tiny JSON client. */
async function startApp() {
  const app = require('../src/app');
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(method, path, { body, headers = {} } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    return { status: response.status, headers: response.headers, body: await response.json().catch(() => null) };
  }

  return { request, close: () => new Promise((resolve) => server.close(resolve)) };
}

module.exports = { startApp };
