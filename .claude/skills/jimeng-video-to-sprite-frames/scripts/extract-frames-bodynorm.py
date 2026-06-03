#!/usr/bin/env python3
"""按【身体高度(不含耳朵)】归一化抽帧 —— 治"长耳角色走路时身子忽大忽小"。

为什么需要它(对比另两个抽帧脚本):
  - extract-frames.py     : 按【含耳总高】逐帧等高归一化。长耳角色走路耳朵上下摆 → 含耳总高在变,
                            硬拉平总高时"耳朵竖起的帧整体被缩小(身子变小)、耳朵放平的帧被放大(身子变大)"
                            → 身子忽大忽小。
  - extract-frames-arc.py : 全程统一缩放(保留高度起伏)。修不掉即梦原始视频常自带的"越走越小"真实尺寸漂移。
  - 本脚本                : 按【身体高度 = 头顶(不含耳) 到 脚底】逐帧归一化 → 身子恒定大小,
                            同时修掉即梦尺寸漂移 + 耳朵摆动干扰;耳朵在身体上方自然摆动(总高随耳变,正常)。
  适用: 长耳/长附肢角色的【循环行走/待机】,且即梦原始视频有尺寸漂移时。

头顶检测: 自上而下第一行"不透明宽度 >= HEAD_FRAC × 该帧最大行宽"处(耳朵窄、头身宽 → 跳过窄耳尖)。

用法: extract-frames-bodynorm.py <视频.mp4> <canonical.png> <输出目录> <动作名> [帧数] [seg_lo] [seg_hi]
"""
import colorsys, math, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image

SIZE = 512
TARGET_BODY_RATIO = 0.70   # 身体(不含耳)占画布高度; 上方留给耳朵。0.70*512≈358, 加耳~70 ≈ 430 与 idle/walk 一致
GROUND_RATIO = 0.96
WHITE_BG = 240
HEAD_FRAC = 0.42           # 行宽 >= 0.42×最大行宽 视为头/身(非耳)
DEF_SEG_LO, DEF_SEG_HI = 0.2, 0.9


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


def head_top_y(px, mnx, mny, mxx, myy):
    """自上而下第一行宽度>=HEAD_FRAC*最大行宽 → 头顶(跳过窄耳尖)。"""
    roww = []
    for y in range(mny, myy+1):
        xs = [x for x in range(mnx, mxx+1) if min(px[x, y][0], px[x, y][1], px[x, y][2]) < 232]
        roww.append((y, (xs[-1]-xs[0]) if xs else 0))
    maxw = max((wd for _, wd in roww), default=1)
    thr = HEAD_FRAC*maxw
    for y, wd in roww:
        if wd >= thr:
            return y
    return mny


def main():
    if len(sys.argv) < 5:
        sys.exit("用法: extract-frames-bodynorm.py <视频.mp4> <canonical.png> <输出目录> <动作名> [帧数] [seg_lo] [seg_hi]")
    video, canonical, outdir, action = sys.argv[1:5]
    N = int(sys.argv[5]) if len(sys.argv) > 5 else 24
    seg_lo = float(sys.argv[6]) if len(sys.argv) > 6 else DEF_SEG_LO
    seg_hi = float(sys.argv[7]) if len(sys.argv) > 7 else DEF_SEG_HI
    outdir = Path(outdir); outdir.mkdir(parents=True, exist_ok=True)

    tmp = Path(tempfile.mkdtemp())
    ff = "/opt/homebrew/bin/ffmpeg" if Path("/opt/homebrew/bin/ffmpeg").exists() else "ffmpeg"
    subprocess.run([ff, "-y", "-i", video, "-vf", "mpdecimate,setpts=N/FRAME_RATE/TB",
                    "-vsync", "vfr", str(tmp/"d-%03d.png")], check=True, capture_output=True)
    fs = sorted(tmp.glob("d-*.png"))
    print(f"去重独立帧: {len(fs)}")
    seg = fs[int(len(fs)*seg_lo):int(len(fs)*seg_hi)]
    idxs = [round(i*(len(seg)-1)/(N-1)) for i in range(N)]
    picked = [seg[i] for i in idxs]

    (tSm, tSsd), (tVm, tVsd) = canonical_stats(canonical)
    TARGET_BODY = int(SIZE*TARGET_BODY_RATIO); GROUND = int(SIZE*GROUND_RATIO)

    for old in outdir.glob(f"{action}-*.png"): old.unlink()
    bodyhs = []
    for i, p in enumerate(picked):
        im = Image.open(p).convert("RGB"); w, h = im.size; px = im.load()
        mnx, mny, mxx, myy = bbox(px, w, h); bh = myy-mny; bw = mxx-mnx
        hty = head_top_y(px, mnx, mny, mxx, myy)
        body_h = max(1, myy - hty)              # 身体高度(不含耳)
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
        sc = TARGET_BODY/body_h                 # ★ 按身体高度归一化(不含耳)
        nw = max(1, round((bw+1)*sc)); nh = max(1, round((bh+1)*sc)); crop = crop.resize((nw, nh))
        f = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        f.alpha_composite(crop, (round(SIZE/2-footx*sc), GROUND-nh))
        f.save(outdir/f"{action}-{i:02d}.png")
        # 自检(基于 alpha): 输出帧身体高(头顶不含耳→脚)应≈恒定
        fp = f.load(); rows = []
        for yy in range(SIZE):
            xs = [xx for xx in range(0, SIZE, 2) if fp[xx, yy][3] > 40]
            rows.append((yy, (xs[-1]-xs[0]) if xs else 0))
        maxw = max((wd for _, wd in rows), default=1); thr = HEAD_FRAC*maxw
        foot = max((yy for yy, wd in rows if wd > 0), default=0)
        htop = next((yy for yy, wd in rows if wd >= thr), 0)
        bodyhs.append(foot-htop)
    print(f"写出 {N} 帧 -> {outdir}")
    print(f"各帧身体高(不含耳,应≈恒定~{TARGET_BODY}): {bodyhs}")


if __name__ == "__main__":
    main()
