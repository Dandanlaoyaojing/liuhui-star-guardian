#!/usr/bin/env python3
"""从空篮原图沿「前沿弧线」抠出前壁遮挡片(front occluder)。

前壁 = 篮子前沿弧线**以下**的部分(前壁+碗体+底);弧线**以上**(碗口/拼片露出区、后沿、吊链)
设为透明。弧线 = 用户在原图上逐点定的 7 点 Catmull-Rom 样条(过所有控制点、平滑)。
切口带羽化软边,避免硬边。背景(原本 alpha=0)保持透明,不会被加实。

控制点是在 1586×992 原图坐标里定的(2026-06-06,用户逐点微调:沿前沿藤编沿)。
注:旧版是「横着一刀 CUT 直线」,用户指出前沿是弧形,改为沿弧线切。

用法:
  python3 scripts/m01-extract-front-occluder.py <out.png>
"""
import bisect
import sys

from PIL import Image

SRC = "assets/resources/art/stage1-m01/runtime-sprites/intro/m01-basket-hanging-empty.png"

# 前沿弧线控制点(原图 1586×992 像素坐标),用户逐点定稿
FRONT_RIM_CTRL = [
    (360, 648),   # L   左端
    (503, 697),   # LM  左中
    (647, 723),   # LMC 左中-中
    (790, 734),   # C   中心最低
    (937, 729),   # RMC 中-右中
    (1083, 708),  # RM  右中
    (1230, 661),  # R   右端
]
FEATHER = 7  # 切口羽化半径(px)


def catmull_samples(ctrl, steps=160):
    pts = []
    ext = [ctrl[0]] + list(ctrl) + [ctrl[-1]]
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for s in range(steps + 1):
            t = s / steps
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t
                       + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t * t
                       + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t ** 3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t
                       + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t * t
                       + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t ** 3)
            pts.append((x, y))
    return pts


def main(argv):
    out = argv[1] if len(argv) > 1 else "/tmp/occluder_curve.png"
    samp = sorted(catmull_samples(FRONT_RIM_CTRL), key=lambda p: p[0])
    xs = [p[0] for p in samp]
    ys = [p[1] for p in samp]

    def cut_at(x):
        if x <= xs[0]:
            return ys[0]
        if x >= xs[-1]:
            return ys[-1]
        i = bisect.bisect_left(xs, x)
        x0, x1, y0, y1 = xs[i - 1], xs[i], ys[i - 1], ys[i]
        return y0 if x1 == x0 else y0 + (y1 - y0) * (x - x0) / (x1 - x0)

    im = Image.open(SRC).convert("RGBA")
    px = im.load()
    w, h = im.size
    outimg = Image.new("RGBA", (w, h))
    op = outimg.load()
    kept = 0
    for x in range(w):
        cy = cut_at(x)
        lo, hi = cy - FEATHER, cy + FEATHER
        for y in range(h):
            r, g, b, a = px[x, y]
            if y < lo:
                na = 0
            elif y > hi:
                na = a
            else:
                na = int(round(a * (y - lo) / (2 * FEATHER)))
            op[x, y] = (r, g, b, na)
            if na > 16:
                kept += 1
    outimg.save(out)
    print(f"saved {out}  ({w}x{h})  opaque~{kept}px")


if __name__ == "__main__":
    main(sys.argv)
