#!/usr/bin/env python3
"""把抽好的精灵帧拼成循环 GIF + 量身高自检 + 棋盘透明验证。
用法: python3 preview-gif.py <帧目录> <动作名> [每帧ms] [pingpong:0/1]
例:   python3 preview-gif.py assets/resources/art/characters/lemmy/walk walk 110 0
"""
import sys
from pathlib import Path
from PIL import Image

d = Path(sys.argv[1]); action = sys.argv[2]
dur = int(sys.argv[3]) if len(sys.argv) > 3 else 110
pingpong = len(sys.argv) > 4 and sys.argv[4] == "1"
PAPER = (250, 247, 240, 255)

fs = sorted(d.glob(f"{action}-*.png"))
if not fs: sys.exit(f"未找到 {action}-*.png in {d}")
rgb = []
heights = []
for p in fs:
    f = Image.open(p).convert("RGBA"); w, h = f.size; px = f.load()
    mny = h; myy = 0
    for y in range(h):
        for x in range(0, w, 3):
            if px[x, y][3] > 40: mny = min(mny, y); myy = max(myy, y)
    heights.append(myy-mny)
    rgb.append(Image.alpha_composite(Image.new("RGBA", f.size, PAPER), f).convert("RGB"))

# 用【全帧共享的同一调色板】+【关闭抖动】导出 GIF。
# 坑:若每帧各自 convert("P", ADAPTIVE) 会各算一套调色板,且默认开 Floyd-Steinberg 抖动 →
# 平涂纸背景上的抖动点逐帧位置都在变,肉眼看就是一层"雪花/噪点"在爬。共享调色板+dither=NONE 根治。
W, H = rgb[0].size
stack = Image.new("RGB", (W, H*len(rgb)))
for i, c in enumerate(rgb): stack.paste(c, (0, i*H))
master = stack.quantize(colors=255, method=Image.MEDIANCUT, dither=Image.NONE)
frames = [c.quantize(palette=master, dither=Image.NONE) for c in rgb]

seq = frames + frames[::-1] if pingpong else frames
out = d/f"{action}-preview.gif"
seq[0].save(out, save_all=True, append_images=seq[1:], duration=dur, loop=0, disposal=1, optimize=True)
print(f"写出 {out}  ({len(fs)}帧, {dur}ms/帧)")
print(f"各帧身高(应全一致): {heights}")
print("身高一致:" , "✓" if len(set(heights)) == 1 else f"✗ 有 {len(set(heights))} 种高度,检查归一化")
