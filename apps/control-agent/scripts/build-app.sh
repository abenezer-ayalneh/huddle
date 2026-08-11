#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${CONFIGURATION:-release}"
ARCHITECTURE="${ARCHITECTURE:-$(uname -m)}"
case "$ARCHITECTURE" in
  arm64|aarch64) ARCHITECTURE="arm64"; TARGET="arm64-apple-macosx" ;;
  x86_64|amd64) ARCHITECTURE="x86_64"; TARGET="x86_64-apple-macosx" ;;
  *) echo "Unsupported ARCHITECTURE: $ARCHITECTURE" >&2; exit 1 ;;
esac
# TCC binds Screen Recording and Accessibility approval to the app's designated
# requirement. Prefer a persistent Apple Development identity for local builds;
# an ad-hoc signature gets a new identity every rebuild and loses that approval.
DEFAULT_SIGN_IDENTITY="$(security find-identity -v -p codesigning 2>/dev/null | awk -F '"' '/Apple Development:/ { print $2; exit }')"
SIGN_IDENTITY="${CODE_SIGN_IDENTITY:-$DEFAULT_SIGN_IDENTITY}"
SIGN_IDENTITY="${SIGN_IDENTITY:--}"
swift build --package-path "$ROOT" --configuration "$CONFIG" --arch "$ARCHITECTURE"

BIN="$ROOT/.build/$TARGET/$CONFIG/HuddleControlAgent"
if [[ ! -x "$BIN" ]]; then
  BIN="$ROOT/.build/$CONFIG/HuddleControlAgent"
fi
APP="$ROOT/dist/Huddle Control Agent.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$APP/Contents/Frameworks"
cp "$BIN" "$APP/Contents/MacOS/HuddleControlAgent"
cp "$ROOT/Info.plist" "$APP/Contents/Info.plist"
cp "$ROOT/Entitlements.plist" "$APP/Contents/Resources/Entitlements.plist"
cp "$ROOT/Resources/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
if [[ -n "${AGENT_VERSION:-}" ]]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $AGENT_VERSION" "$APP/Contents/Info.plist"
fi
if [[ -n "${AGENT_BUILD_VERSION:-}" ]]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $AGENT_BUILD_VERSION" "$APP/Contents/Info.plist"
fi
if [[ -n "${CONTROL_AGENT_UPDATE_PUBLIC_KEY:-}" ]]; then
  /usr/libexec/PlistBuddy -c "Set :ControlAgentUpdatePublicKey $CONTROL_AGENT_UPDATE_PUBLIC_KEY" "$APP/Contents/Info.plist"
fi
if [[ -n "${CONTROL_AGENT_RELEASE_CHANNEL_URL:-}" ]]; then
  /usr/libexec/PlistBuddy -c "Set :ControlAgentReleaseChannelURL $CONTROL_AGENT_RELEASE_CHANNEL_URL" "$APP/Contents/Info.plist"
fi
if [[ -n "${SPARKLE_UPDATE_PUBLIC_KEY:-}" ]]; then
  /usr/libexec/PlistBuddy -c "Set :SUPublicEDKey $SPARKLE_UPDATE_PUBLIC_KEY" "$APP/Contents/Info.plist"
fi
if [[ -n "${SPARKLE_UPDATE_FEED_URL:-}" ]]; then
  /usr/libexec/PlistBuddy -c "Set :SUFeedURL $SPARKLE_UPDATE_FEED_URL" "$APP/Contents/Info.plist"
fi

BUILD_DIR="$(dirname "$BIN")"
for FRAMEWORK in RustLiveKitUniFFI.framework LiveKitWebRTC.framework Sparkle.framework; do
  SOURCE="$BUILD_DIR/$FRAMEWORK"
  if [[ ! -d "$SOURCE" ]]; then
    SOURCE="$(find "$ROOT/.build/artifacts" -type d -name "$FRAMEWORK" -print -quit 2>/dev/null || true)"
  fi
  DESTINATION="$APP/Contents/Frameworks/$FRAMEWORK"
  [[ -d "$SOURCE" ]] || { echo "Missing runtime framework: $SOURCE" >&2; exit 1; }
  ditto "$SOURCE" "$DESTINATION"
  # Sparkle includes helper binaries inside its framework. Sign nested code
  # before the outer app so both ad-hoc beta builds and Developer ID builds
  # retain a valid bundle seal.
  codesign --force --deep --sign "$SIGN_IDENTITY" "$DESTINATION"
done

# SwiftPM gives the executable an @loader_path rpath for its build directory.
# A distributed .app keeps third-party frameworks in Contents/Frameworks, so
# add the bundle-relative lookup path before its local ad-hoc signature.
install_name_tool -add_rpath "@executable_path/../Frameworks" "$APP/Contents/MacOS/HuddleControlAgent"
codesign --force --sign "$SIGN_IDENTITY" --entitlements "$ROOT/Entitlements.plist" "$APP"
codesign --verify --deep --strict "$APP"

if [[ "$SIGN_IDENTITY" == "-" ]]; then
  echo "Built ad-hoc signed $APP"
  echo "Warning: macOS treats every ad-hoc rebuild as a new privacy client. Set CODE_SIGN_IDENTITY to an Apple Development identity to retain permissions."
else
  echo "Built locally signed $APP with $SIGN_IDENTITY"
fi
echo "Built architecture: $ARCHITECTURE"
echo "For distribution, sign with Developer ID + hardened runtime and notarize the app before publishing it."
