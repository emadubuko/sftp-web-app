# SFTP App

[![CI](https://github.com/emadubuko/sftp-web-app/actions/workflows/ci.yml/badge.svg)](https://github.com/emadubuko/sftp-web-app/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/emadubuko/sftp-web-app)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)

A web-based file manager: browse a directory tree, create folders, and
upload large files, over plain HTTP (not the SSH/SFTP protocol).
Single-admin session auth, streaming uploads (no in-memory buffering, so
multi-GB files don't spike server memory), and it writes into an existing
upload directory you point it at — it never creates that directory
itself.

**Upload only, by design.** There is no download route. Files that need
to leave the storage folder are pulled directly off the server over SSH
(e.g. `scp`/`sftp`/`rsync` by an operator with server access) — the web
app is deliberately a one-way upload channel, not a general-purpose file
browser with exfiltration built in.

## Stack

- **Backend**: Node.js + Fastify, `@fastify/multipart` for streaming
  multipart uploads written straight to disk.
- **Auth**: `@fastify/session` cookie-based sessions, single admin account
  (bcrypt-hashed password) configured via `.env`.
- **Frontend**: plain HTML/CSS/vanilla JS, no build step.

## Local development

```bash
npm install
cp .env.example .env
# Generate a password hash and paste it into .env as ADMIN_PASSWORD_HASH_B64
npm run hash-password -- "your-password-here"
# Also set SESSION_SECRET in .env, e.g.: openssl rand -hex 32
# Point STORAGE_ROOT at a real, already-existing directory — the app
# refuses to start if it doesn't exist. For local dev that can be
# anything, e.g.: mkdir -p ./data && echo STORAGE_ROOT=./data >> .env
npm run dev
```

The app listens on `http://localhost:3000`.

Run the unit/integration test suite with:

```bash
npm test
```

## Running with Docker

1. Copy `.env.example` to `.env` and fill in `SESSION_SECRET`,
   `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH_B64` (see above for how to
   generate the hash), and `SFTP_HOST_DIR` — the absolute path on the
   host to your existing SFTP upload directory. `docker-compose.yml`
   reads this same `.env` file.
2. Make sure `SFTP_HOST_DIR` is readable/writable by UID `1004` / GID
   `1003` (`appuser`/`appgroup`, the user the container runs as — see
   `Dockerfile`), e.g.:

   ```bash
   chown -R 1004:1003 /path/to/your/sftp/uploads
   ```

3. Start the app with the bundled preflight script, **not** `docker
   compose up` directly:

   ```bash
   chmod +x scripts/*.sh   # first time only — needed after cloning/copying
   ./scripts/docker-up.sh
   ```

   This matters: if `SFTP_HOST_DIR` is missing or mistyped, Docker's own
   bind-mount handling silently creates an empty directory at that path
   on the host and starts the container against it — the app's own
   "`STORAGE_ROOT` must already exist" check never gets a chance to catch
   this, because by the time the container boots, something already
   exists there (an empty directory Docker just made). The script checks
   `SFTP_HOST_DIR` on the host *before* invoking Compose, so a typo fails
   loudly instead of quietly landing uploads in the wrong place.

4. Visit `http://localhost:3001` and log in.

### Deploying the pushed image on a server

`docker-compose.yml` (above) builds the image from local source — that's
for development. On the actual server, use `docker-compose.prod.yml`
instead, which pulls the pre-built image from Docker Hub
(`youruser/sftp-app:latest`) rather than building it.

Since the image is pulled pre-built, the server doesn't need the full
repo — only these three files, copied into the same directory:

- `docker-compose.prod.yml`
- `.env` (filled in, see above)
- `scripts/docker-up-prod.sh`

`docker-up-prod.sh` always looks for `.env` and `docker-compose.prod.yml`
in its own directory, so it works wherever you drop these three files —
they don't need to be nested under a `scripts/` folder or a full checkout.

```bash
chmod +x docker-up-prod.sh   # first time only — needed after copying
./docker-up-prod.sh
```

This is the same preflight-checked start as `docker-up.sh`, just pointed
at `docker-compose.prod.yml` and `docker compose pull` instead of
`--build`. Both compose files read the same `.env`.

`docker-compose.yml` hardcodes `NODE_ENV=production`, which makes the
session cookie `Secure` (browsers/clients only send it back over HTTPS).
This is intentional — put a TLS-terminating reverse proxy in front for
real deployments, and set `TRUST_PROXY=true` in `.env` when you do. If you
need to smoke-test the container over plain HTTP first, create a
`docker-compose.override.yml` (gitignored by convention, don't commit it)
with:

```yaml
services:
  sftp-app:
    environment:
      NODE_ENV: development
```

### Where uploaded files live

`docker-compose.yml` bind-mounts `SFTP_HOST_DIR` (your existing directory,
from `.env`) straight to `/data/storage` inside the container — there is
no Docker-managed volume in between. This means:

- The app writes directly into your real directory; nothing is copied or
  synced later.
- Uploaded files and folders **survive** every `docker compose restart`,
  `down`/`up`, and `up --build` (image rebuild) — a bind mount isn't
  owned by Docker's volume lifecycle at all, so `docker compose down -v`
  has nothing to delete here.
- The directory is **never created or deleted by this app**. Neither
  Compose nor the app can be trusted to reject a missing `SFTP_HOST_DIR`
  on their own (see the preflight-script note above) — always start via
  `./scripts/docker-up.sh`, not `docker compose up` directly.
- If `SFTP_HOST_DIR` exists but isn't writable by UID `1004` / GID `1003`,
  the container starts but uploads fail with a permission error.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no (default `3000`) | listen port |
| `HOST` | no (default `0.0.0.0`) | bind address |
| `NODE_ENV` | no | `production` enables secure cookies |
| `STORAGE_ROOT` | **yes** | absolute path to an **already-existing** directory the app writes into. Never created by the app — startup fails if it's missing. In Docker, leave this as `/data/storage` (the mount point) |
| `SFTP_HOST_DIR` | **yes**, Docker only | absolute path on the **host** to your existing SFTP directory; Compose bind-mounts it to `/data/storage` |
| `SESSION_SECRET` | **yes** | ≥32 char random string signing session cookies |
| `ADMIN_USERNAME` | **yes** | login username |
| `ADMIN_PASSWORD_HASH_B64` | **yes** | base64-encoded bcrypt hash of the login password (base64, not raw, so Compose's `.env` interpolation can't mangle the hash's literal `$` characters) |
| `MAX_UPLOAD_SIZE_BYTES` | no | optional per-file upload cap; unset/`0` = unlimited. If a reverse proxy in front also enforces a limit (e.g. nginx `client_max_body_size`), that applies first |
| `ALLOWED_FILE_EXTENSIONS` | no (default `xlsx,xls,csv,zip,doc,docx,pdf`) | comma-separated allowlist of upload file extensions, case-insensitive, no dots |
| `TRUST_PROXY` | no | set `true` if running behind a TLS-terminating reverse proxy |

## Security notes

- Every filesystem-touching route resolves user-supplied paths through a
  single helper, `src/fs/safePath.js`, which rejects `..` traversal,
  absolute paths, and null bytes, and verifies the resolved path is
  actually nested under `STORAGE_ROOT` (not just prefix-matched).
- Login is rate-limited (10 attempts/minute/IP).
- Session cookies are `httpOnly`, `sameSite=lax`, and `secure` in
  production.
- Do not manually place symlinks inside `STORAGE_ROOT` that point outside
  it — `safePath` validates the logical path string, not the resolved
  symlink target.
- `STORAGE_ROOT` must already exist — the app itself never creates it,
  and refuses to start if it's missing, so a typo'd path fails loudly
  instead of silently landing uploads somewhere unintended. In Docker
  this check is undermined by Docker's own bind-mount auto-creation
  unless you start via `./scripts/docker-up.sh` (see above).
- Folder/file names starting with `.` are rejected outright (not just
  exact `.`/`..`). This blocks creating things like `.ssh` — if
  `STORAGE_ROOT`/`SFTP_HOST_DIR` ever ends up nested inside a real user's
  home directory, unrestricted dotfile creation would otherwise let an
  authenticated web user write `.ssh/authorized_keys` and gain SSH access.
- Uploads are checked twice against `ALLOWED_FILE_EXTENSIONS`:
  1. **Filename extension** (400/415, before the upload streams) — trusts
     the filename, which is attacker-controlled, so this alone only
     stops the obvious case (`.exe`, `.sh`, etc.).
  2. **Binary content signature** (415, after the file is fully written
     to a temp path, via `file-type`) — verifies the bytes actually match
     what the extension claims, so e.g. an executable renamed to `.pdf`
     is caught even though its filename passed step 1. Runs after the
     full write (not mid-stream) because office formats are zip
     containers whose central directory lives at the *end* of the file,
     so accurate detection needs random file access.
  Binary magic-number checking covers `pdf`, `zip`, `docx`, `xlsx`. `csv`
  has no magic number (it's plain text) but is still checked: the first
  8KB is sampled and rejected if it looks binary rather than textual (a
  UTF-16 BOM is allowed through, since UTF-16 text legitimately contains
  null bytes) — this is what catches a renamed non-text file, like a
  video, saved with a `.csv` extension. `doc`/`xls` (legacy OLE binary
  format) are the one true gap: `file-type` doesn't implement OLE
  fingerprinting at all, so those two rely on the extension check alone.
  The frontend also checks the extension client-side (`public/js/upload.js`)
  before starting an upload, purely for immediate feedback — it has no
  security value since it's trivially bypassable outside a browser; the
  backend does all real checks regardless.
- Before accepting an upload, the app checks that free space on the
  `STORAGE_ROOT` filesystem would stay at or above a 5GB reserve after the
  file lands (507 if not) — using `Content-Length` as a safe upper-bound
  estimate of the incoming file size, checked before a single byte is
  read. This exists because `MAX_UPLOAD_SIZE_BYTES` alone only caps a
  single file, not total disk usage — without a reserve, a valid login
  could still fill the disk via many uploads and starve the real SFTP
  service (or anything else) sharing that volume.
- Upload conflict detection is race-safe: the final write uses `link()`
  (fails atomically with `EEXIST` if a same-named file appears mid-upload)
  rather than `rename()` (which silently overwrites on POSIX), so two
  concurrent uploads of the same filename can't result in a silent
  overwrite — the loser gets a proper 409.
- Security headers (CSP, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options`, etc.) are set via `@fastify/helmet` on every response.
- State-changing requests (`POST`) are rejected with 403 if they carry an
  `Origin` header that doesn't match this app's own host — a defense-in-
  depth backstop on top of the `SameSite=Lax` session cookie, which is
  the primary CSRF protection.
- **`TRUST_PROXY=true` trusts `X-Forwarded-*` headers from *any* client
  that reaches the app directly**, not just your reverse proxy/Cloudflare.
  If the origin server is reachable without going through
  Cloudflare/nginx, a client can spoof `X-Forwarded-For` to defeat the
  login rate limiter, or spoof `X-Forwarded-Proto` in ways that interact
  with the secure-cookie logic. This app doesn't restrict `trustProxy` to
  a specific IP range — **firewall the origin so only your reverse
  proxy/Cloudflare can reach it**, which is the actual fix for this and
  isn't something app code alone can guarantee.

## Not included in this MVP

Delete/rename/move, multi-user accounts, and the actual SSH/SFTP (port 22)
protocol are intentionally out of scope. All can reuse `safePath.js` and
the existing route/service structure if added later.
