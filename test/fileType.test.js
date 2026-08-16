const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { assertAllowedExtension, assertMatchesFileSignature } = require('../src/fs/fileType');

const ALLOWED = ['xlsx', 'xls', 'csv', 'zip', 'doc', 'docx', 'pdf'];

const ZIP_HEADER = Buffer.from([
  0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]);
const PDF_HEADER = Buffer.from('%PDF-1.4\n%rest of a real pdf would follow...');

function writeTmpFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-app-filetype-test-'));
  const filePath = path.join(dir, 'upload.bin');
  fs.writeFileSync(filePath, content);
  return { dir, filePath };
}

test('assertAllowedExtension accepts every allowed type', () => {
  for (const ext of ALLOWED) {
    assert.doesNotThrow(() => assertAllowedExtension(`report.${ext}`, ALLOWED));
  }
});

test('assertAllowedExtension is case-insensitive', () => {
  assert.doesNotThrow(() => assertAllowedExtension('report.PDF', ALLOWED));
  assert.doesNotThrow(() => assertAllowedExtension('report.Csv', ALLOWED));
});

test('assertAllowedExtension rejects a disallowed type', () => {
  assert.throws(() => assertAllowedExtension('malware.exe', ALLOWED), /not allowed/);
  assert.throws(() => assertAllowedExtension('script.sh', ALLOWED), /not allowed/);
});

test('assertAllowedExtension rejects a file with no extension', () => {
  assert.throws(() => assertAllowedExtension('README', ALLOWED), /not allowed/);
});

test('assertMatchesFileSignature accepts a real zip signature for .zip', async (t) => {
  const { dir, filePath } = writeTmpFile(ZIP_HEADER);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await assert.doesNotReject(() => assertMatchesFileSignature(filePath, 'zip'));
});

test('assertMatchesFileSignature accepts a real pdf signature for .pdf', async (t) => {
  const { dir, filePath } = writeTmpFile(PDF_HEADER);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await assert.doesNotReject(() => assertMatchesFileSignature(filePath, 'pdf'));
});

test('assertMatchesFileSignature accepts a bare zip signature for .docx and .xlsx', async (t) => {
  // docx/xlsx are zip containers — a minimal/malformed file that can't be
  // disambiguated past "it's zip-based" is still accepted, since the goal
  // is catching non-zip content wearing a docx/xlsx extension, not
  // validating full OOXML structure.
  const { dir, filePath } = writeTmpFile(ZIP_HEADER);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await assert.doesNotReject(() => assertMatchesFileSignature(filePath, 'docx'));
  await assert.doesNotReject(() => assertMatchesFileSignature(filePath, 'xlsx'));
});

test('assertMatchesFileSignature rejects content that does not match the claimed extension', async (t) => {
  const { dir, filePath } = writeTmpFile(PDF_HEADER);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await assert.rejects(() => assertMatchesFileSignature(filePath, 'zip'), /does not match/);
});

test('assertMatchesFileSignature rejects unrecognized binary content for a checkable extension', async (t) => {
  const { dir, filePath } = writeTmpFile(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await assert.rejects(() => assertMatchesFileSignature(filePath, 'pdf'), /does not match/);
});

test('assertMatchesFileSignature is a no-op for doc/xls (no fingerprint available at all)', async (t) => {
  // file-type doesn't implement legacy OLE (.doc/.xls) fingerprinting —
  // arbitrary content, including binary garbage, passes through untouched.
  const { dir, filePath } = writeTmpFile(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await assert.doesNotReject(() => assertMatchesFileSignature(filePath, 'doc'));
  await assert.doesNotReject(() => assertMatchesFileSignature(filePath, 'xls'));
});

test('assertMatchesFileSignature accepts plausible plain-text content for .csv', async (t) => {
  const { dir, filePath } = writeTmpFile('col1,col2\nvalue1,value2\n');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await assert.doesNotReject(() => assertMatchesFileSignature(filePath, 'csv'));
});

test('assertMatchesFileSignature accepts UTF-16 text (BOM present) for .csv', async (t) => {
  // UTF-16 legitimately null-byte-pads every ASCII character — a BOM at
  // the start is the signal that this is expected, not binary garbage.
  const utf16Content = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('a,b\n1,2\n', 'utf16le')]);
  const { dir, filePath } = writeTmpFile(utf16Content);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await assert.doesNotReject(() => assertMatchesFileSignature(filePath, 'csv'));
});

test('assertMatchesFileSignature rejects binary content (e.g. a renamed video file) for .csv', async (t) => {
  // Regression guard: a real report from the field — someone uploaded
  // IMG_XXXX.MOV.crdownload.csv (a partial video download with a fake
  // .csv extension) and it went through untouched before this check.
  const movLikeHeader = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]);
  const { dir, filePath } = writeTmpFile(movLikeHeader);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await assert.rejects(() => assertMatchesFileSignature(filePath, 'csv'), /does not look like plain text/);
});
