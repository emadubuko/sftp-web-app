const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal-length buffers to avoid a fast
    // length-based timing signal.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

async function verifyCredentials(config, username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') return false;
  if (!timingSafeStringEqual(username, config.adminUsername)) {
    // Still hash to keep response timing similar whether the username
    // matched or not.
    await bcrypt.compare(password, config.adminPasswordHash);
    return false;
  }
  return bcrypt.compare(password, config.adminPasswordHash);
}

module.exports = { verifyCredentials };
