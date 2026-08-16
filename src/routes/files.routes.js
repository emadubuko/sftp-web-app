const fs = require('node:fs');
const path = require('node:path');
const { requireAuth } = require('../auth/auth.hook');
const { listDirectory, normalizeRelative } = require('../fs/listing.service');
const { safePath, assertValidSegmentName } = require('../fs/safePath');
const { ConflictError } = require('../fs/fs.errors');

async function filesRoutes(fastify) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/files', async (request) => {
    const relativePath = request.query.path || '';
    return listDirectory(fastify.config.storageRoot, relativePath);
  });

  fastify.post('/files/mkdir', async (request, reply) => {
    const { path: parentPath = '', name } = request.body || {};
    assertValidSegmentName(name);

    const parentDir = safePath(fastify.config.storageRoot, parentPath);
    const target = path.join(parentDir, name);

    try {
      await fs.promises.mkdir(target, { recursive: false });
    } catch (err) {
      if (err.code === 'EEXIST') throw new ConflictError('Folder already exists');
      throw err;
    }

    const relativeTarget = normalizeRelative(path.join(parentPath, name));
    reply.code(201).send({ ok: true, path: relativeTarget });
  });
}

module.exports = filesRoutes;
