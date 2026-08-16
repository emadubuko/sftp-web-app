#!/usr/bin/env bash
# Starts the app via docker compose, but first verifies SFTP_HOST_DIR
# actually exists on the host.
#
# This check exists because Docker's own bind-mount behavior silently
# auto-creates the host-side directory if it's missing, *before* the
# container (and this app's own STORAGE_ROOT existence check) ever sees
# it — so a typo'd or unset SFTP_HOST_DIR would otherwise fail silently by
# starting the app against a fresh empty directory instead of your real
# SFTP folder. Run this script instead of `docker compose up` directly.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Error: .env not found. Copy .env.example to .env and fill it in first." >&2
  exit 1
fi

SFTP_HOST_DIR=$(grep -E '^SFTP_HOST_DIR=' .env | tail -1 | cut -d= -f2-)

if [ -z "${SFTP_HOST_DIR:-}" ]; then
  echo "Error: SFTP_HOST_DIR is not set in .env." >&2
  exit 1
fi

if [ ! -d "$SFTP_HOST_DIR" ]; then
  echo "Error: SFTP_HOST_DIR ($SFTP_HOST_DIR) does not exist." >&2
  echo "Point it at your real, already-existing SFTP upload directory." >&2
  exit 1
fi

exec docker compose up --build -d "$@"
