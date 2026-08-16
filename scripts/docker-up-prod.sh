#!/usr/bin/env bash
# Starts the app on the server from the pushed Docker Hub image
# (gghn/sftp-web-app), using docker-compose.prod.yml instead of the dev
# docker-compose.yml (which builds from local source).
#
# A production deploy only needs three files sitting together in one
# directory: this script, docker-compose.prod.yml, and .env — the full
# source tree isn't required since the image is pulled pre-built. This
# script always operates relative to its OWN location (not a parent
# "project root"), so it works wherever those three files are placed.
#
# Same SFTP_HOST_DIR preflight check as scripts/docker-up.sh: Docker's own
# bind-mount behavior silently auto-creates the host-side directory if
# it's missing, before the container ever sees it — so a typo'd or unset
# SFTP_HOST_DIR would otherwise fail silently instead of loudly. Run this
# script instead of `docker compose -f docker-compose.prod.yml up` directly.
set -euo pipefail
cd "$(dirname "$0")"

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

docker compose -f docker-compose.prod.yml pull
exec docker compose -f docker-compose.prod.yml up -d "$@"
