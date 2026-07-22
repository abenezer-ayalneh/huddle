#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="${1:-$ROOT/dist/Huddle Control Agent.app}"
OUT="${2:-$ROOT/dist/Huddle-Control-Agent.dmg}"
[[ -d "$APP" ]] || { echo "Missing app bundle: $APP" >&2; exit 1; }
mkdir -p "$(dirname "$OUT")"
hdiutil create -volname "Huddle Control Agent" -srcfolder "$APP" -ov -format UDZO "$OUT"
echo "Created $OUT"
