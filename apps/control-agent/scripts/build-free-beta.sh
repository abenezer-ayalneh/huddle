#!/usr/bin/env bash
set -euo pipefail

# Build the public Apple-Silicon beta. It retains Gatekeeper's explicit Open
# Anyway requirement and is distributed with a SHA-256 checksum.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${AGENT_VERSION:-$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$ROOT/Info.plist")}"
BUILD_VERSION="${AGENT_BUILD_VERSION:-$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$ROOT/Info.plist")}"
DMG="$ROOT/dist/Huddle-Control-Agent-macos-arm64.dmg"
CHECKSUM="$DMG.sha256"

CODE_SIGN_IDENTITY=- ARCHITECTURE=arm64 AGENT_VERSION="$VERSION" AGENT_BUILD_VERSION="$BUILD_VERSION" "$ROOT/scripts/build-app.sh"
ARCHITECTURE=arm64 "$ROOT/scripts/package-dmg.sh" "$ROOT/dist/Huddle Control Agent.app" "$DMG"

hdiutil verify "$DMG"
codesign --verify --deep --strict "$ROOT/dist/Huddle Control Agent.app"
lipo -info "$ROOT/dist/Huddle Control Agent.app/Contents/MacOS/HuddleControlAgent" | grep -qx 'Non-fat file: .* is architecture: arm64'
(cd "$(dirname "$DMG")" && shasum -a 256 "$(basename "$DMG")") > "$CHECKSUM"

echo "Built unsigned, unnotarized Apple-Silicon beta: $DMG"
echo "Checksum: $CHECKSUM"
