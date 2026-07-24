#!/usr/bin/env bash
set -euo pipefail

# Build the deliberately untrusted, zero-cost Apple-Silicon beta. This is kept
# separate from the Developer ID/notarization release helpers so callers cannot
# mistake one distribution path for the other.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${AGENT_VERSION:-0.1.0}"
BUILD_VERSION="${AGENT_BUILD_VERSION:-1}"
DMG="$ROOT/dist/Huddle-Control-Agent-macos-arm64.dmg"
CHECKSUM="$DMG.sha256"

ARCHITECTURE=arm64 CODE_SIGN_IDENTITY=- AGENT_VERSION="$VERSION" AGENT_BUILD_VERSION="$BUILD_VERSION" "$ROOT/scripts/build-app.sh"
ARCHITECTURE=arm64 "$ROOT/scripts/package-dmg.sh" "$ROOT/dist/Huddle Control Agent.app" "$DMG"

hdiutil verify "$DMG"
codesign --verify --deep --strict "$ROOT/dist/Huddle Control Agent.app"
lipo -info "$ROOT/dist/Huddle Control Agent.app/Contents/MacOS/HuddleControlAgent" | grep -qx 'Non-fat file: .* is architecture: arm64'
(cd "$(dirname "$DMG")" && shasum -a 256 "$(basename "$DMG")") > "$CHECKSUM"

echo "Built no-cost, unnotarized Apple-Silicon beta: $DMG"
echo "Checksum: $CHECKSUM"
echo "Do not describe this artifact as Developer ID signed or notarized."
