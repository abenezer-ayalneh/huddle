#!/usr/bin/env bash
set -euo pipefail

# Build the deliberately untrusted, zero-cost Apple-Silicon beta. Sparkle's
# Ed25519 signature verifies each updater archive, but this remains separate
# from the Developer ID/notarization release helpers and retains Gatekeeper's
# explicit Open Anyway requirement.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${AGENT_VERSION:-0.1.2}"
BUILD_VERSION="${AGENT_BUILD_VERSION:-3}"
REPOSITORY="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
CHANNEL_TAG="${CONTROL_AGENT_FREE_BETA_TAG:-control-agent-free-beta}"
KEYCHAIN_ACCOUNT="${CONTROL_AGENT_FREE_BETA_KEYCHAIN_ACCOUNT:-huddle-control-agent-free-beta}"
DMG="$ROOT/dist/Huddle-Control-Agent-macos-arm64.dmg"
CHECKSUM="$DMG.sha256"
KEY_TOOL="$ROOT/.build/artifacts/sparkle/Sparkle/bin/generate_keys"

# Keep the private update key in the local login Keychain. No Developer ID,
# notarization credential, private-key export, or GitHub Actions secret is
# required for this ad-hoc beta path.
swift package resolve --package-path "$ROOT"
if [[ -z "${SPARKLE_UPDATE_PUBLIC_KEY:-}" ]]; then
  [[ -x "$KEY_TOOL" ]] || { echo "Missing Sparkle generate_keys tool after package resolution." >&2; exit 1; }
  SPARKLE_UPDATE_PUBLIC_KEY="$("$KEY_TOOL" --account "$KEYCHAIN_ACCOUNT" -p)" || {
    echo "Create the local update key once with: $KEY_TOOL --account $KEYCHAIN_ACCOUNT" >&2
    exit 1
  }
fi

SPARKLE_UPDATE_FEED_URL="https://github.com/$REPOSITORY/releases/download/$CHANNEL_TAG/appcast-arm64.xml"

ARCHITECTURE=arm64 CODE_SIGN_IDENTITY=- AGENT_VERSION="$VERSION" AGENT_BUILD_VERSION="$BUILD_VERSION" \
  SPARKLE_UPDATE_PUBLIC_KEY="$SPARKLE_UPDATE_PUBLIC_KEY" SPARKLE_UPDATE_FEED_URL="$SPARKLE_UPDATE_FEED_URL" \
  "$ROOT/scripts/build-app.sh"
ARCHITECTURE=arm64 "$ROOT/scripts/package-dmg.sh" "$ROOT/dist/Huddle Control Agent.app" "$DMG"

hdiutil verify "$DMG"
codesign --verify --deep --strict "$ROOT/dist/Huddle Control Agent.app"
lipo -info "$ROOT/dist/Huddle Control Agent.app/Contents/MacOS/HuddleControlAgent" | grep -qx 'Non-fat file: .* is architecture: arm64'
(cd "$(dirname "$DMG")" && shasum -a 256 "$(basename "$DMG")") > "$CHECKSUM"

echo "Built no-cost, unnotarized Apple-Silicon beta: $DMG"
echo "Checksum: $CHECKSUM"
echo "Sparkle updates use Keychain account: $KEYCHAIN_ACCOUNT"
echo "Do not describe this artifact as Developer ID signed or notarized."
