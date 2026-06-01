#!/usr/bin/env python3
"""弧线动作版抽帧 —— 用于 reach/startle 等"身高本身会变化"的【非循环】反应动作。

与 extract-frames.py(循环版)的唯一区别在缩放策略:
  循环版(walk/idle): 每帧各自等比缩放到【统一身高】 → 走路/待机身高恒定,任何起伏都是漂移要消除。
  弧线版(reach/startle): 先扫所有帧求【全局最大身高】算一个【统一 SCALE】,所有帧用同一 SCALE 缩放、
                         脚底锁同一基线 → 保留真实高度起伏(蹲矮→站高→踮脚伸高 / 缩头→抬头),绝不抹平。

用法:
  python3 extract-frames-arc.py <视频.mp4> <canonical.png> <输出目录> <动作名> [帧数] [seg_lo] [seg_hi]
例(startle 反应, 30 帧, 取中段 0.15~0.93):
  python3 extract-frames-arc.py startle.mp4 lemmy-canonical.png \
      assets/resources/art/characters/lemmy/startle startle 30 0.15 0.93

seg_lo/seg_hi: 在去重帧序列里取哪一段(0~1)。frames2video 首尾锁 neutral 时,两端是静止 neutral,
动作在中段;先用默认跑一次、看打印的身高曲线再微调窗口,把"完整反应弧"框进来。

输出 <动作名>-00.png ...,512x512,脚底对齐,可直接进引擎。
打印每帧身高 —— 弧线动作【应当起伏变化】(如 neutral 高→dip 矮→neutral 高),这是正确的,不是 bug。
"""
import colorsys, math, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image

SIZE = 512
TARGET_H_RATIO = 0.84   # 最高姿态(站立/伸展)占画布高度比例,与 idle/walk/reach 保持一致 → 切换动画不跳大小
GROUND_RATIO = 0.96     # 脚底基线
WHITE_BG = 240          # 高于此且低饱和判背景
DEF_SEG_LO, DEF_SEG_HI = 0.15, 0.93   # 默认中段窗口(比循环版略宽,留出反应前的 neutral 起手+恢复尾)


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
    # 密度+主簇版 bbox。两个鲁棒性处理,专治快速运动帧的抽帧塌陷:
    #  (1) 密度:按行/列统计暗像素,只把"足够密"(>=~0.4%边长,下限5)的行列算作主体,剔除边缘杂散噪点。
    #  (2) 主簇:把密集行按纵向间隙分簇(间隙>BRIDGE 视为断开),只保留暗像素总量最大的那一簇。
    #      快速运动帧里耳/肢体常被运动模糊冲淡到"中段消失、只剩个断开的尖端блоб"——naive bbox 会从那个
    #      悬空блоб一直框到脚底(满画幅、中间大片空洞),该帧抽出来近乎空白、还把全局最大身高/SCALE 撑爆。
    #      正常帧里耳朵与头连续(无大间隙)→ 整只兔子是一簇,完整保留;只有模糊掉链的帧才丢掉悬空блоб。
    row_cnt = [0]*h; col_cnt = [0]*w
    for y in range(h):
        rc = 0
        for x in range(w):
            if min(px[x, y][0], px[x, y][1], px[x, y][2]) < 232:
                rc += 1; col_cnt[x] += 1
        row_cnt[y] = rc
    rmin = max(5, round(0.004*w))
    dense = [y for y in range(h) if row_cnt[y] >= rmin]
    if not dense:
        dense = [y for y in range(h) if row_cnt[y] > 0]
        if not dense:
            return 0, 0, w-1, h-1
    BRIDGE = max(24, round(0.02*h))   # 小于此的纵向缝隙桥接为同一簇(容忍细颈/淡水彩),大于此视为断裂
    clusters = []; start = prev = dense[0]
    for y in dense[1:]:
        if y - prev > BRIDGE:
            clusters.append((start, prev)); start = y
        prev = y
    clusters.append((start, prev))
    mny, myy = max(clusters, key=lambda c: sum(row_cnt[y] for y in range(c[0], c[1]+1)))
    cmin = max(5, round(0.004*h))
    xs = [x for x in range(w) if col_cnt[x] >= cmin]   # 列以全局密集列定横向边界(悬空блоб在中部,不会外扩)
    if not xs:
        xs = [x for x in range(w) if col_cnt[x] > 0]
    return min(xs), mny, max(xs), myy


def main():
    if len(sys.argv) < 5:
        sys.exit("用法: extract-frames-arc.py <视频.mp4> <canonical.png> <输出目录> <动作名> [帧数] [seg_lo] [seg_hi]")
    video, canonical, outdir, action = sys.argv[1:5]
    N = int(sys.argv[5]) if len(sys.argv) > 5 else 30
    seg_lo = float(sys.argv[6]) if len(sys.argv) > 6 else DEF_SEG_LO
    seg_hi = float(sys.argv[7]) if len(sys.argv) > 7 else DEF_SEG_HI
    outdir = Path(outdir); outdir.mkdir(parents=True, exist_ok=True)

    # 1. ffmpeg 去重抽帧
    tmp = Path(tempfile.mkdtemp())
    ff = "/opt/homebrew/bin/ffmpeg" if Path("/opt/homebrew/bin/ffmpeg").exists() else "ffmpeg"
    subprocess.run([ff, "-y", "-i", video, "-vf",
                    "mpdecimate,setpts=N/FRAME_RATE/TB", "-vsync", "vfr",
                    str(tmp/"d-%03d.png")], check=True, capture_output=True)
    fs = sorted(tmp.glob("d-*.png"))
    print(f"去重独立帧: {len(fs)}")

    # 2. 取中段均匀 N 帧
    seg = fs[int(len(fs)*seg_lo):int(len(fs)*seg_hi)]
    idxs = [round(i*(len(seg)-1)/(N-1)) for i in range(N)]
    picked = [seg[i] for i in idxs]

    (tSm, tSsd), (tVm, tVsd) = canonical_stats(canonical)

    # 3. PASS 1: 量所有选中帧 bbox,求全局最大身高 → 统一 SCALE(弧线版核心)
    metas = []
    for p in picked:
        im = Image.open(p).convert("RGB"); w, h = im.size; px = im.load()
        mnx, mny, mxx, myy = bbox(px, w, h)
        metas.append((p, mnx, mny, mxx, myy, mxx-mnx, myy-mny))
    max_bh = max(m[6] for m in metas)
    TARGET_H = int(SIZE*TARGET_H_RATIO); GROUND = int(SIZE*GROUND_RATIO)
    SCALE = TARGET_H / max_bh
    print(f"全局最大身高 {max_bh}px → 统一 SCALE={SCALE:.4f} (最高姿态填到 {TARGET_H}px,其余按比例更矮)")

    # 4. PASS 2: 同一 SCALE 缩放 + 脚底锁定 + 白底转 alpha + 色彩迁移
    for old in outdir.glob(f"{action}-*.png"): old.unlink()
    heights = []
    for i, (p, mnx, mny, mxx, myy, bw, bh) in enumerate(metas):
        im = Image.open(p).convert("RGB"); px = im.load()
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
        nw = max(1, round((bw+1)*SCALE)); nh = max(1, round((bh+1)*SCALE)); crop = crop.resize((nw, nh))
        f = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        f.alpha_composite(crop, (round(SIZE/2-footx*SCALE), GROUND-nh))   # 脚底锁 GROUND,头顶随姿态起伏
        f.save(outdir/f"{action}-{i:02d}.png")
        fp = f.load(); mny2 = SIZE; myy2 = 0
        for yy in range(SIZE):
            for xx in range(0, SIZE, 3):
                if fp[xx, yy][3] > 40: mny2 = min(mny2, yy); myy2 = max(myy2, yy)
        heights.append(myy2-mny2)
    print(f"写出 {N} 帧 -> {outdir}")
    print(f"各帧身高(弧线动作应起伏变化,非恒定): {heights}")


if __name__ == "__main__":
    main()
