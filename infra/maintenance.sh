#!/usr/bin/env bash
# Run over SSH from the deployment checkout. Never opens a public admin API.
set -euo pipefail
cd "$(dirname "$0")/.."
compose=(docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml --env-file .env.prod)
command="${1:-status}"
mkdir -p infra/maintenance-state
case "$command" in
  on)
    # Validate the deployed configuration before changing the override marker.
    "${compose[@]}" exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
    # This waits the full five minutes and verifies LiveKit rooms have ended.
    "${compose[@]}" run --rm --no-deps api node dist/maintenance-operator.js on
    touch infra/maintenance-state/enabled
    echo 'Static maintenance page enabled. Use off to restore Huddle.'
    ;;
  off)
    # Clear application state first. A failure leaves the static page intact.
    "${compose[@]}" run --rm --no-deps api node dist/maintenance-operator.js off
    rm -f infra/maintenance-state/enabled
    echo 'Maintenance disabled.'
    ;;
  status)
    if [[ -f infra/maintenance-state/enabled ]]; then echo 'Static override: on'; else echo 'Static override: off'; fi
    "${compose[@]}" run --rm --no-deps api node dist/maintenance-operator.js status
    ;;
  owner)
    "${compose[@]}" run --rm --no-deps api node dist/maintenance-operator.js owner "${2:?Supply the owner email}"
    ;;
  *) echo 'Usage: bash infra/maintenance.sh on|off|status|owner [email]' >&2; exit 2 ;;
esac
