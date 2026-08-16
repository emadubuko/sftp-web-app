const fs = require('node:fs');
const path = require('node:path');
const { UnsupportedFileTypeError } = require('./fs.errors');

/**
 * Rejects an upload whose extension isn't in the configured allowlist.
 * Extension-based, not content-based — this alone trusts the filename,
 * which is attacker-controlled. Paired with assertMatchesFileSignature
 * below, which verifies the bytes actually match once the file is on
 * disk.
 */
function assertAllowedExtension(filename, allowedExtensions) {
  const ext = path.extname(filename).slice(1).toLowerCase();
  if (!ext || !allowedExtensions.includes(ext)) {
    throw new UnsupportedFileTypeError(
      `File type "${ext ? `.${ext}` : '(none)'}" is not allowed. Allowed types: ${allowedExtensions.join(', ')}`
    );
  }
}

// Extensions file-type can actually fingerprint from binary content, mapped
// to the detected type(s) that count as a match. docx/xlsx accept a bare
// "zip" detection too, since both are zip containers and disambiguating
// them from a minimal/malformed file isn't always possible — accepting
// "zip" still rejects anything that isn't zip-based at all (an .exe
// renamed to .docx, for instance).
//
// doc/xls (legacy OLE binary format) have no entry here on purpose:
// file-type doesn't implement OLE fingerprinting, so there is nothing to
// verify beyond the extension check for those two.
const SIGNATURE_MATCHES = {
  pdf: ['pdf'],
  zip: ['zip'],
  docx: ['docx', 'zip'],
  xlsx: ['xlsx', 'zip'],
};

// csv has no magic number — it's plain text, so there's no binary
// signature to fingerprint. Instead of skipping verification entirely
// (which let an arbitrary renamed binary, e.g. a video file, through with
// only its extension checked), sample the start of the file and reject it
// if it looks binary rather than textual.
const TEXT_EXTENSIONS = new Set(['csv']);
const TEXT_SNIFF_SAMPLE_SIZE = 8000; // same sample size git uses for its own binary-detection heuristic
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const UTF16_BOMS = [Buffer.from([0xff, 0xfe]), Buffer.from([0xfe, 0xff])];

async function assertPlausibleTextContent(filePath, extension) {
  const fh = await fs.promises.open(filePath, 'r');
  let sample;
  try {
    const buffer = Buffer.alloc(TEXT_SNIFF_SAMPLE_SIZE);
    const { bytesRead } = await fh.read(buffer, 0, TEXT_SNIFF_SAMPLE_SIZE, 0);
    sample = buffer.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }

  // A UTF-16-encoded text file (e.g. Excel's "Unicode Text" CSV export)
  // legitimately contains a null byte after every ASCII character — don't
  // flag those as binary, a BOM at the very start is a reliable enough
  // signal.
  const hasTextBom =
    sample.subarray(0, 3).equals(UTF8_BOM) || UTF16_BOMS.some((bom) => sample.subarray(0, 2).equals(bom));

  if (!hasTextBom && sample.includes(0x00)) {
    throw new UnsupportedFileTypeError(
      `File content does not look like plain text, but its extension claims ".${extension}"`
    );
  }
}

/**
 * Verifies a file already written to disk actually contains the binary
 * signature its extension claims, for the subset of extensions that have
 * one. Runs after the upload is fully streamed to a temp path — office
 * formats are zip containers whose central directory lives at the *end*
 * of the file, so reliable detection needs random file access, not just
 * a prefix of the incoming stream.
 *
 * file-type's own docs note detection is a best-effort binary-signature
 * check, not a guarantee the file is well-formed or safe to open in
 * whatever application eventually reads it.
 */
async function assertMatchesFileSignature(filePath, extension) {
  if (TEXT_EXTENSIONS.has(extension)) {
    await assertPlausibleTextContent(filePath, extension);
    return;
  }

  const acceptedDetections = SIGNATURE_MATCHES[extension];
  if (!acceptedDetections) return; // no fingerprint available for this type (doc/xls)

  const { fileTypeFromFile } = await import('file-type');
  const detected = await fileTypeFromFile(filePath);

  if (!detected || !acceptedDetections.includes(detected.ext)) {
    throw new UnsupportedFileTypeError(
      `File content does not match its ".${extension}" extension` +
        (detected ? ` (detected as "${detected.ext}")` : ' (unrecognized binary content)')
    );
  }
}

module.exports = { assertAllowedExtension, assertMatchesFileSignature };
