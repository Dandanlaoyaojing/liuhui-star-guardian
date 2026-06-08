#!/usr/bin/env python3
"""只给篮子图的**蒙版区域**(篮身)重上色到目标色, 蒙版外(绳子/钉子/耳环结)原样保留。

与 m01-basket-recolor-to-target.py 的区别: 那个全图统一移色相(绳子也会跟着变);
这个只动 mask>0 的像素, 用于"只改篮身、绳子保持原色"的需求。

做法: 在蒙版内采"篮身"中位 HSV(稳健排除透明/黑描边/中性金属/浅高光),
推出 Δhue + S 比例 + V 比例, 只施加到 mask>0 且 alpha>=A_EDIT 的像素。
mask 是同尺寸灰度 PNG(白=改, 黑=保留)。

用法:
  python3 scripts/m01-basket-recolor-masked.py <src.png> <mask.png> <out.png> <hue°> <S%> <V%>
"""
import colorsys
import sys

from PIL import Image

A_BODY = 60
A_EDIT = 8
BLACK = 35
WHITE = 235
NEUT_S = 0.12
PALE_V, PALE_S = 0.85, 0.22
S_CLAMP = (0.35, 1.9)
V_CLAMP = (0.30, 1.6)


def median(xs):
    xs = sorted(xs)
    n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2


def main(argv):
    if len(argv) != 7:
        sys.exit(__doc__)
    src, maskp, out = argv[1], argv[2], argv[3]
    t_h, t_s, t_v = float(argv[4]) / 360, float(argv[5]) / 100, float(argv[6]) / 100

    im = Image.open(src).convert("RGBA")
    mask = Image.open(maskp).convert("L")
    if mask.size != im.size:
        mask = mask.resize(im.size, Image.NEAREST)
    px = im.load()
    mp = mask.load()
    w, h = im.size

    # sample body HSV inside the mask only
    H, S, V = [], [], []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if mp[x, y] < 128:
                continue
            r, g, b, a = px[x, y]
            if a < A_BODY or max(r, g, b) < BLACK or min(r, g, b) > WHITE:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if ss < NEUT_S or (vv > PALE_V and ss < PALE_S):
                continue
            H.append(hh); S.append(ss); V.append(vv)
    sh, ss_, sv = median(H), median(S), median(V)
    dh = t_h - sh
    s_scale = min(S_CLAMP[1], max(S_CLAMP[0], t_s / ss_))
    v_scale = min(V_CLAMP[1], max(V_CLAMP[0], t_v / sv))
    print(f"masked body HSV = {sh*360:5.1f} S={ss_*100:4.1f} V={sv*100:5.1f}")
    print(f"target          = {t_h*360:5.1f} S={t_s*100:4.1f} V={t_v*100:5.1f}")
    print(f"-> Δhue={dh*360:+.1f}  S×{s_scale:.3f}  V×{v_scale:.3f}")

    for y in range(h):
        for x in range(w):
            if mp[x, y] < 128:
                continue
            r, g, b, a = px[x, y]
            if a < A_EDIT:
                continue
            hh, sat, val = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            hh = (hh + dh) % 1.0
            sat = min(1.0, max(0.0, sat * s_scale))
            val = min(1.0, max(0.0, val * v_scale))
            nr, ng, nb = colorsys.hsv_to_rgb(hh, sat, val)
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    im.save(out)
    print(f"saved -> {out}")


if __name__ == "__main__":
    main(sys.argv)
