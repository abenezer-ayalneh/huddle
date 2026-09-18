#!/usr/bin/env bash
set -euo pipefail

# Publish only the output made by build-free-beta.sh. This remains an ad-hoc,
# unnotarized public beta, but its immutable updater archive and appcast are
# signed with the local Sparkle Ed25519 key in the login Keychain.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPOSITORY="${GITHUB_REPOSITORY:-abenezer-ayalneh/huddle}"
TAG="${CONTROL_AGENT_FREE_BETA_TAG:-control-agent-free-beta}"
KEYCHAIN_ACCOUNT="${CONTROL_AGENT_FREE_BETA_KEYCHAIN_ACCOUNT:-huddle-control-agent-free-beta}"
DMG="$ROOT/dist/Huddle-Control-Agent-macos-arm64.dmg"
CHECKSUM="$DMG.sha256"
APP="$ROOT/dist/Huddle Control Agent.app"
APPCAST="$ROOT/dist/appcast-arm64.xml"
APPCAST_TOOL="$ROOT/.build/artifacts/sparkle/Sparkle/bin/generate_appcast"
KEY_TOOL="$ROOT/.build/artifacts/sparkle/Sparkle/bin/generate_keys"

release_has_asset() {
  local release_tag="$1"
  local asset_name="$2"
  gh release view "$release_tag" --repo "$REPOSITORY" --json assets --jq '.assets[].name' | grep -Fqx "$asset_name"
}

[[ -f "$DMG" && -f "$CHECKSUM" && -d "$APP" ]] || {
  echo "Build the no-cost beta first: ./apps/control-agent/scripts/build-free-beta.sh" >&2
  exit 1
}

gh auth status -h github.com
[[ -x "$APPCAST_TOOL" ]] || { echo "Missing Sparkle generate_appcast tool. Rebuild the beta first." >&2; exit 1; }
[[ -x "$KEY_TOOL" ]] || { echo "Missing Sparkle generate_keys tool. Rebuild the beta first." >&2; exit 1; }
"$KEY_TOOL" --account "$KEYCHAIN_ACCOUNT" -p >/dev/null || {
  echo "Create the local update key first: $ROOT/scripts/configure-free-beta-updater.sh" >&2
  exit 1
}

VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist")"
BUILD_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP/Contents/Info.plist")"
VERSION_TAG="${CONTROL_AGENT_FREE_BETA_VERSION_TAG:-control-agent-free-beta-v${VERSION}-b${BUILD_VERSION}}"
ASSET_NAME="Huddle-Control-Agent-macos-arm64-${VERSION}-${BUILD_VERSION}.dmg"
CHECKSUM_NAME="$ASSET_NAME.sha256"
STAGING="$(mktemp -d "${TMPDIR:-/tmp}/huddle-sparkle-appcast.XXXXXX")"
trap 'rm -rf "$STAGING"' EXIT

cp "$DMG" "$STAGING/$ASSET_NAME"
SOURCE_HASH="$(shasum -a 256 "$DMG" | awk '{print $1}')"
[[ "$SOURCE_HASH" == "$(awk 'NR == 1 { print $1 }' "$CHECKSUM")" ]] || {
  echo "The beta checksum does not match its DMG. Rebuild before publishing." >&2
  exit 1
}
(cd "$STAGING" && shasum -a 256 "$ASSET_NAME") > "$STAGING/$CHECKSUM_NAME"

# Versioned releases are immutable download sources for Sparkle. The permanent
# beta channel holds the mutable, signed appcast and the current manual DMG.
if gh release view "$VERSION_TAG" --repo "$REPOSITORY" >/dev/null 2>&1; then
  gh release download "$VERSION_TAG" --repo "$REPOSITORY" --pattern "$CHECKSUM_NAME" --dir "$STAGING" --clobber
  [[ "$SOURCE_HASH" == "$(awk 'NR == 1 { print $1 }' "$STAGING/$CHECKSUM_NAME")" ]] || {
    echo "Immutable release $VERSION_TAG already exists with different bytes. Increase AGENT_BUILD_VERSION." >&2
    exit 1
  }
else
  gh release create "$VERSION_TAG" "$STAGING/$ASSET_NAME" "$STAGING/$CHECKSUM_NAME" --repo "$REPOSITORY" --target main --prerelease \
    --title "Huddle Control Agent $VERSION ($BUILD_VERSION) · Apple Silicon no-cost beta" \
    --notes 'Ad-hoc signed and unnotarized Apple-Silicon beta. Verify the SHA-256 checksum, then use macOS Privacy & Security → Open Anyway. Grant Screen Recording and Accessibility again for this installed release. The archive is an immutable source for the Ed25519-signed Sparkle update channel.'
fi

for asset_name in "$ASSET_NAME" "$CHECKSUM_NAME"; do
  release_has_asset "$VERSION_TAG" "$asset_name" || {
    echo "Immutable release $VERSION_TAG is missing $asset_name. Do not advance the update channel." >&2
    exit 1
  }
done

# The permanent appcast is a one-item pointer to the current immutable release.
# Start fresh rather than merge a prior feed: stale or duplicate entries can
# otherwise retain malformed archive URLs after an appcast repair.
rm -f "$APPCAST"
"$APPCAST_TOOL" --account "$KEYCHAIN_ACCOUNT" \
  --download-url-prefix "https://github.com/$REPOSITORY/releases/download/$VERSION_TAG/" \
  --versions "$BUILD_VERSION" \
  -o "$APPCAST" \
  "$STAGING"

if ! gh release view "$TAG" --repo "$REPOSITORY" >/dev/null 2>&1; then
  gh release create "$TAG" --repo "$REPOSITORY" --target main --prerelease \
    --title 'Huddle Control Agent · Apple Silicon no-cost beta' \
    --notes 'Ad-hoc signed and unnotarized Apple-Silicon beta. Verify the attached SHA-256 checksum before opening the DMG, then use macOS Privacy & Security → Open Anyway. Grant Screen Recording and Accessibility again for this installed release. Installed versions with the Sparkle updater receive only immutable Ed25519-signed archives from this channel.'
fi

for asset_path in "$DMG" "$CHECKSUM" "$APPCAST"; do
  gh release upload "$TAG" "$asset_path" --repo "$REPOSITORY" --clobber
done
gh release edit "$TAG" --repo "$REPOSITORY" --title 'Huddle Control Agent · Apple Silicon no-cost beta' \
  --notes 'Ad-hoc signed and unnotarized Apple-Silicon beta. Verify the attached SHA-256 checksum before opening the DMG, then use macOS Privacy & Security → Open Anyway. Grant Screen Recording and Accessibility again for this installed release. Installed versions with the Sparkle updater receive only immutable Ed25519-signed archives from this channel.'

for asset_name in "$(basename "$DMG")" "$(basename "$CHECKSUM")" "$(basename "$APPCAST")"; do
  release_has_asset "$TAG" "$asset_name" || {
    echo "Permanent release $TAG is missing $asset_name. Do not declare this rollout complete." >&2
    exit 1
  }
done

echo "Published https://github.com/$REPOSITORY/releases/tag/$TAG"
