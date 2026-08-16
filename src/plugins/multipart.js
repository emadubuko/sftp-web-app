const fp = require('fastify-plugin');
const multipart = require('@fastify/multipart');

async function multipartPlugin(fastify, opts) {
  await fastify.register(multipart, {
    limits: {
      // @fastify/multipart falls back to fastify's default bodyLimit
      // (1MB) whenever fileSize is falsy, so "unlimited" must be spelled
      // out as a large number rather than left undefined/0 — otherwise
      // every upload over 1MB silently 413s.
      fileSize: opts.config.maxUploadSizeBytes || Number.MAX_SAFE_INTEGER,
      files: 1,
    },
  });
}

module.exports = fp(multipartPlugin, { name: 'multipart-plugin' });
