const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { verifyCredentials } = require('../src/auth/auth.service');
const { requireAuth } = require('../src/auth/auth.hook');

const config = {
  adminUsername: 'admin',
  adminPasswordHash: bcrypt.hashSync('correct-horse-battery-staple', 4),
};

test('verifyCredentials accepts the correct username/password', async () => {
  const ok = await verifyCredentials(config, 'admin', 'correct-horse-battery-staple');
  assert.equal(ok, true);
});

test('verifyCredentials rejects a wrong password', async () => {
  const ok = await verifyCredentials(config, 'admin', 'wrong-password');
  assert.equal(ok, false);
});

test('verifyCredentials rejects a wrong username', async () => {
  const ok = await verifyCredentials(config, 'not-admin', 'correct-horse-battery-staple');
  assert.equal(ok, false);
});

test('verifyCredentials rejects non-string input', async () => {
  const ok = await verifyCredentials(config, undefined, undefined);
  assert.equal(ok, false);
});

test('requireAuth allows a request with a session user', async () => {
  let codeCalled = null;
  const reply = {
    code(c) {
      codeCalled = c;
      return this;
    },
    send() {},
  };
  const request = { session: { user: { username: 'admin' } } };
  await requireAuth(request, reply);
  assert.equal(codeCalled, null);
});

test('requireAuth rejects a request without a session user', async () => {
  let codeCalled = null;
  let sentBody = null;
  const reply = {
    code(c) {
      codeCalled = c;
      return this;
    },
    send(body) {
      sentBody = body;
    },
  };
  const request = { session: {} };
  await requireAuth(request, reply);
  assert.equal(codeCalled, 401);
  assert.deepEqual(sentBody, { error: 'unauthenticated' });
});
