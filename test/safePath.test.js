const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { safePath, assertValidSegmentName } = require('../src/fs/safePath');

const root = path.resolve('/tmp/storage-root');

test('safePath resolves empty input to the root', () => {
  assert.equal(safePath(root, ''), root);
});

test('safePath resolves a nested relative path', () => {
  assert.equal(safePath(root, 'a/b'), path.join(root, 'a', 'b'));
});

test('safePath accepts backslash separators', () => {
  assert.equal(safePath(root, 'a\\b'), path.join(root, 'a', 'b'));
});

test('safePath rejects parent traversal', () => {
  assert.throws(() => safePath(root, '../etc'), /escapes storage root/);
});

test('safePath rejects nested parent traversal', () => {
  assert.throws(() => safePath(root, 'a/../../etc'), /escapes storage root/);
});

test('safePath rejects absolute paths', () => {
  assert.throws(() => safePath(root, '/etc/passwd'), /Absolute paths/);
});

test('safePath rejects null bytes', () => {
  assert.throws(() => safePath(root, 'a\0b'), /Null byte/);
});

test('safePath does not prefix-match a sibling directory', () => {
  // Regression guard: "/tmp/storage-root-evil" must not be treated as inside root.
  assert.throws(() => safePath(root, '../storage-root-evil/file'), /escapes storage root/);
});

test('assertValidSegmentName accepts a normal name', () => {
  assert.doesNotThrow(() => assertValidSegmentName('reports-2026'));
});

test('assertValidSegmentName rejects separators', () => {
  assert.throws(() => assertValidSegmentName('a/b'));
  assert.throws(() => assertValidSegmentName('a\\b'));
});

test('assertValidSegmentName rejects dot and dotdot', () => {
  assert.throws(() => assertValidSegmentName('.'));
  assert.throws(() => assertValidSegmentName('..'));
});

test('assertValidSegmentName rejects empty string', () => {
  assert.throws(() => assertValidSegmentName(''));
});

test('assertValidSegmentName rejects arbitrary dotfile/dot-directory names', () => {
  // Regression guard: if STORAGE_ROOT ever ends up nested inside a real
  // user's home directory, allowing dotfiles would let an authenticated
  // web user write things like .ssh/authorized_keys.
  assert.throws(() => assertValidSegmentName('.ssh'), /starting with "\."/);
  assert.throws(() => assertValidSegmentName('.htaccess'), /starting with "\."/);
  assert.throws(() => assertValidSegmentName('.env'), /starting with "\."/);
});
