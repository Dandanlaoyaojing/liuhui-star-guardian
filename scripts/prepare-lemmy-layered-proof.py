#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/resources/art/stage1-m01/runtime-sprites/intro/m01-lemmy-walking.png"
CLEAN_MASTER = ROOT / "assets/art/style-references/lemmy-rabbit-clean-master.png"
PARTS_ROOT = ROOT / "assets/art/characters/lemmy/parts"
RUNTIME_ROOT = ROOT / "assets/resources/art/characters/lemmy"
PIVOTS_JSON = ROOT / "assets/art/characters/lemmy/lemmy-part-pivots.json"

PART_FILES = {
    "body": "lemmy-body.png",
    "ear_left": "lemmy-ear-left.png",
    "ear_right": "lemmy-ear-right.png",
    "arm_front": "lemmy-arm-front.png",
}


def clamp(v: float, lo: int, hi: int) -> int:
    return max(lo, min(hi, int(round(v))))


def should_keep_pixel(r: int, g: int, b: int, a: int, y: int, height: int) -> bool:
    if a < 8:
        return False
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    mx = max(r, g, b)
    mn = min(r, g, b)
    sat = 0 if mx == 0 else (mx - mn) / mx

    if y > height * 0.84 and lum > 130:
        return False
    if lum > 184 and sat < 0.32:
        return False
    if lum > 205:
        return False
    return lum < 176 or sat > 0.16


def clean_source(source: Image.Image) -> Image.Image:
    source = source.convert("RGBA")
    width, height = source.size
    pixels = source.load()
    clean = Image.new("RGBA", source.size, (0, 0, 0, 0))
    out = clean.load()
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if should_keep_pixel(r, g, b, a, y, height):
                out[x, y] = (r, g, b, a)
    return clean


def opaque_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise RuntimeError("clean Lemmy image has no opaque pixels")
    return bbox


def part_name_at(x: int, y: int, bounds: tuple[int, int, int, int]) -> str | None:
    min_x, min_y, max_x, max_y = bounds
    width = max_x - min_x
    height = max_y - min_y
    nx = (x - min_x) / width
    ny = (y - min_y) / height

    if 0.30 <= nx <= 0.56 and 0.00 <= ny <= 0.38:
        return "ear_left"
    if 0.48 <= nx <= 0.96 and 0.05 <= ny <= 0.42:
        return "ear_right"
    if 0.12 <= nx <= 0.48 and 0.42 <= ny <= 0.78:
        return "arm_front"
    return "body"


def render_part(clean: Image.Image, part_id: str, bounds: tuple[int, int, int, int]) -> Image.Image:
    width, height = clean.size
    source = clean.load()
    part = Image.new("RGBA", clean.size, (0, 0, 0, 0))
    out = part.load()
    for y in range(height):
        for x in range(width):
            px = source[x, y]
            if px[3] == 0:
                continue
            name = part_name_at(x, y, bounds)
            if part_id == "body" or name == part_id:
                out[x, y] = px

    bbox = part.getchannel("A").getbbox()
    if not bbox:
        return Image.new("RGBA", (4, 4), (0, 0, 0, 0))

    pad = 18
    left = clamp(bbox[0] - pad, 0, width)
    top = clamp(bbox[1] - pad, 0, height)
    right = clamp(bbox[2] + pad, 0, width)
    bottom = clamp(bbox[3] + pad, 0, height)
    return part.crop((left, top, right, bottom))


def write_part(part_id: str, image: Image.Image) -> dict[str, object]:
    filename = PART_FILES[part_id]
    PARTS_ROOT.mkdir(parents=True, exist_ok=True)
    RUNTIME_ROOT.mkdir(parents=True, exist_ok=True)
    part_path = PARTS_ROOT / filename
    runtime_path = RUNTIME_ROOT / filename
    image.save(part_path)
    image.save(runtime_path)
    return {
        "id": part_id,
        "source": str(SOURCE.relative_to(ROOT)),
        "part": str(part_path.relative_to(ROOT)),
        "runtime": str(runtime_path.relative_to(ROOT)),
        "size": image.size,
    }


def main() -> None:
    source = Image.open(SOURCE)
    clean = clean_source(source)
    CLEAN_MASTER.parent.mkdir(parents=True, exist_ok=True)
    clean.save(CLEAN_MASTER)

    bounds = opaque_bounds(clean)
    outputs = []
    for part_id in PART_FILES:
        outputs.append(write_part(part_id, render_part(clean, part_id, bounds)))

    PIVOTS_JSON.parent.mkdir(parents=True, exist_ok=True)
    PIVOTS_JSON.write_text(
        json.dumps(
            {
                "identitySource": "assets/art/style-references/lemmy-rabbit-style-reference.png",
                "cleanMaster": str(CLEAN_MASTER.relative_to(ROOT)),
                "runtime": str(RUNTIME_ROOT.relative_to(ROOT)),
                "parts": outputs,
                "note": "Temporary 4-layer proof generated from the approved upright Lemmy stand-in. Replace the source with the final high-resolution clean master before final art lock.",
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(json.dumps({"ok": True, "cleanMaster": str(CLEAN_MASTER), "parts": outputs}, indent=2))


if __name__ == "__main__":
    main()
