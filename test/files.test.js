const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { buildApp } = require('../src/app');

function makeConfig(storageRoot) {
  return {
    port: 0,
    host: '127.0.0.1',
    nodeEnv: 'test',
    storageRoot,
    sessionSecret: 'test-session-secret-at-least-32-chars-long',
    adminUsername: 'admin',
    adminPasswordHash: bcrypt.hashSync('test-password', 4),
    maxUploadSizeBytes: undefined,
    allowedFileExtensions: ['xlsx', 'xls', 'csv', 'zip', 'doc', 'docx', 'pdf'],
    trustProxy: false,
  };
}

async function loginAndGetCookie(app) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/login',
    payload: { username: 'admin', password: 'test-password' },
  });
  assert.equal(res.statusCode, 200);
  const setCookie = res.headers['set-cookie'];
  return Array.isArray(setCookie) ? setCookie[0].split(';')[0] : setCookie.split(';')[0];
}

function buildMultipartBody(fieldName, filename, content) {
  const boundary = '----testboundary1234';
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
    'Content-Type: application/octet-stream\r\n\r\n' +
    content +
    `\r\n--${boundary}--\r\n`;
  return { boundary, body };
}

test('mkdir happy path then listing shows it with breadcrumbs', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const cookie = await loginAndGetCookie(app);

  const mkdirRes = await app.inject({
    method: 'POST',
    url: '/api/files/mkdir',
    headers: { cookie },
    payload: { path: '', name: 'reports' },
  });
  assert.equal(mkdirRes.statusCode, 201);

  const listRes = await app.inject({
    method: 'GET',
    url: '/api/files?path=',
    headers: { cookie },
  });
  const listing = listRes.json();
  assert.equal(listing.entries.length, 1);
  assert.equal(listing.entries[0].name, 'reports');
  assert.equal(listing.entries[0].type, 'directory');

  const nestedRes = await app.inject({
    method: 'GET',
    url: '/api/files?path=reports',
    headers: { cookie },
  });
  const nested = nestedRes.json();
  assert.deepEqual(
    nested.breadcrumbs.map((b) => b.path),
    ['', 'reports']
  );
});

test('mkdir rejects a traversal name', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const cookie = await loginAndGetCookie(app);

  const res = await app.inject({
    method: 'POST',
    url: '/api/files/mkdir',
    headers: { cookie },
    payload: { path: '', name: '../evil' },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(fs.existsSync(path.join(storageRoot, '..', 'evil')), false);
});

test('listing rejects a path-traversal query', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const cookie = await loginAndGetCookie(app);

  const res = await app.inject({
    method: 'GET',
    url: `/api/files?path=${encodeURIComponent('../../etc')}`,
    headers: { cookie },
  });
  assert.equal(res.statusCode, 400);
});

test('protected routes reject requests without a session', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const res = await app.inject({ method: 'GET', url: '/api/files' });
  assert.equal(res.statusCode, 401);
});

test('upload writes the exact bytes to disk under the storage root', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const cookie = await loginAndGetCookie(app);
  const fileContent = 'col1,col2\nvalue1,value2\n'.repeat(1000);
  const { boundary, body } = buildMultipartBody('file', 'data.csv', fileContent);

  const uploadRes = await app.inject({
    method: 'POST',
    url: '/api/files/upload?path=',
    headers: {
      cookie,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: body,
  });
  assert.equal(uploadRes.statusCode, 201);
  const uploadBody = uploadRes.json();
  assert.equal(uploadBody.path, 'data.csv');

  const onDisk = fs.readFileSync(path.join(storageRoot, 'data.csv'), 'utf8');
  assert.equal(onDisk, fileContent);
});

test('there is no HTTP download route — files can only leave via SSH', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const cookie = await loginAndGetCookie(app);
  fs.writeFileSync(path.join(storageRoot, 'data.csv'), 'a,b\n1,2\n');

  const res = await app.inject({
    method: 'GET',
    url: `/api/files/download?path=${encodeURIComponent('data.csv')}`,
    headers: { cookie },
  });
  assert.equal(res.statusCode, 404);
});

test('upload rejects a traversal destination path', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const cookie = await loginAndGetCookie(app);
  const { boundary, body } = buildMultipartBody('file', 'data.csv', 'a,b\n1,2\n');

  const uploadRes = await app.inject({
    method: 'POST',
    url: `/api/files/upload?path=${encodeURIComponent('../../tmp')}`,
    headers: {
      cookie,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: body,
  });
  assert.equal(uploadRes.statusCode, 400);
});

test('upload rejects a disallowed file extension', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const cookie = await loginAndGetCookie(app);
  const { boundary, body } = buildMultipartBody('file', 'payload.exe', 'MZ...not really an exe');

  const uploadRes = await app.inject({
    method: 'POST',
    url: '/api/files/upload?path=',
    headers: {
      cookie,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: body,
  });
  assert.equal(uploadRes.statusCode, 415);
  assert.equal(fs.existsSync(path.join(storageRoot, 'payload.exe')), false);
});

test('upload rejects a binary file (e.g. a video) renamed with a .csv extension', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const cookie = await loginAndGetCookie(app);
  // First bytes of a QuickTime/MOV container ("....ftyp..."), not text.
  const movHeader = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]).toString(
    'binary'
  );
  const { boundary, body } = buildMultipartBody('file', 'IMG_7658.MOV.crdownload.csv', movHeader);

  const uploadRes = await app.inject({
    method: 'POST',
    url: '/api/files/upload?path=',
    headers: {
      cookie,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: body,
  });
  assert.equal(uploadRes.statusCode, 415);
  assert.equal(fs.existsSync(path.join(storageRoot, 'IMG_7658.MOV.crdownload.csv')), false);
});

test('upload rejects content whose bytes do not match its extension', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const cookie = await loginAndGetCookie(app);
  // Extension says .pdf, but the bytes are plain text — no PDF signature.
  const { boundary, body } = buildMultipartBody('file', 'report.pdf', 'this is definitely not a pdf file');

  const uploadRes = await app.inject({
    method: 'POST',
    url: '/api/files/upload?path=',
    headers: {
      cookie,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: body,
  });
  assert.equal(uploadRes.statusCode, 415);
  assert.equal(fs.existsSync(path.join(storageRoot, 'report.pdf')), false);
  // No orphaned .part temp file left behind either.
  assert.deepEqual(fs.readdirSync(storageRoot), []);
});

test('mkdir rejects a dotfile name', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const cookie = await loginAndGetCookie(app);

  const res = await app.inject({
    method: 'POST',
    url: '/api/files/mkdir',
    headers: { cookie },
    payload: { path: '', name: '.ssh' },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(fs.existsSync(path.join(storageRoot, '.ssh')), false);
});

test('upload conflict is caught atomically even past the early existence check', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const cookie = await loginAndGetCookie(app);
  fs.writeFileSync(path.join(storageRoot, 'data.csv'), 'already,here\n');

  const { boundary, body } = buildMultipartBody('file', 'data.csv', 'new,content\n');
  const uploadRes = await app.inject({
    method: 'POST',
    url: '/api/files/upload?path=',
    headers: {
      cookie,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: body,
  });
  assert.equal(uploadRes.statusCode, 409);
  // The pre-existing file must be untouched, not silently overwritten.
  assert.equal(fs.readFileSync(path.join(storageRoot, 'data.csv'), 'utf8'), 'already,here\n');
});

test('upload is rejected with 507 when it would leave less than the reserve free', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const cookie = await loginAndGetCookie(app);

  // Simulate a nearly-full disk: 1GB available, well under the 5GB reserve.
  t.mock.method(fs.promises, 'statfs', async () => ({
    bsize: 4096,
    bavail: Math.floor((1 * 1024 ** 3) / 4096),
  }));

  const { boundary, body } = buildMultipartBody('file', 'data.csv', 'a,b\n1,2\n');
  const uploadRes = await app.inject({
    method: 'POST',
    url: '/api/files/upload?path=',
    headers: {
      cookie,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: body,
  });
  assert.equal(uploadRes.statusCode, 507);
  assert.equal(fs.existsSync(path.join(storageRoot, 'data.csv')), false);
});

test('responses include the security headers set by @fastify/helmet', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const res = await app.inject({ method: 'GET', url: '/api/me' });
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.match(res.headers['content-security-policy'], /frame-ancestors 'none'/);
});

test('a cross-origin POST with a mismatched Origin header is rejected', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const res = await app.inject({
    method: 'POST',
    url: '/api/login',
    headers: { origin: 'https://evil.example' },
    payload: { username: 'admin', password: 'test-password' },
  });
  assert.equal(res.statusCode, 403);
});

test('a same-origin POST with a matching Origin header is allowed through', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const res = await app.inject({
    method: 'POST',
    url: '/api/login',
    // A real browser on the default HTTP port never includes ":80" in
    // either header — set both explicitly to reflect that, rather than
    // relying on light-my-request's synthetic default Host of "localhost:80".
    headers: { host: 'localhost', origin: 'http://localhost' },
    payload: { username: 'admin', password: 'test-password' },
  });
  assert.equal(res.statusCode, 200);
});

test('a same-origin POST on a non-default port is allowed through', async (t) => {
  // Regression guard: request.hostname strips the port but Origin's .host
  // keeps it when non-default (e.g. local dev on :3000) — comparing
  // against the wrong one would reject every same-origin request whenever
  // the app isn't listening on the default HTTP/HTTPS port.
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const res = await app.inject({
    method: 'POST',
    url: '/api/login',
    headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    payload: { username: 'admin', password: 'test-password' },
  });
  assert.equal(res.statusCode, 200);
});

test('a cross-port Origin on the same hostname is rejected', async (t) => {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-test-'));
  t.after(() => fs.rmSync(storageRoot, { recursive: true, force: true }));

  const app = buildApp(makeConfig(storageRoot));
  t.after(() => app.close());

  const res = await app.inject({
    method: 'POST',
    url: '/api/login',
    headers: { host: 'localhost:3000', origin: 'http://localhost:9999' },
    payload: { username: 'admin', password: 'test-password' },
  });
  assert.equal(res.statusCode, 403);
});
