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
frames = []
heights = []
for p in fs:
    f = Image.open(p).convert("RGBA"); w, h = f.size; px = f.load()
    mny = h; myy = 0
    for y in range(h):
        for x in range(0, w, 3):
            if px[x, y][3] > 40: mny = min(mny, y); myy = max(myy, y)
    heights.append(myy-mny)
    frames.append(Image.alpha_composite(Image.new("RGBA", f.size, PAPER), f).convert("P", palette=Image.ADAPTIVE, colors=128))

seq = frames + frames[::-1] if pingpong else frames
out = d/f"{action}-preview.gif"
seq[0].save(out, save_all=True, append_images=seq[1:], duration=dur, loop=0, disposal=2)
print(f"写出 {out}  ({len(fs)}帧, {dur}ms/帧)")
print(f"各帧身高(应全一致): {heights}")
print("身高一致:" , "✓" if len(set(heights)) == 1 else f"✗ 有 {len(set(heights))} 种高度,检查归一化")
