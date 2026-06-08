#!/usr/bin/env python3
"""抹掉吊篮 PNG 顶部的悬挂吊带/吊钩(rim 线以上), 留纯碗体 —— 让吊带改由引擎物理 + 程序绳渲染,
篮身碗体不动。区域法(按宽度突变定 rim, 抹其上), 不用脆弱的颜色蒙版。

为何区域法: 绳子是琥珀色, 但篮身经鳄梨改色后仍有大量 amber-ish 像素铺满全图(知识库: 鳄梨会话
"蒙版扣不准"), 颜色无法干净隔离吊带。而吊带在 rim 线以上是【唯一的窄条】, 按行宽突变切最稳。

用法:
  python3 scripts/m01-basket-strip-suspension.py <src.png> <out.png> [rim_y]
  rim_y 省略则自动: 从上往下第一条"宽度>=50% 最大宽"的行(碗体起始)。
"""
import sys
from PIL import Image
import numpy as np


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 1
    src, out = argv[1], argv[2]
    im = Image.open(src).convert("RGBA")
    arr = np.asarray(im).copy()
    H, W = arr.shape[:2]
    opaque = arr[..., 3] > 30
    roww = opaque.sum(axis=1)
    maxw = int(roww.max())
    if len(argv) >= 4:
        rim = int(argv[3])
    else:
        thr = 0.5 * maxw
        below = np.where(roww >= thr)[0]
        rim = int(below.min()) if len(below) else 0
    # 抹 rim 以上(吊带/吊钩) → 全透明
    erased = int(opaque[:rim].sum())
    arr[:rim, :, 3] = 0
    Image.fromarray(arr, "RGBA").save(out)
    print(f"{src} {W}x{H}: rim=y{rim}, 抹掉其上 {erased} 不透明像素 → {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
