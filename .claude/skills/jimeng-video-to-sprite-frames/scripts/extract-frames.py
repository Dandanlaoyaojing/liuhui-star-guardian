#!/usr/bin/env python3
"""把即梦生成的动作 mp4 抽成"游戏精灵帧"——治忽大忽小+抠透明+校色的核心脚本。

用法:
  python3 extract-frames.py <视频.mp4> <canonical定妆图.png> <输出目录> <动作名> [帧数]

例:
  python3 extract-frames.py walk.mp4 lemmy-canonical.png \
      assets/resources/art/characters/lemmy/walk walk 36

做的事(每帧):
  1. ffmpeg mpdecimate 去重复帧
  2. 中段稳定区均匀取 N 帧
  3. 逐帧按自身 bbox 身高【等比】缩放到统一 TARGET_H(治忽大忽小,等比保形不变形)
  4. 脚底锁定同一 GROUND 基线 + 水平按脚部重心对齐(不上下跳不左右跳)
  5. 白底转 alpha(边缘羽化)
  6. HSV 色彩迁移到 canonical(保 hue 只校 S/V,修发灰掉色)

输出帧命名 <动作名>-00.png ...,512x512,脚底对齐,可直接进引擎。
打印每帧身高(应完全一致)做自检。
"""
import colorsys, math, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image

SIZE = 512
TARGET_H_RATIO = 0.84   # 角色占画布高度比例
GROUND_RATIO = 0.96     # 脚底基线
WHITE_BG = 240          # 高于此且低饱和判背景
SEG_LO, SEG_HI = 0.25, 0.88   # 取视频中段稳定区(避开起步/收尾)


def canonical_stats(path):
    im = Image.open(path).convert("RGBA"); w, h = im.size; px = im.load(); S = []; V = []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b, a = px[x, y]
            if a < 60 or (r > 235 and g > 235 and b > 235): continue
            _, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255); S.append(s); V.append(v)
    def ms(L): m = sum(L)/len(L); return m, math.sqrt(sum((z-m)**2 for z in L)/len(L))
    return ms(S), ms(V)


def bbox(px, w, h):
    mnx = w; mny = h; mxx = 0; myy = 0
    for y in range(h):
        for x in range(w):
            if min(px[x, y][0], px[x, y][1], px[x, y][2]) < 232:
                mnx = min(mnx, x); mxx = max(mxx, x); mny = min(mny, y); myy = max(myy, y)
    return mnx, mny, mxx, myy


def main():
    if len(sys.argv) < 5:
        sys.exit("用法: extract-frames.py <视频.mp4> <canonical.png> <输出目录> <动作名> [帧数]")
    video, canonical, outdir, action = sys.argv[1:5]
    N = int(sys.argv[5]) if len(sys.argv) > 5 else 24
    outdir = Path(outdir); outdir.mkdir(parents=True, exist_ok=True)

    # 1. ffmpeg 去重抽帧到临时目录
    tmp = Path(tempfile.mkdtemp())
    ff = "/opt/homebrew/bin/ffmpeg" if Path("/opt/homebrew/bin/ffmpeg").exists() else "ffmpeg"
    subprocess.run([ff, "-y", "-i", video, "-vf",
                    "mpdecimate,setpts=N/FRAME_RATE/TB", "-vsync", "vfr",
                    str(tmp/"d-%03d.png")], check=True, capture_output=True)
    fs = sorted(tmp.glob("d-*.png"))
    print(f"去重独立帧: {len(fs)}")

    # 2. 中段均匀取 N 帧
    seg = fs[int(len(fs)*SEG_LO):int(len(fs)*SEG_HI)]
    idxs = [round(i*(len(seg)-1)/(N-1)) for i in range(N)]
    picked = [seg[i] for i in idxs]

    (tSm, tSsd), (tVm, tVsd) = canonical_stats(canonical)
    TARGET_H = int(SIZE*TARGET_H_RATIO); GROUND = int(SIZE*GROUND_RATIO)

    for old in outdir.glob(f"{action}-*.png"): old.unlink()
    heights = []
    for i, p in enumerate(picked):
        im = Image.open(p).convert("RGB"); w, h = im.size; px = im.load()
        mnx, mny, mxx, myy = bbox(px, w, h); bh = myy-mny; bw = mxx-mnx
        # 该帧色彩统计
        S = []; V = []
        for y in range(mny, myy+1, 2):
            for x in range(mnx, mxx+1, 2):
                r, g, b = px[x, y]
                if r > 235 and g > 235 and b > 235: continue
                _, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255); S.append(s); V.append(v)
        sSm = sum(S)/len(S); sVm = sum(V)/len(V)
        sSsd = max(1e-3, math.sqrt(sum((z-sSm)**2 for z in S)/len(S)))
        sVsd = max(1e-3, math.sqrt(sum((z-sVm)**2 for z in V)/len(V)))
        sR = min(1.5, tSsd/sSsd); vR = min(1.4, tVsd/sVsd)
        crop = Image.new("RGBA", (bw+1, bh+1)); o = crop.load(); fsx = 0; fn = 0
        for y in range(mny, myy+1):
            for x in range(mnx, mxx+1):
                r, g, b = px[x, y]; mn = min(r, g, b)
                if r > WHITE_BG and g > WHITE_BG and b > WHITE_BG: continue
                a = 255 if mn < 224 else int(max(0, (247-mn)/23*255))
                hh, ss, vv = colorsys.rgb_to_hsv(r/255, g/255, b/255)
                ss = min(1, max(0, (ss-sSm)*sR+tSm)); vv = min(1, max(0, (vv-sVm)*vR+tVm))
                nr, ng, nb = colorsys.hsv_to_rgb(hh, ss, vv)
                o[x-mnx, y-mny] = (int(nr*255), int(ng*255), int(nb*255), a)
                if y >= mny+bh*0.80: fsx += (x-mnx); fn += 1
        footx = (fsx/fn) if fn else bw/2
        sc = TARGET_H/bh   # 等比缩放(高宽同系数,保形)
        nw = max(1, round((bw+1)*sc)); nh = max(1, round((bh+1)*sc)); crop = crop.resize((nw, nh))
        f = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        f.alpha_composite(crop, (round(SIZE/2-footx*sc), GROUND-nh))
        f.save(outdir/f"{action}-{i:02d}.png")
        # 量身高自检
        fp = f.load(); mny2 = SIZE; myy2 = 0
        for yy in range(SIZE):
            for xx in range(0, SIZE, 3):
                if fp[xx, yy][3] > 40: mny2 = min(mny2, yy); myy2 = max(myy2, yy)
        heights.append(myy2-mny2)
    print(f"写出 {N} 帧 -> {outdir}")
    print(f"各帧身高(应全一致): {heights}")


if __name__ == "__main__":
    main()
