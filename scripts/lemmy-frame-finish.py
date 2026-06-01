#!/usr/bin/env python3
"""Finish a Luma-generated Lemmy frame so it matches the canonical:
  1. resize to 1024 (runtime target),
  2. paper-white background -> alpha,
  3. saturation pulled back to the canonical's mean (fixes Luma's color fade),
  4. crop to opaque bounds with small padding.

Hue is preserved (red stays red); only saturation is rescaled toward the
canonical target, so identity color drift from Luma is corrected without
inventing new colors.

Usage:
  scripts/lemmy-frame-finish.py <src.png> <dst.png> [target_sat]
Default target_sat = 0.402 (measured mean saturation of lemmy-rabbit-canonical.png).
"""
from __future__ import annotations

import colorsys
import sys
from pathlib import Path

from PIL import Image

TARGET_SAT = 0.402  # canonical mean saturation over rabbit pixels (measured 2026-05-28)
RUNTIME_SIZE = 1024


def measure_mean_sat(px, w: int, h: int) -> float:
    s_vals = []
    step = max(1, w // 300)
    for y in range(0, h, step):
        for x in range(0, w, step):
            r, g, b = px[x, y][:3]
            if r > 235 and g > 235 and b > 235:
                continue
            _, s, _ = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            s_vals.append(s)
    return (sum(s_vals) / len(s_vals)) if s_vals else TARGET_SAT


def finish(src: Path, dst: Path, target_sat: float = TARGET_SAT) -> None:
    im = Image.open(src).convert("RGB")
    if max(im.size) > RUNTIME_SIZE:
        im.thumbnail((RUNTIME_SIZE, RUNTIME_SIZE))
    w, h = im.size
    px = im.load()

    src_sat = measure_mean_sat(px, w, h)
    s_scale = (target_sat / src_sat) if src_sat > 0 else 1.0
    s_scale = max(0.8, min(1.5, s_scale))  # clamp to avoid over-boost

    out = Image.new("RGBA", (w, h))
    op = out.load()
    bbox = [w, h, 0, 0]
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            mn = min(r, g, b)
            # paper-white background -> transparent, soft ramp near the edge
            if r > 244 and g > 244 and b > 244:
                op[x, y] = (r, g, b, 0)
                continue
            a = 255 if mn < 225 else int(max(0, (248 - mn) / 23 * 255))
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            ss = min(1.0, ss * s_scale)
            nr, ng, nb = colorsys.hsv_to_rgb(hh, ss, vv)
            op[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
            if a > 16:
                bbox[0] = min(bbox[0], x); bbox[1] = min(bbox[1], y)
                bbox[2] = max(bbox[2], x); bbox[3] = max(bbox[3], y)

    pad = 16
    crop = out.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                     min(w, bbox[2] + pad + 1), min(h, bbox[3] + pad + 1)))
    crop.save(dst, optimize=True)
    print(f"  {src.name} -> {dst.name}  sat_scale={s_scale:.2f}  size={crop.size}")


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit("usage: lemmy-frame-finish.py <src.png> <dst.png> [target_sat]")
    ts = float(sys.argv[3]) if len(sys.argv) > 3 else TARGET_SAT
    finish(Path(sys.argv[1]), Path(sys.argv[2]), ts)


if __name__ == "__main__":
    main()
