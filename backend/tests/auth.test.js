'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, fake } = require('./helpers');
const { hashPassword } = require('../src/utils/password');
const { outbox } = require('../src/services/emailService');
const bootstrapAdmin = require('../src/services/bootstrapAdmin');

let app;
before(async () => {
  app = await startApp();
});
after(() => app.close());

async function seedUser(overrides = {}) {
  const user = {
    id: crypto.randomUUID(),
    full_name: 'Test User',
    email: 'user@apekade.lk',
    password_hash: await hashPassword('Password123'),
    role: 'CASHIER',
    token_version: 0,
    is_active: true,
    email_verified: false,
    phone: null,
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_login_at: null,
    ...overrides,
  };
  fake.rows('users').push(user);
  return user;
}

const login = async (email, password) => (await app.request('POST', '/api/auth/login', { body: { email, password } }));
const tokenFor = async (email, password = 'Password123') => (await login(email, password)).body.data.token;
const lastCode = () => outbox.at(-1).text.match(/\b(\d{6})\b/)[1];

beforeEach(() => {
  fake.reset();
  outbox.length = 0;
});

test('login succeeds, never exposes the hash, and rejects bad credentials generically', async () => {
  await seedUser({ email: 'a@apekade.lk' });
  const ok = await login('A@Apekade.lk', 'Password123');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.user.email, 'a@apekade.lk');
  assert.equal(ok.body.data.user.roleLabel, 'Cashier');
  assert.ok(ok.body.data.token);
  assert.equal(JSON.stringify(ok.body).includes('password'), false);

  const wrongPw = await login('a@apekade.lk', 'nope-nope');
  const unknown = await login('ghost@apekade.lk', 'Password123');
  assert.equal(wrongPw.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrongPw.body.message, unknown.body.message);
});

test('deactivated users cannot sign in or use an existing token', async () => {
  await seedUser({ email: 'a@apekade.lk' });
  const token = await tokenFor('a@apekade.lk');
  fake.rows('users')[0].is_active = false;
  assert.equal((await login('a@apekade.lk', 'Password123')).status, 403);
  assert.equal((await app.request('GET', '/api/auth/me', { headers: app.auth(token) })).status, 403);
});

test('protected routes require a valid token', async () => {
  assert.equal((await app.request('GET', '/api/auth/me')).status, 401);
  assert.equal((await app.request('GET', '/api/auth/me', { headers: app.auth('garbage') })).status, 401);
  await seedUser({ email: 'a@apekade.lk' });
  const token = await tokenFor('a@apekade.lk');
  const me = await app.request('GET', '/api/auth/me', { headers: app.auth(token) });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.email, 'a@apekade.lk');
});

test('changing the password revokes old tokens and returns a fresh one', async () => {
  await seedUser({ email: 'a@apekade.lk' });
  const old = await tokenFor('a@apekade.lk');
  const bad = await app.request('POST', '/api/auth/change-password', {
    headers: app.auth(old),
    body: { currentPassword: 'wrong-password', newPassword: 'NewPassword456' },
  });
  assert.equal(bad.status, 400);

  const res = await app.request('POST', '/api/auth/change-password', {
    headers: app.auth(old),
    body: { currentPassword: 'Password123', newPassword: 'NewPassword456' },
  });
  assert.equal(res.status, 200);
  assert.equal((await app.request('GET', '/api/auth/me', { headers: app.auth(old) })).status, 401);
  assert.equal((await app.request('GET', '/api/auth/me', { headers: app.auth(res.body.data.token) })).status, 200);
  assert.equal((await login('a@apekade.lk', 'NewPassword456')).status, 200);
});

test('password recovery: code -> verify -> reset, and the code works only once', async () => {
  await seedUser({ email: 'a@apekade.lk' });
  const forgot = await app.request('POST', '/api/auth/forgot-password', { body: { email: 'a@apekade.lk' } });
  assert.equal(forgot.status, 200);
  const code = lastCode();

  const wrong = await app.request('POST', '/api/auth/verify-reset-otp', { body: { email: 'a@apekade.lk', otp: code === '111111' ? '222222' : '111111' } });
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.message, /attempts remaining/);

  const verified = await app.request('POST', '/api/auth/verify-reset-otp', { body: { email: 'a@apekade.lk', otp: code } });
  assert.equal(verified.status, 200);
  const { resetToken } = verified.body.data;

  const again = await app.request('POST', '/api/auth/verify-reset-otp', { body: { email: 'a@apekade.lk', otp: code } });
  assert.equal(again.status, 400);

  const weak = await app.request('POST', '/api/auth/reset-password', { body: { resetToken, newPassword: 'short' } });
  assert.equal(weak.status, 400);
  const reset = await app.request('POST', '/api/auth/reset-password', { body: { resetToken, newPassword: 'BrandNew789' } });
  assert.equal(reset.status, 200);
  assert.equal((await login('a@apekade.lk', 'BrandNew789')).status, 200);

  const reuse = await app.request('POST', '/api/auth/reset-password', { body: { resetToken, newPassword: 'AnotherOne000' } });
  assert.equal(reuse.status, 401);
});

test('forgot-password does not reveal whether an email is registered', async () => {
  const res = await app.request('POST', '/api/auth/forgot-password', { body: { email: 'nobody@apekade.lk' } });
  assert.equal(res.status, 200);
  assert.equal(outbox.length, 0);
});

test('OTP locks after too many wrong attempts', async () => {
  await seedUser({ email: 'a@apekade.lk' });
  await app.request('POST', '/api/auth/forgot-password', { body: { email: 'a@apekade.lk' } });
  const code = lastCode();
  const wrongCode = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i += 1) {
    await app.request('POST', '/api/auth/verify-reset-otp', { body: { email: 'a@apekade.lk', otp: wrongCode } });
  }
  const res = await app.request('POST', '/api/auth/verify-reset-otp', { body: { email: 'a@apekade.lk', otp: code } });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /Too many/);
});

test('email verification flow with resend cooldown', async () => {
  await seedUser({ email: 'a@apekade.lk' });
  const token = await tokenFor('a@apekade.lk');
  const send = await app.request('POST', '/api/auth/email-verification/send', { headers: app.auth(token) });
  assert.equal(send.status, 200);
  const resend = await app.request('POST', '/api/auth/email-verification/send', { headers: app.auth(token) });
  assert.equal(resend.status, 429);

  const confirm = await app.request('POST', '/api/auth/email-verification/confirm', { headers: app.auth(token), body: { otp: lastCode() } });
  assert.equal(confirm.status, 200);
  assert.equal(confirm.body.data.emailVerified, true);
});

test('admin manages users; other roles are forbidden', async () => {
  await seedUser({ email: 'admin@apekade.lk', role: 'ADMIN', full_name: 'Admin' });
  await seedUser({ email: 'cash@apekade.lk', role: 'CASHIER' });
  const admin = await tokenFor('admin@apekade.lk');
  const cashier = await tokenFor('cash@apekade.lk');

  assert.equal((await app.request('GET', '/api/users', { headers: app.auth(cashier) })).status, 403);
  assert.equal((await app.request('POST', '/api/users', { headers: app.auth(cashier), body: {} })).status, 403);

  const created = await app.request('POST', '/api/users', {
    headers: app.auth(admin),
    body: { name: 'Nimal Perera', email: 'Nimal@apekade.lk', phone: '+94 77 000 0000', role: 'INVENTORY_STAFF' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.user.roleLabel, 'Inventory Staff');
  assert.ok(outbox.some((m) => m.to === 'nimal@apekade.lk' && /Temporary password/.test(m.text)));
  assert.equal(created.body.data.temporaryPassword, undefined); // emailed, not echoed

  const dup = await app.request('POST', '/api/users', { headers: app.auth(admin), body: { name: 'Nimal Two', email: 'nimal@apekade.lk', role: 'CASHIER' } });
  assert.equal(dup.status, 409);

  const list = await app.request('GET', '/api/users?role=INVENTORY_STAFF', { headers: app.auth(admin) });
  assert.equal(list.body.data.length, 1);
  assert.equal(JSON.stringify(list.body).includes('password'), false);

  const id = created.body.data.user.id;
  const deactivated = await app.request('PATCH', `/api/users/${id}/status`, { headers: app.auth(admin), body: { active: false } });
  assert.equal(deactivated.body.data.active, false);
  assert.equal((await app.request('GET', `/api/users/not-a-uuid`, { headers: app.auth(admin) })).status, 400);
});

test('administrator safeguards: no self-deactivation or self-demotion', async () => {
  const admin = await seedUser({ email: 'admin@apekade.lk', role: 'ADMIN' });
  const token = await tokenFor('admin@apekade.lk');
  const self = await app.request('PATCH', `/api/users/${admin.id}/status`, { headers: app.auth(token), body: { active: false } });
  assert.equal(self.status, 400);
  const demote = await app.request('PATCH', `/api/users/${admin.id}`, { headers: app.auth(token), body: { role: 'CASHIER' } });
  assert.equal(demote.status, 400);

  const other = await seedUser({ email: 'second@apekade.lk', role: 'ADMIN' });
  const ok = await app.request('PATCH', `/api/users/${other.id}/status`, { headers: app.auth(token), body: { active: false } });
  assert.equal(ok.status, 200);
});

test('profile: update details, email change resets verification, duplicates rejected', async () => {
  await seedUser({ email: 'a@apekade.lk', email_verified: true });
  await seedUser({ email: 'taken@apekade.lk' });
  const token = await tokenFor('a@apekade.lk');

  const upd = await app.request('PATCH', '/api/users/me', { headers: app.auth(token), body: { name: 'New Name', phone: '0771234567' } });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.data.name, 'New Name');
  assert.equal(upd.body.data.emailVerified, true);

  const dup = await app.request('PATCH', '/api/users/me', { headers: app.auth(token), body: { email: 'taken@apekade.lk' } });
  assert.equal(dup.status, 409);

  const change = await app.request('PATCH', '/api/users/me', { headers: app.auth(token), body: { email: 'fresh@apekade.lk' } });
  assert.equal(change.body.data.email, 'fresh@apekade.lk');
  assert.equal(change.body.data.emailVerified, false);

  const badPhoto = await app.request('PATCH', '/api/users/me', { headers: app.auth(token), body: { avatar: 'javascript:alert(1)' } });
  assert.equal(badPhoto.status, 400);

  // role cannot be self-assigned through the profile endpoint
  await app.request('PATCH', '/api/users/me', { headers: app.auth(token), body: { name: 'Hacker', role: 'ADMIN' } });
  assert.equal(fake.rows('users').find((u) => u.full_name === 'Hacker').role, 'CASHIER');
});

test('bootstrapAdmin creates the first admin only once', async () => {
  const config = require('../src/config/env');
  config.admin.name = undefined; // frozen top-level, nested object is mutable in tests
  assert.equal(await bootstrapAdmin(), 'missing-config');
  Object.assign(config.admin, { name: 'Owner', email: 'owner@apekade.lk', password: 'OwnerPass123' });
  assert.equal(await bootstrapAdmin(), 'created');
  assert.equal(await bootstrapAdmin(), 'exists');
  assert.equal((await login('owner@apekade.lk', 'OwnerPass123')).status, 200);
});
