const fs = require('node:fs');
const path = require('node:path');
const { safePath } = require('./safePath');
const { NotFoundError } = require('./fs.errors');

function normalizeRelative(relativePath) {
  return relativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function buildBreadcrumbs(relativePath) {
  const normalized = normalizeRelative(relativePath);
  const crumbs = [{ name: 'root', path: '' }];
  if (!normalized) return crumbs;

  const parts = normalized.split('/');
  let accumulated = '';
  for (const part of parts) {
    accumulated = accumulated ? `${accumulated}/${part}` : part;
    crumbs.push({ name: part, path: accumulated });
  }
  return crumbs;
}

async function listDirectory(storageRoot, relativePath) {
  const target = safePath(storageRoot, relativePath);

  let stat;
  try {
    stat = await fs.promises.stat(target);
  } catch {
    throw new NotFoundError('Directory not found');
  }
  if (!stat.isDirectory()) {
    throw new NotFoundError('Not a directory');
  }

  const dirents = await fs.promises.readdir(target, { withFileTypes: true });
  const entries = await Promise.all(
    dirents.map(async (dirent) => {
      const entryStat = await fs.promises.stat(path.join(target, dirent.name)).catch(() => null);
      return {
        name: dirent.name,
        type: dirent.isDirectory() ? 'directory' : 'file',
        size: dirent.isDirectory() ? null : entryStat?.size ?? null,
        modifiedAt: entryStat?.mtime?.toISOString() ?? null,
      };
    })
  );

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return {
    path: normalizeRelative(relativePath),
    breadcrumbs: buildBreadcrumbs(relativePath),
    entries,
  };
}

module.exports = { listDirectory, normalizeRelative, buildBreadcrumbs };
