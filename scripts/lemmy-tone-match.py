#!/usr/bin/env python3
"""把动画帧的明度对比度匹配到 canonical(原图) —— 治"抽帧后动画比定妆图发平"。

为什么需要(2026-06-05 实测,同口径只取身体、不排中性):
  canonical 原图  V.std(对比度) = 0.160
  抽帧后的帧      V.std        = 0.143   ← 低约 11%, 肉眼"发平/发闷"
  原因: extract 的 HSV 迁移在缩放【前】匹配,之后 LANCZOS 降采样又把 V 方差压低。
用户要求动画帧对比度"采用目前的原图",故加本步:把每帧身体 V 线性重映射,
把 V.std 拉到 canonical 的值(保持各帧自身 V.mean,只提对比度、不改亮度、不动色相/饱和)。

顺序:  抽帧(extract-frames*.py) → 本步 tone-match → 铅笔描边 → oxipng。

用法:
  python3 scripts/lemmy-tone-match.py <canonical.png> <frame.png> [frame.png ...]
"""
import colorsys
import math
import sys

from PIL import Image

A_BODY = 60        # alpha 高于此算"实心身体"(用于统计 V 分布)
A_EDIT = 8         # alpha 高于此就参与重映射(含半透明羽化边)
WHITE = 235        # 三通道都高于此算白底残留, 不计入统计
K_LO, K_HI = 0.5, 2.0   # 对比缩放系数安全夹子


def body_vstats(px, w, h):
    V = []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b, a = px[x, y]
            if a < A_BODY or (r > WHITE and g > WHITE and b > WHITE):
                continue
            V.append(colorsys.rgb_to_hsv(r/255, g/255, b/255)[2])
    if not V:
        return None, None
    m = sum(V)/len(V)
    sd = math.sqrt(sum((z-m)**2 for z in V)/len(V))
    return m, sd


def canonical_vstd(path):
    im = Image.open(path).convert("RGBA")
    return body_vstats(im.load(), *im.size)[1]


def match(path, target_vstd):
    im = Image.open(path).convert("RGBA"); px = im.load(); w, h = im.size
    vm, vsd = body_vstats(px, w, h)
    if vsd is None or vsd < 1e-4:
        return None
    k = max(K_LO, min(K_HI, target_vstd / vsd))   # 把本帧 V.std 拉到 canonical
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < A_EDIT:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r/255, g/255, b/255)
            vv = min(1.0, max(0.0, (vv - vm) * k + vm))   # 绕本帧 V.mean 提对比,不改亮度
            nr, ng, nb = colorsys.hsv_to_rgb(hh, ss, vv)
            px[x, y] = (int(nr*255), int(ng*255), int(nb*255), a)
    im.save(path)
    return k


def main(argv):
    if len(argv) < 3:
        sys.exit("用法: lemmy-tone-match.py <canonical.png> <frame.png ...>")
    canon, frames = argv[1], argv[2:]
    tv = canonical_vstd(canon)
    ks = [k for k in (match(f, tv) for f in frames) if k is not None]
    if ks:
        print(f"tone-match → 目标 canonical V.std={tv:.3f}; "
              f"对比系数 k={min(ks):.3f}~{max(ks):.3f}, 处理 {len(ks)} 帧")


if __name__ == "__main__":
    main(sys.argv)
