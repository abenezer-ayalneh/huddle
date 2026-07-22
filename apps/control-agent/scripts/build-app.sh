#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${CONFIGURATION:-release}"
# TCC binds Screen Recording and Accessibility approval to the app's designated
# requirement. Prefer a persistent Apple Development identity for local builds;
# an ad-hoc signature gets a new identity every rebuild and loses that approval.
DEFAULT_SIGN_IDENTITY="$(security find-identity -v -p codesigning 2>/dev/null | awk -F '"' '/Apple Development:/ { print $2; exit }')"
SIGN_IDENTITY="${CODE_SIGN_IDENTITY:-$DEFAULT_SIGN_IDENTITY}"
SIGN_IDENTITY="${SIGN_IDENTITY:--}"
swift build --package-path "$ROOT" --configuration "$CONFIG"

BIN="$ROOT/.build/arm64-apple-macosx/$CONFIG/HuddleControlAgent"
if [[ ! -x "$BIN" ]]; then
  BIN="$ROOT/.build/$CONFIG/HuddleControlAgent"
fi
APP="$ROOT/dist/Huddle Control Agent.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$APP/Contents/Frameworks"
cp "$BIN" "$APP/Contents/MacOS/HuddleControlAgent"
cp "$ROOT/Info.plist" "$APP/Contents/Info.plist"
cp "$ROOT/Entitlements.plist" "$APP/Contents/Resources/Entitlements.plist"

BUILD_DIR="$(dirname "$BIN")"
for FRAMEWORK in RustLiveKitUniFFI.framework LiveKitWebRTC.framework; do
  SOURCE="$BUILD_DIR/$FRAMEWORK"
  DESTINATION="$APP/Contents/Frameworks/$FRAMEWORK"
  [[ -d "$SOURCE" ]] || { echo "Missing runtime framework: $SOURCE" >&2; exit 1; }
  ditto "$SOURCE" "$DESTINATION"
  # install_name_tool changes the copied Mach-O when it is later used as the
  # app executable, so give each embedded framework its own fresh local seal.
  codesign --force --sign "$SIGN_IDENTITY" "$DESTINATION"
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
echo "For distribution, sign with Developer ID + hardened runtime and notarize the app before publishing it."
