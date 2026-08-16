const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { requireAuth } = require('../auth/auth.hook');
const { safePath, assertValidSegmentName } = require('../fs/safePath');
const { assertAllowedExtension, assertMatchesFileSignature } = require('../fs/fileType');
const { normalizeRelative } = require('../fs/listing.service');
const { ConflictError, InvalidNameError, InsufficientStorageError } = require('../fs/fs.errors');

const MIN_FREE_SPACE_BYTES = 5 * 1024 * 1024 * 1024; // 5GB reserve, always kept free

async function assertSufficientFreeSpace(storageRoot, incomingBytes) {
  const stats = await fs.promises.statfs(storageRoot);
  const availableBytes = stats.bavail * stats.bsize;
  if (availableBytes - incomingBytes < MIN_FREE_SPACE_BYTES) {
    throw new InsufficientStorageError(
      `Not enough free storage space for this upload (would leave less than ${
        MIN_FREE_SPACE_BYTES / 1024 ** 3
      }GB free)`
    );
  }
}

async function uploadRoutes(fastify) {
  fastify.addHook('preHandler', requireAuth);

  fastify.post('/files/upload', async (request, reply) => {
    const relativeDir = request.query.path || '';
    const destDir = safePath(fastify.config.storageRoot, relativeDir);

    // Content-Length is the whole multipart body (file + a few hundred
    // bytes of boundary/header overhead), so it's a safe over-estimate of
    // the actual file size — good enough for a pre-flight reserve check
    // that runs before we've read a single byte of the upload.
    try {
      await assertSufficientFreeSpace(fastify.config.storageRoot, Number(request.headers['content-length'] || 0));
    } catch (err) {
      if (!(err instanceof InsufficientStorageError)) throw err;
      // The request body is completely unread at this point — close the
      // connection instead of leaving a keep-alive socket with an
      // unconsumed multipart body sitting on it.
      reply.header('Connection', 'close');
      reply.code(err.statusCode).send({ ok: false, error: err.message });
      return;
    }

    const data = await request.file();
    if (!data) throw new InvalidNameError('No file provided');

    const filename = data.filename;
    let targetPath;
    try {
      assertValidSegmentName(filename);
      assertAllowedExtension(filename, fastify.config.allowedFileExtensions);
      targetPath = path.join(destDir, filename);
    } catch (err) {
      data.file.resume();
      throw err;
    }

    const exists = await fs.promises
      .access(targetPath)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      data.file.resume();
      throw new ConflictError('A file with that name already exists');
    }

    const tmpPath = path.join(destDir, `${filename}.part.${crypto.randomBytes(6).toString('hex')}`);
    const writeStream = fs.createWriteStream(tmpPath);

    try {
      await pipeline(data.file, writeStream);
    } catch (err) {
      await fs.promises.unlink(tmpPath).catch(() => {});
      throw err;
    }

    if (data.file.truncated) {
      await fs.promises.unlink(tmpPath).catch(() => {});
      reply.code(413).send({ ok: false, error: 'File exceeds maximum upload size' });
      return;
    }

    // Content check runs here — after the full file is on disk, before it's
    // exposed as targetPath — rather than mid-stream, because office
    // formats (docx/xlsx) are zip containers whose central directory lives
    // at the end of the file, so accurate detection needs random access to
    // the completed file, not just a prefix of the incoming stream.
    try {
      const extension = path.extname(filename).slice(1).toLowerCase();
      await assertMatchesFileSignature(tmpPath, extension);
    } catch (err) {
      await fs.promises.unlink(tmpPath).catch(() => {});
      throw err;
    }

    // Finalize via link+unlink rather than rename: link() fails atomically
    // with EEXIST if a concurrent request created targetPath while this
    // upload was streaming, which the earlier fs.access check alone can't
    // guarantee against (rename() would have silently overwritten it).
    try {
      await fs.promises.link(tmpPath, targetPath);
    } catch (err) {
      await fs.promises.unlink(tmpPath).catch(() => {});
      if (err.code === 'EEXIST') throw new ConflictError('A file with that name already exists');
      throw err;
    }
    await fs.promises.unlink(tmpPath).catch(() => {});

    const stat = await fs.promises.stat(targetPath);
    const relativeFinalPath = normalizeRelative(path.join(relativeDir, filename));
    reply.code(201).send({ ok: true, path: relativeFinalPath, size: stat.size });
  });
}

module.exports = uploadRoutes;
