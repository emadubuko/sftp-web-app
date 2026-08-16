const path = require('node:path');
const { PathTraversalError, InvalidNameError } = require('./fs.errors');

const INVALID_SEGMENT_CHARS = /[\\/:*?"<>|\0]/;

/**
 * Resolves a user-supplied relative path against storageRoot, guaranteeing
 * the result stays within storageRoot. Throws PathTraversalError otherwise.
 * This is the ONLY function permitted to turn user input into a real
 * filesystem path anywhere in this app.
 */
function safePath(storageRoot, relativeInput = '') {
  if (typeof relativeInput !== 'string') throw new PathTraversalError('Invalid path type');
  if (relativeInput.includes('\0')) throw new PathTraversalError('Null byte in path');
  if (path.isAbsolute(relativeInput)) throw new PathTraversalError('Absolute paths not allowed');

  const cleaned = relativeInput.replace(/\\/g, '/').replace(/^\/+/, '');
  const candidate = path.resolve(storageRoot, cleaned);

  const rootWithSep = storageRoot.endsWith(path.sep) ? storageRoot : storageRoot + path.sep;
  if (candidate !== storageRoot && !candidate.startsWith(rootWithSep)) {
    throw new PathTraversalError(`Resolved path escapes storage root: ${relativeInput}`);
  }

  return candidate;
}

/**
 * Validates a single path segment (a filename or new folder name) does not
 * itself contain separators or traversal sequences. Use before combining a
 * user-supplied name with a directory via safePath.
 */
function assertValidSegmentName(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new InvalidNameError('Name is required');
  }
  if (name.startsWith('.')) {
    // Blocks "." and ".." (traversal) as well as any dotfile/dot-directory
    // name (".ssh", ".htaccess", ".env", ...) — if STORAGE_ROOT is ever
    // nested inside a real user's home directory, allowing dotfiles would
    // let an authenticated web user write files like .ssh/authorized_keys.
    throw new InvalidNameError('Names starting with "." are not allowed');
  }
  if (INVALID_SEGMENT_CHARS.test(name)) {
    throw new InvalidNameError('Name contains invalid characters');
  }
  if (name.trim() !== name) {
    throw new InvalidNameError('Name must not have leading/trailing whitespace');
  }
}

module.exports = { safePath, assertValidSegmentName };
