#!/usr/bin/env bash
set -euo pipefail

# Build the zero-cost Apple-Silicon beta. Sparkle's Ed25519 signature verifies
# each updater archive, but this remains separate from the Developer
# ID/notarization release helpers and retains Gatekeeper's explicit Open Anyway
# requirement.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${AGENT_VERSION:-$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$ROOT/Info.plist")}"
BUILD_VERSION="${AGENT_BUILD_VERSION:-$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$ROOT/Info.plist")}"
REPOSITORY="${GITHUB_REPOSITORY:-abenezer-ayalneh/huddle}"
CHANNEL_TAG="${CONTROL_AGENT_FREE_BETA_TAG:-control-agent-free-beta}"
KEYCHAIN_ACCOUNT="${CONTROL_AGENT_FREE_BETA_KEYCHAIN_ACCOUNT:-huddle-control-agent-free-beta}"
DMG="$ROOT/dist/Huddle-Control-Agent-macos-arm64.dmg"
CHECKSUM="$DMG.sha256"
KEY_TOOL="$ROOT/.build/artifacts/sparkle/Sparkle/bin/generate_keys"
DEFAULT_SIGN_IDENTITY="$(security find-identity -v -p codesigning 2>/dev/null | awk -F '\"' '/Apple Development:|Developer ID Application:/ { print $2; exit }')"
SIGN_IDENTITY="${CODE_SIGN_IDENTITY:-$DEFAULT_SIGN_IDENTITY}"

# TCC keys Screen Recording and Accessibility approval to this identity. An
# ad-hoc signature changes with every binary, which makes an updater release
# appear to lose those permissions even though System Settings retains the old
# entry. Never publish an updater-enabled beta in that state.
if [[ -z "$SIGN_IDENTITY" || "$SIGN_IDENTITY" == "-" ]]; then
  echo "A persistent Apple Development or Developer ID Application identity is required for updater-enabled betas." >&2
  echo "Install one, then set CODE_SIGN_IDENTITY to that identity and rebuild." >&2
  exit 1
fi

# The private key stays in the publisher's login Keychain. Supplying a public
# key explicitly is useful for reproducible CI-like validation, but publishing
# always signs with the Keychain account below.
swift package resolve --package-path "$ROOT"
if [[ -z "${SPARKLE_UPDATE_PUBLIC_KEY:-}" ]]; then
  [[ -x "$KEY_TOOL" ]] || { echo "Missing Sparkle generate_keys tool after package resolution." >&2; exit 1; }
  SPARKLE_UPDATE_PUBLIC_KEY="$("$KEY_TOOL" --account "$KEYCHAIN_ACCOUNT" -p)" || {
    echo "Create the local update key once with: $ROOT/scripts/configure-free-beta-updater.sh" >&2
    exit 1
  }
fi

SPARKLE_UPDATE_FEED_URL="https://github.com/$REPOSITORY/releases/download/$CHANNEL_TAG/appcast-arm64.xml"

CODE_SIGN_IDENTITY="$SIGN_IDENTITY" ARCHITECTURE=arm64 AGENT_VERSION="$VERSION" AGENT_BUILD_VERSION="$BUILD_VERSION" \
  SPARKLE_UPDATE_PUBLIC_KEY="$SPARKLE_UPDATE_PUBLIC_KEY" SPARKLE_UPDATE_FEED_URL="$SPARKLE_UPDATE_FEED_URL" \
  "$ROOT/scripts/build-app.sh"
ARCHITECTURE=arm64 "$ROOT/scripts/package-dmg.sh" "$ROOT/dist/Huddle Control Agent.app" "$DMG"

hdiutil verify "$DMG"
codesign --verify --deep --strict "$ROOT/dist/Huddle Control Agent.app"
lipo -info "$ROOT/dist/Huddle Control Agent.app/Contents/MacOS/HuddleControlAgent" | grep -qx 'Non-fat file: .* is architecture: arm64'
(cd "$(dirname "$DMG")" && shasum -a 256 "$(basename "$DMG")") > "$CHECKSUM"

echo "Built persistent-identity, unnotarized Apple-Silicon beta: $DMG"
echo "Checksum: $CHECKSUM"
echo "Sparkle updates use Keychain account: $KEYCHAIN_ACCOUNT"
