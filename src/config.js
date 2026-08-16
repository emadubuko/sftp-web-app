const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config();

const REQUIRED_VARS = ['STORAGE_ROOT', 'SESSION_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH_B64'];

const DEFAULT_ALLOWED_FILE_EXTENSIONS = ['xlsx', 'xls', 'csv', 'zip', 'doc', 'docx', 'pdf'];

function loadConfig() {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill them in.'
    );
  }

  const storageRoot = path.resolve(process.env.STORAGE_ROOT);
  let storageRootStat;
  try {
    storageRootStat = fs.statSync(storageRoot);
  } catch {
    throw new Error(
      `STORAGE_ROOT (${storageRoot}) does not exist. This app does not create it — ` +
        'point STORAGE_ROOT at your existing upload directory (or mount it there in Docker).'
    );
  }
  if (!storageRootStat.isDirectory()) {
    throw new Error(`STORAGE_ROOT (${storageRoot}) exists but is not a directory.`);
  }

  const maxUploadSizeBytes = Number(process.env.MAX_UPLOAD_SIZE_BYTES || 0);
  const adminPasswordHash = Buffer.from(process.env.ADMIN_PASSWORD_HASH_B64, 'base64').toString('utf8');
  if (!adminPasswordHash.startsWith('$2')) {
    throw new Error(
      'ADMIN_PASSWORD_HASH_B64 does not decode to a bcrypt hash. Regenerate it with ' +
        '`npm run hash-password -- "your-password"` and paste the output as-is.'
    );
  }

  const allowedFileExtensions = process.env.ALLOWED_FILE_EXTENSIONS
    ? process.env.ALLOWED_FILE_EXTENSIONS.split(',')
        .map((ext) => ext.trim().toLowerCase())
        .filter(Boolean)
    : DEFAULT_ALLOWED_FILE_EXTENSIONS;

  return {
    port: Number(process.env.PORT || 3000),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    storageRoot,
    sessionSecret: process.env.SESSION_SECRET,
    adminUsername: process.env.ADMIN_USERNAME,
    adminPasswordHash,
    maxUploadSizeBytes: maxUploadSizeBytes > 0 ? maxUploadSizeBytes : undefined,
    allowedFileExtensions,
    trustProxy: process.env.TRUST_PROXY === 'true',
  };
}

module.exports = { loadConfig };
