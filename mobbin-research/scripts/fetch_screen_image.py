#!/usr/bin/env python3
"""Fetch the full-resolution image for a Mobbin screen.

The Mobbin MCP search tools return small preview images (~299x678 webp).
This script opens the screen's public page and extracts the full-size CDN
image URL from the og:image meta tag, then downloads it.

Usage:
    fetch_screen_image.py <mobbin-url-or-screen-id> [--out DIR] [--width 1920]

Example:
    fetch_screen_image.py https://mobbin.com/screens/7336baf0-22a8-4e07-be82-59bd383432a4
    fetch_screen_image.py 7336baf0-22a8-4e07-be82-59bd383432a4 --out screens/

Exit codes: 0 on success, 1 on failure.
"""

import argparse
import re
import sys
import html
import urllib.parse
import urllib.request
from pathlib import Path

SCREEN_PAGE_URL = "https://mobbin.com/screens/{screen_id}"


def parse_screen_id(value: str) -> str:
    """Accept either a full mobbin URL or a bare screen UUID."""
    if value.startswith("http"):
        match = re.search(r"/screens/([0-9a-fA-F-]{36})", value)
        if not match:
            raise ValueError(f"Not a Mobbin screen URL: {value}")
        return match.group(1)
    if re.fullmatch(r"[0-9a-fA-F-]{36}", value):
        return value
    raise ValueError(f"Not a Mobbin screen ID or URL: {value}")


def extract_full_image_url(page_html: str):  # -> str | None
    """Pull the full-size CDN URL from the og:image meta tag's screenUrl param."""
    match = re.search(
        r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', page_html
    )
    if not match:
        return None
    og_url = html.unescape(match.group(1))
    parsed = urllib.parse.urlparse(og_url)
    params = urllib.parse.parse_qs(parsed.query)
    screen_urls = params.get("screenUrl", [])
    return screen_urls[0] if screen_urls else None


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("screen", help="Mobbin screen URL or screen UUID")
    parser.add_argument("--out", default=".", help="Output directory (default: .)")
    args = parser.parse_args()

    try:
        screen_id = parse_screen_id(args.screen)
        page_url = SCREEN_PAGE_URL.format(screen_id=screen_id)
        page_html = fetch(page_url).decode("utf-8", errors="replace")
        image_url = extract_full_image_url(page_html)
        if not image_url:
            print(f"ERROR: no full-size image found on {page_url}", file=sys.stderr)
            return 1

        image_data = fetch(image_url)
        out_dir = Path(args.out)
        out_dir.mkdir(parents=True, exist_ok=True)
        ext = ".png" if "png" in image_url.split("?")[0] else ".webp"
        out_path = out_dir / f"{screen_id}{ext}"
        out_path.write_bytes(image_data)
        print(f"OK: {out_path} ({len(image_data)} bytes)")
        print(f"URL: {image_url}")
        return 0
    except Exception as error:  # noqa: BLE001 - CLI boundary
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
