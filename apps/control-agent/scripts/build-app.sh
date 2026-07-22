#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${CONFIGURATION:-release}"
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
  codesign --force --sign - "$DESTINATION"
done

# SwiftPM gives the executable an @loader_path rpath for its build directory.
# A distributed .app keeps third-party frameworks in Contents/Frameworks, so
# add the bundle-relative lookup path before its local ad-hoc signature.
install_name_tool -add_rpath "@executable_path/../Frameworks" "$APP/Contents/MacOS/HuddleControlAgent"
codesign --force --sign - "$APP"
codesign --verify --deep --strict "$APP"

echo "Built unsigned $APP"
echo "For distribution, sign with Developer ID + hardened runtime and notarize the app before publishing it."
