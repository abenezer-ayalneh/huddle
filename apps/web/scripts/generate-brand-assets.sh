#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(cd "$SCRIPT_DIRECTORY/.." && pwd)"
PUBLIC_DIRECTORY="$WEB_ROOT/public"
APP_DIRECTORY="$WEB_ROOT/src/app"
SOURCE="$PUBLIC_DIRECTORY/logo.svg"
DARK_FAVICON_SOURCE="$PUBLIC_DIRECTORY/favicon-dark.svg"
SOCIAL_SOURCE="$PUBLIC_DIRECTORY/social-preview.svg"

command -v magick >/dev/null || { echo "ImageMagick (magick) is required to generate brand assets." >&2; exit 1; }
[[ -f "$SOURCE" ]] || { echo "Missing logo source: $SOURCE" >&2; exit 1; }
[[ -f "$DARK_FAVICON_SOURCE" ]] || { echo "Missing dark favicon source: $DARK_FAVICON_SOURCE" >&2; exit 1; }
[[ -f "$SOCIAL_SOURCE" ]] || { echo "Missing social preview source: $SOCIAL_SOURCE" >&2; exit 1; }
[[ "$PUBLIC_DIRECTORY" == */apps/web/public ]] || { echo "Unexpected public output directory: $PUBLIC_DIRECTORY" >&2; exit 1; }
[[ "$APP_DIRECTORY" == */apps/web/src/app ]] || { echo "Unexpected app output directory: $APP_DIRECTORY" >&2; exit 1; }

WORK_DIRECTORY="$(mktemp -d "${TMPDIR:-/tmp}/huddle-brand-assets.XXXXXX")"
trap 'rm -rf "$WORK_DIRECTORY"' EXIT

render_transparent() {
  local source="$1"
  local size="$2"
  local mark_size="$3"
  local output="$4"
  magick -background none "$source" -resize "${mark_size}x${mark_size}" -gravity center -extent "${size}x${size}" -strip -depth 8 -define png:color-type=6 "$output"
}

render_on_cream() {
  local size="$1"
  local mark_size="$2"
  local output="$3"
  local mark="$WORK_DIRECTORY/mark-${size}-${mark_size}.png"
  magick -background none "$SOURCE" -resize "${mark_size}x${mark_size}" -strip -depth 8 -define png:color-type=6 "$mark"
  magick -size "${size}x${size}" canvas:'#F6EEDB' "$mark" -gravity center -composite -strip -depth 8 -define png:color-type=6 "$output"
}

render_transparent "$SOURCE" 16 14 "$PUBLIC_DIRECTORY/favicon-16x16.png"
render_transparent "$SOURCE" 32 28 "$PUBLIC_DIRECTORY/favicon-32x32.png"
render_transparent "$SOURCE" 48 42 "$WORK_DIRECTORY/favicon-48x48.png"
magick "$PUBLIC_DIRECTORY/favicon-16x16.png" "$PUBLIC_DIRECTORY/favicon-32x32.png" "$WORK_DIRECTORY/favicon-48x48.png" "$PUBLIC_DIRECTORY/favicon.ico"

render_transparent "$DARK_FAVICON_SOURCE" 16 14 "$PUBLIC_DIRECTORY/favicon-dark-16x16.png"
render_transparent "$DARK_FAVICON_SOURCE" 32 28 "$PUBLIC_DIRECTORY/favicon-dark-32x32.png"
render_transparent "$DARK_FAVICON_SOURCE" 48 42 "$WORK_DIRECTORY/favicon-dark-48x48.png"
magick "$PUBLIC_DIRECTORY/favicon-dark-16x16.png" "$PUBLIC_DIRECTORY/favicon-dark-32x32.png" "$WORK_DIRECTORY/favicon-dark-48x48.png" "$PUBLIC_DIRECTORY/favicon-dark.ico"

render_on_cream 180 132 "$PUBLIC_DIRECTORY/apple-touch-icon.png"
render_on_cream 192 144 "$PUBLIC_DIRECTORY/icon-192.png"
render_on_cream 512 384 "$PUBLIC_DIRECTORY/icon-512.png"
render_on_cream 512 300 "$PUBLIC_DIRECTORY/icon-maskable-512.png"

magick -background none "$SOCIAL_SOURCE" -resize 1200x630! -strip -depth 8 "$PUBLIC_DIRECTORY/opengraph-image.png"
cp "$PUBLIC_DIRECTORY/opengraph-image.png" "$PUBLIC_DIRECTORY/twitter-image.png"

cp "$SOURCE" "$APP_DIRECTORY/icon.svg"
for asset in apple-touch-icon.png favicon-16x16.png favicon-32x32.png favicon-dark.svg favicon-dark-16x16.png favicon-dark-32x32.png favicon-dark.ico icon-192.png icon-512.png opengraph-image.png twitter-image.png; do
  cp "$PUBLIC_DIRECTORY/$asset" "$APP_DIRECTORY/$asset"
done

echo "Generated Huddle SVG, light/dark favicons, app, maskable, Apple touch, and social assets."
