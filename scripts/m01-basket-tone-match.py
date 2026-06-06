#!/usr/bin/env python3
"""把一张篮子图的"色调"匹配到参考篮子图(数据驱动, 不写死)。

场景: codex 生成的"空篮子"与游戏里"装拼片的篮子"是同款藤编, 但色调偏差
(实测: 空篮 S=44.6 偏高/偏金黄, 原篮 S=38.0 更灰更冷; 色相基本一致 ~39°)。
做法: 各取"篮身"中位 HSV, 推出 Δhue(加性)、S 比例、V 比例, 统一施加到全图前景。

篮身采样的稳健过滤(对透明底/纯黑底/白/灰链/浅拼片都成立):
  排除  alpha<A_BODY(透明) | 近黑底(max(rgb)<BLACK) | 近白(min(rgb)>WHITE)
        | 低饱和中性(S<NEUT, 滤掉铁链/钉) | 浅色块(高 V 低 S, 滤掉拼片/高光)

施加: 仅动 alpha>=A_EDIT 的 RGB; 不碰 alpha; 纯黑底在 S/V 缩放下仍为黑, 自动免疫。

用法:
  python3 scripts/m01-basket-tone-match.py <source.png> <target.png> <out.png>
"""
import colorsys
import sys

from PIL import Image

A_BODY = 60          # alpha 高于此算实心(统计用)
A_EDIT = 8           # alpha 高于此就重映射
BLACK = 35           # max(rgb) 低于此算纯黑底, 不计入统计
WHITE = 235          # min(rgb) 高于此算白, 不计
NEUT_S = 0.12        # 饱和低于此算中性(铁链/钉/灰), 统计排除
PALE_V, PALE_S = 0.85, 0.22   # 高 V 低 S => 浅拼片/高光, 统计排除
S_CLAMP = (0.4, 1.6)
V_CLAMP = (0.4, 1.6)


def median(xs):
    xs = sorted(xs)
    n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2


def body_hsv(path):
    """篮身中位 (h,s,v) in [0,1]; 稳健排除透明/黑底/白/中性/浅块。"""
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
    if len(argv) != 4:
        sys.exit("用法: m01-basket-tone-match.py <source.png> <target.png> <out.png>")
    src_path, tgt_path, out_path = argv[1], argv[2], argv[3]

    sh, ss_, sv = body_hsv(src_path)
    th, ts, tv = body_hsv(tgt_path)
    dh = th - sh
    s_scale = min(S_CLAMP[1], max(S_CLAMP[0], ts / ss_))
    v_scale = min(V_CLAMP[1], max(V_CLAMP[0], tv / sv))

    print(f"source 篮身 HSV = {sh*360:5.1f}deg  S={ss_*100:4.1f}  V={sv*100:5.1f}")
    print(f"target 篮身 HSV = {th*360:5.1f}deg  S={ts*100:4.1f}  V={tv*100:5.1f}")
    print(f"-> Δhue={dh*360:+.1f}deg  S×{s_scale:.3f}  V×{v_scale:.3f}")

    im = Image.open(src_path).convert("RGBA")
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
    im.save(out_path)
    print(f"saved -> {out_path}")


if __name__ == "__main__":
    main(sys.argv)
