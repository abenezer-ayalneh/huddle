#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="${1:-$ROOT/dist/Huddle Control Agent.app}"
ARCHITECTURE="${ARCHITECTURE:-$(uname -m)}"
case "$ARCHITECTURE" in
  arm64|aarch64) ARCHITECTURE="arm64" ;;
  x86_64|amd64) ARCHITECTURE="x86_64" ;;
  *) echo "Unsupported ARCHITECTURE: $ARCHITECTURE" >&2; exit 1 ;;
esac
OUT="${2:-$ROOT/dist/Huddle-Control-Agent-macos-$ARCHITECTURE.dmg}"
[[ -d "$APP" ]] || { echo "Missing app bundle: $APP" >&2; exit 1; }
mkdir -p "$(dirname "$OUT")"
STAGING="$(mktemp -d "${TMPDIR:-/tmp}/huddle-control-agent-dmg.XXXXXX")"
trap 'rm -rf "$STAGING"' EXIT
ditto "$APP" "$STAGING/Huddle Control Agent.app"
ln -s /Applications "$STAGING/Applications"
hdiutil create -volname "Huddle Control Agent" -srcfolder "$STAGING" -ov -format UDZO "$OUT"
hdiutil verify "$OUT"
echo "Created $OUT"
