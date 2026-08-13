#!/usr/bin/env python3
"""Extract the dominant color palette from a Mobbin screenshot.

Downsamples the image to a small grid and reports the most frequent colors
as hex values, ordered by frequency. Useful for capturing a screen's visual
tone (background, accent colors) for design-spec reports.

Usage:
    extract_palette.py <image-path> [--top N] [--sample PX]

Example:
    extract_palette.py screens/7336baf0-22a8-4e07-be82-59bd383432a4.png --top 6

Requires: Pillow (pip install Pillow)
Exit codes: 0 on success, 1 on failure.
"""

import argparse
import sys
from collections import Counter

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow is required (pip install Pillow)", file=sys.stderr)
    sys.exit(1)


def extract_palette(image_path: str, top: int = 6, sample: int = 64) -> list[str]:
    with Image.open(image_path) as img:
        rgb = img.convert("RGB")
        small = rgb.resize((sample, sample))
        counts = Counter(small.getdata())
        most_common = counts.most_common(top)
        return [f"#{r:02X}{g:02X}{b:02X}" for (r, g, b), _ in most_common]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", help="Path to the screenshot image")
    parser.add_argument("--top", type=int, default=6, help="Colors to report (default: 6)")
    parser.add_argument("--sample", type=int, default=64, help="Sample grid size (default: 64)")
    args = parser.parse_args()

    try:
        palette = extract_palette(args.image, top=args.top, sample=args.sample)
        for color in palette:
            print(color)
        return 0
    except Exception as error:  # noqa: BLE001 - CLI boundary
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
