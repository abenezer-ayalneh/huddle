#!/usr/bin/env bash
set -euo pipefail

# Publish only the output made by build-free-beta.sh. GitHub Releases gives this
# public beta a zero-cost download URL; it is intentionally not the trusted
# Developer ID release channel.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPOSITORY="${GITHUB_REPOSITORY:-abenezer-ayalneh/huddle}"
TAG="${CONTROL_AGENT_FREE_BETA_TAG:-control-agent-free-beta}"
DMG="$ROOT/dist/Huddle-Control-Agent-macos-arm64.dmg"
CHECKSUM="$DMG.sha256"

[[ -f "$DMG" && -f "$CHECKSUM" ]] || {
  echo "Build the no-cost beta first: ./apps/control-agent/scripts/build-free-beta.sh" >&2
  exit 1
}

gh auth status -h github.com

if gh release view "$TAG" --repo "$REPOSITORY" >/dev/null 2>&1; then
  gh release upload "$TAG" "$DMG" "$CHECKSUM" --repo "$REPOSITORY" --clobber
else
  gh release create "$TAG" "$DMG" "$CHECKSUM" --repo "$REPOSITORY" --target main --prerelease \
    --title 'Huddle Control Agent · Apple Silicon no-cost beta' \
    --notes 'Unnotarized Apple-Silicon beta. Verify the attached SHA-256 checksum before opening the DMG, then use macOS Privacy & Security → Open Anyway. This release has no automatic update channel.'
fi

echo "Published https://github.com/$REPOSITORY/releases/tag/$TAG"
