#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="${1:-$ROOT/dist/Huddle Control Agent.app}"
: "${DEVELOPER_ID_APPLICATION:?Set DEVELOPER_ID_APPLICATION to the Developer ID Application certificate name}"
: "${NOTARY_KEY_ID:?Set NOTARY_KEY_ID for notarytool API-key authentication}"
: "${NOTARY_ISSUER:?Set NOTARY_ISSUER for notarytool API-key authentication}"
: "${NOTARY_KEY_PATH:?Set NOTARY_KEY_PATH to the App Store Connect .p8 key}"

# Sign the embedded runtime frameworks before the outer app. `--deep` hides
# signing-order problems and can overwrite nested entitlements, so avoid it.
while IFS= read -r -d '' FRAMEWORK; do
  codesign --force --options runtime --timestamp \
    --sign "$DEVELOPER_ID_APPLICATION" "$FRAMEWORK"
done < <(find "$APP/Contents/Frameworks" -type d -name '*.framework' -prune -print0)

codesign --force --options runtime --timestamp \
  --entitlements "$ROOT/Entitlements.plist" \
  --sign "$DEVELOPER_ID_APPLICATION" "$APP"
codesign --verify --deep --strict --verbose "$APP"

ARCHIVE="${APP%.app}.zip"
ditto -c -k --keepParent "$APP" "$ARCHIVE"
xcrun notarytool submit "$ARCHIVE" \
  --key "$NOTARY_KEY_PATH" --key-id "$NOTARY_KEY_ID" --issuer "$NOTARY_ISSUER" \
  --wait
xcrun stapler staple "$APP"
spctl --assess --type execute --verbose "$APP"
echo "Signed and notarized $APP"
