const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig } = require('../src/config');

const REQUIRED_ENV = {
  SESSION_SECRET: 'test-session-secret-at-least-32-chars-long',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD_HASH_B64: Buffer.from('$2a$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX').toString(
    'base64'
  ),
};

function withEnv(overrides, fn) {
  const previous = {};
  const keys = { ...REQUIRED_ENV, ...overrides };
  for (const key of Object.keys(keys)) {
    previous[key] = process.env[key];
    process.env[key] = keys[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(keys)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test('loadConfig throws and does not create STORAGE_ROOT when it does not exist', () => {
  const missingDir = path.join(os.tmpdir(), `sftp-app-missing-${Date.now()}`);
  fs.rmSync(missingDir, { recursive: true, force: true });

  withEnv({ STORAGE_ROOT: missingDir }, () => {
    assert.throws(() => loadConfig(), /does not exist/);
  });

  assert.equal(fs.existsSync(missingDir), false);
});

test('loadConfig throws when STORAGE_ROOT is a file, not a directory', () => {
  const filePath = path.join(os.tmpdir(), `sftp-app-file-${Date.now()}.txt`);
  fs.writeFileSync(filePath, 'not a directory');
  try {
    withEnv({ STORAGE_ROOT: filePath }, () => {
      assert.throws(() => loadConfig(), /is not a directory/);
    });
  } finally {
    fs.rmSync(filePath, { force: true });
  }
});

test('loadConfig succeeds when STORAGE_ROOT already exists', () => {
  const existingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-config-test-'));
  try {
    const config = withEnv({ STORAGE_ROOT: existingDir }, () => loadConfig());
    assert.equal(config.storageRoot, path.resolve(existingDir));
  } finally {
    fs.rmSync(existingDir, { recursive: true, force: true });
  }
});

test('loadConfig defaults allowedFileExtensions when ALLOWED_FILE_EXTENSIONS is unset', () => {
  const existingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-config-test-'));
  try {
    const config = withEnv({ STORAGE_ROOT: existingDir }, () => loadConfig());
    assert.deepEqual(config.allowedFileExtensions, ['xlsx', 'xls', 'csv', 'zip', 'doc', 'docx', 'pdf']);
  } finally {
    fs.rmSync(existingDir, { recursive: true, force: true });
  }
});

test('loadConfig parses ALLOWED_FILE_EXTENSIONS from a comma-separated env var', () => {
  const existingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-config-test-'));
  try {
    const config = withEnv(
      { STORAGE_ROOT: existingDir, ALLOWED_FILE_EXTENSIONS: ' PDF, csv ,zip ' },
      () => loadConfig()
    );
    assert.deepEqual(config.allowedFileExtensions, ['pdf', 'csv', 'zip']);
  } finally {
    fs.rmSync(existingDir, { recursive: true, force: true });
  }
});
