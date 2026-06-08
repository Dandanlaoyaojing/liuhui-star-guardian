#!/usr/bin/env python3
"""把篮子图重上色到一个**显式目标色调**(数据驱动, 目标当参数), 保留藤编纹理/描边/链子。

与 m01-basket-tone-match.py 的区别: 那个把色调匹配到一张"参考篮子图";
这个直接给定目标 HSV(例如从一张参考图里量出的"围裙绿"), 不需要同款参考篮。

做法: 量出源图"篮身"中位 HSV(稳健排除透明/黑底/白/中性金属/浅高光),
推出 Δhue(加性)、S 比例; V 按 vmode 处理:
  full  -> V 也缩放到目标(最忠实, 可能偏暗)
  keep  -> V 不动(只调色相+饱和, 保持原本的"淡/亮", 最不易发闷)
  soft  -> V 缩放折半(介于两者之间)
仅重映射 alpha>=A_EDIT 的 RGB; 不碰 alpha; 纯黑描边在 S/V 缩放下仍黑, 自动免疫。

用法:
  python3 scripts/m01-basket-recolor-to-target.py <src.png> <out.png> <hue_deg> <S%> <V%> <full|keep|soft>
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
S_CLAMP = (0.4, 1.8)
V_CLAMP = (0.4, 1.6)


def median(xs):
    xs = sorted(xs)
    n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2


def body_hsv(path):
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    H, S, V = [], [], []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b, a = px[x, y]
            if a < A_BODY:
                continue
            if max(r, g, b) < BLACK or min(r, g, b) > WHITE:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if ss < NEUT_S:
                continue
            if vv > PALE_V and ss < PALE_S:
                continue
            H.append(hh); S.append(ss); V.append(vv)
    return median(H), median(S), median(V)


def main(argv):
    if len(argv) != 7:
        sys.exit(__doc__)
    src, out = argv[1], argv[2]
    t_h = float(argv[3]) / 360.0
    t_s = float(argv[4]) / 100.0
    t_v = float(argv[5]) / 100.0
    vmode = argv[6]

    sh, ss_, sv = body_hsv(src)
    dh = t_h - sh
    s_scale = min(S_CLAMP[1], max(S_CLAMP[0], t_s / ss_))
    v_full = min(V_CLAMP[1], max(V_CLAMP[0], t_v / sv))
    if vmode == "full":
        v_scale = v_full
    elif vmode == "keep":
        v_scale = 1.0
    elif vmode == "soft":
        v_scale = 1.0 + (v_full - 1.0) * 0.5
    else:
        sys.exit(f"unknown vmode {vmode!r}")

    print(f"src 篮身 HSV = {sh*360:5.1f}deg S={ss_*100:4.1f} V={sv*100:5.1f}")
    print(f"target  HSV = {t_h*360:5.1f}deg S={t_s*100:4.1f} V={t_v*100:5.1f}  vmode={vmode}")
    print(f"-> Δhue={dh*360:+.1f}deg  S×{s_scale:.3f}  V×{v_scale:.3f}")

    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
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
