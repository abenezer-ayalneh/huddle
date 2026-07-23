#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DMG="${1:-$ROOT/dist/Huddle-Control-Agent-macos-$(uname -m).dmg}"
: "${NOTARY_KEY_ID:?Set NOTARY_KEY_ID for notarytool API-key authentication}"
: "${NOTARY_ISSUER:?Set NOTARY_ISSUER for notarytool API-key authentication}"
: "${NOTARY_KEY_PATH:?Set NOTARY_KEY_PATH to the App Store Connect .p8 key}"

xcrun notarytool submit "$DMG" \
  --key "$NOTARY_KEY_PATH" --key-id "$NOTARY_KEY_ID" --issuer "$NOTARY_ISSUER" \
  --wait
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"
spctl --assess --type open --context context:primary-signature --verbose "$DMG"
echo "Notarized and stapled $DMG"
