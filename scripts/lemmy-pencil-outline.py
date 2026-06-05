#!/usr/bin/env python3
"""
莱米运行时帧 —— 手绘铅笔描边 定稿处理 (finalized 2026-06-05)

把"浅铅笔灰 + 深浅不一 + 颗粒"的外描边加到莱米运行时精灵帧上,
让动画帧与定妆 canonical 的描边风格统一。最终参数(会话 9c059bcc 收敛):

  W5  描边宽基准   —— 以内容高度 820px 为基准的 W=5;
                      每帧按自身内容高度等比缩放:  W = round(5 * Hc / 820)
                      不同姿势(高 reach / 矮 crouch)在等高显示时描边粗细一致。
  0.45 颗粒度       —— effect_noise(σ=78) 振幅 *0.45, 每帧重新生成
                      → 动画播放时颗粒不会"冻结"成同一张噪声。
  浅铅笔灰 + 深浅不一 —— 描边色 = 灰度 clamp(58 + L*0.55), 跟随该处明暗起伏。
  描边只进 alpha 外缘环 (rim = ab - erode(ab, W)), 身体水彩不动。

⚠️ 幂等警告: 本脚本就地覆盖, 会在"当前像素"上再描一圈描边。
   只能跑在【未描边的干净帧】上。重跑前务必先还原干净基底:
       git checkout HEAD -- assets/resources/art/characters/lemmy
   否则会双重描边。

用法:
  python3 scripts/lemmy-pencil-outline.py            # 处理标准 114 帧
  python3 scripts/lemmy-pencil-outline.py <png...>   # 处理指定帧
"""
import glob
import os
import sys

from PIL import Image, ImageChops, ImageFilter

REF_H = 820          # W5 基准内容高度
BASE_W = 5           # W5
GRAIN = 0.45         # 颗粒度
NOISE_SIGMA = 78
GREY_BIAS = 58       # 浅铅笔灰: clamp(58 + L*0.55)
GREY_SLOPE = 0.55

clamp = lambda v: 0 if v < 0 else 255 if v > 255 else int(v)


def _erode(ab, W):
    """收缩剪影 W 像素; 大 W 用降采样近似以提速。"""
    if W <= 5:
        return ab.filter(ImageFilter.MinFilter(2 * W + 1))
    sc = 4
    sm = ab.resize((max(1, ab.width // sc), max(1, ab.height // sc)))
    return (sm.filter(ImageFilter.MinFilter(2 * max(1, round(W / sc)) + 1))
              .resize(ab.size).point(lambda x: 255 if x > 110 else 0))


def apply_outline(path):
    """就地给单帧加铅笔外描边; 返回该帧用的 W。空帧返回 None。"""
    im = Image.open(path).convert("RGBA")
    bb = im.getbbox()
    if not bb:
        return None
    Hc = bb[3] - bb[1]
    W = max(1, round(BASE_W * Hc / REF_H))          # 按内容高度等比缩描边宽
    a = im.split()[3]
    ab = a.point(lambda x: 255 if x > 10 else 0)
    rim = ImageChops.subtract(ab, _erode(ab, W))    # 只取外缘环
    L = Image.merge("RGB", im.split()[:3]).convert("L")
    grey = L.point(lambda v: clamp(GREY_BIAS + v * GREY_SLOPE))   # 浅铅笔灰 + 深浅不一
    noise = Image.effect_noise(im.size, NOISE_SIGMA).point(
        lambda v: clamp(128 + (v - 128) * GRAIN))   # 颗粒, 每帧重生成
    g = ImageChops.add(grey, noise, 1.0, -128)
    gc = Image.merge("RGB", (g, g, g))
    mrgb = Image.merge("RGB", im.split()[:3])
    out = Image.merge("RGBA", (*Image.composite(gc, mrgb, rim).split(), a))
    out.save(path)
    return W


def standard_targets():
    base = "assets/resources/art/characters/lemmy"
    targets = [f"{base}/lemmy-canonical.png"]
    for d in ("idle", "walk", "reach", "startle", "crouch"):
        targets += sorted(glob.glob(f"{base}/{d}/{d}-[0-9][0-9].png"))
    return targets


def main(argv):
    targets = argv[1:] if len(argv) > 1 else standard_targets()
    n = 0
    per = {}
    for t in targets:
        if not os.path.exists(t):
            print("skip (missing):", t)
            continue
        W = apply_outline(t)
        if W is None:
            print("skip (empty):", t)
            continue
        n += 1
        key = "canonical" if t.endswith("lemmy-canonical.png") else os.path.basename(os.path.dirname(t))
        per.setdefault(key, set()).add(W)
    print(f"铅笔描边已应用到 {n} 帧")
    for key in ("canonical", "idle", "walk", "reach", "startle", "crouch"):
        if key in per:
            print(f"  {key:9s} W={sorted(per[key])}")
    print("提示: 之后用 `oxipng -o 4` 无损回压 (PIL 直存会略增体积)。")


if __name__ == "__main__":
    main(sys.argv)
