#!/usr/bin/env bash
# Production deploy, run on the VPS by GitHub Actions (or by hand).
# Pulls main, rebuilds web/api, migrates the DB, health-checks the API.
# Safe to re-run. Assumes .env.prod and turn-certs/*.pem already exist (untracked,
# so `git reset --hard` leaves them alone) and Compose Caddy is the front door.
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root, regardless of where this is invoked from

COMPOSE="docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml --env-file .env.prod"

echo "==> Current revision (for rollback): $(git rev-parse --short HEAD)"

echo "==> Fetching and hard-resetting to origin/main"
git fetch --prune origin
git reset --hard origin/main
echo "==> Now at: $(git rev-parse --short HEAD)"

echo "==> Validating production configuration"
node scripts/validate-production-env.mjs --env .env.prod

mkdir -p infra/maintenance-state

echo "==> Building images"
$COMPOSE build

echo "==> Applying database migrations before the updated API starts"
$COMPOSE up -d postgres redis
$COMPOSE run --rm --no-deps api node node_modules/prisma/build/index.js migrate deploy

echo "==> Starting the updated stack"
$COMPOSE up -d

echo "==> Pruning dangling images"
docker image prune -f

echo "==> Health check (waiting up to 60s for API readiness)"
READY_URL="$(node scripts/validate-production-env.mjs --env .env.prod --print-ready-url)"
for i in $(seq 1 20); do
  if curl -fsS "$READY_URL" >/dev/null 2>&1; then
    echo "==> API ready (attempt $i)"
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "==> API failed readiness check after 60s" >&2
    curl -fsS "$READY_URL"
    exit 1
  fi
  sleep 3
done
echo "==> Deploy complete."
