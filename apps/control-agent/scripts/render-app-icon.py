#!/usr/bin/env python3
"""Render a 1024px Huddle icon source into a multi-resolution macOS ICNS."""

from pathlib import Path
import sys

from PIL import Image


SIZES = [(16, 16), (32, 32), (128, 128), (256, 256), (512, 512), (1024, 1024)]
REQUIRED_PIXEL_SIZES = {32, 64, 128, 256, 512, 1024}


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: render-app-icon.py <source.png> <output.icns>")

    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    image = Image.open(source).convert("RGBA")
    if image.size != (1024, 1024):
        raise SystemExit(f"Expected a 1024x1024 source, got {image.size[0]}x{image.size[1]}")

    image.save(output, format="ICNS", sizes=SIZES)
    with Image.open(output) as rendered:
        embedded = {width * scale for width, height, scale in rendered.info.get("sizes", []) if width == height}
    missing = REQUIRED_PIXEL_SIZES - embedded
    if missing:
        raise SystemExit(f"Generated ICNS is missing pixel sizes: {sorted(missing)}")


if __name__ == "__main__":
    main()
