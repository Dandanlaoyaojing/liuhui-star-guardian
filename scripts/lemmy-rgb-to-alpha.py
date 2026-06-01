#!/usr/bin/env python3
"""Convert a Luma RGB-only PNG to RGBA with a luminance ramp.

Luma's Uni-1.1 endpoint outputs RGB-only PNG. When a prompt asks for a
transparent background, the actual output has a near-black solid background
(corner pixels ~ (3,3,3)) rather than alpha. This script applies a pixel-by-
pixel luminance → alpha ramp so the image can be composited on the game
background like every other RGBA asset.

Tune LO / HI per generation:
  - tighter ramp (LO=4, HI=16) for clean line-art icons
  - wider ramp (LO=8, HI=40) for soft watercolor halos (default for Lemmy)

Usage:
  scripts/lemmy-rgb-to-alpha.py <src.png> <dst.png> [LO] [HI]
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def to_alpha(src: Path, dst: Path, lo: float = 8.0, hi: float = 40.0) -> None:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    px = im.load()
    out = Image.new("RGBA", (w, h))
    op = out.load()
    bbox = [w, h, 0, 0]
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if lum <= lo:
                a = 0
            elif lum >= hi:
                a = 255
            else:
                a = int(round((lum - lo) / (hi - lo) * 255))
            op[x, y] = (r, g, b, a)
            if a > 4:
                bbox[0] = min(bbox[0], x)
                bbox[1] = min(bbox[1], y)
                bbox[2] = max(bbox[2], x)
                bbox[3] = max(bbox[3], y)

    pad = 16
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(w, bbox[2] + pad + 1)
    bottom = min(h, bbox[3] + pad + 1)
    cropped = out.crop((left, top, right, bottom))
    cropped.save(dst, optimize=True)
    print(f"  {src.name} -> {dst.name}  ({cropped.size[0]}x{cropped.size[1]})")


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit("usage: lemmy-rgb-to-alpha.py <src.png> <dst.png> [LO] [HI]")
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    lo = float(sys.argv[3]) if len(sys.argv) > 3 else 8.0
    hi = float(sys.argv[4]) if len(sys.argv) > 4 else 40.0
    to_alpha(src, dst, lo, hi)


if __name__ == "__main__":
    main()
