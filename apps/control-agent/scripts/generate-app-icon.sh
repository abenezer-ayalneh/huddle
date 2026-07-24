#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${1:-$ROOT/Resources/AppIcon.svg}"
OUTPUT="${2:-$ROOT/Resources/AppIcon.icns}"

command -v magick >/dev/null || { echo "ImageMagick (magick) is required to generate the app icon." >&2; exit 1; }
command -v python3 >/dev/null || { echo "Python 3 with Pillow is required to generate the app icon." >&2; exit 1; }
python3 -c "from PIL import Image" >/dev/null 2>&1 || { echo "Python Pillow is required to generate the app icon." >&2; exit 1; }
[[ -f "$SOURCE" ]] || { echo "Missing icon source: $SOURCE" >&2; exit 1; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/huddle-control-agent-icon.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
MASTER="$WORK/AppIcon-1024.png"
mkdir -p "$(dirname "$OUTPUT")"
magick -background none "$SOURCE" -resize 1024x1024 -strip -depth 8 -define png:color-type=6 "$MASTER"
python3 "$ROOT/scripts/render-app-icon.py" "$MASTER" "$OUTPUT"
echo "Generated $OUTPUT"
