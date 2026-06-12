#!/usr/bin/env python3
"""量莱米各帧集"站姿帧"的身体尺寸(地面真值量具)。

输出每个动作集指定帧的: 总轮廓高 / 去耳身体高 / 最大宽 / 脚底行 / 头顶行。
用途: 为 LemmyActorContract 的 renderScale(逐动作渲染缩放, 治"收耳后变小")提供
实测依据; 任何帧集重抽后重跑本脚本, 核对 contract 里的缩放常数是否还成立。

去耳口径: 自上而下首个"行宽 >= 35% 最大行宽"的行视为头顶(耳朵是窄柱, 头/身是宽体);
身体高 = 脚底行 - 头顶行 + 1。与 2026-06-08 调查口径一致(idle 404 / idleback 302)。

用法: /usr/bin/python3 scripts/lemmy-measure-framesets.py   (需系统 python3 的 PIL+numpy)
"""
from PIL import Image
import numpy as np
import os

LEMMY = "assets/resources/art/characters/lemmy"

# 每集量哪些"站姿/代表"帧: 接缝两端 + 循环中点。
TARGETS = {
    "idle": ["idle-00", "idle-12"],
    "walk": ["walk-00"],
    "reach": ["reach-00", "reach-35"],
    "startle": ["startle-00", "startle-28"],
    "crouch": ["crouch-00"],
    "earsback": ["earsback-00", "earsback-39"],
    "idleback": ["idleback-00", "idleback-24"],
    "walkback": ["walkback-00", "walkback-14"],
    "earsup": ["earsup-00", "earsup-37"],
    "headbutt": ["headbutt-000", "headbutt-123"],
}


def measure(path: str):
    im = np.asarray(Image.open(path).convert("RGBA"))
    a = im[..., 3] > 40
    ys, xs = np.where(a)
    if len(ys) == 0:
        return None
    top, bot = int(ys.min()), int(ys.max())
    roww = a.sum(axis=1)
    maxw = int(roww.max())
    thr = 0.35 * maxw
    head_rows = np.where(roww >= thr)[0]
    head_top = int(head_rows.min()) if len(head_rows) else top
    return {
        "totH": bot - top + 1,
        "bodyH": bot - head_top + 1,
        "maxW": maxw,
        "foot": bot,
        "top": top,
    }


def main() -> None:
    ref = None
    print(f"{'frame':<18}{'totH':>6}{'bodyH':>7}{'maxW':>6}{'foot':>6}{'top':>5}  vs idle bodyH")
    for action, frames in TARGETS.items():
        for fr in frames:
            p = os.path.join(LEMMY, action, fr + ".png")
            if not os.path.exists(p):
                print(f"{fr:<18} (missing)")
                continue
            m = measure(p)
            if action == "idle" and ref is None:
                ref = m
            rel = f"{100 * m['bodyH'] / ref['bodyH']:.0f}%" if ref else "-"
            print(
                f"{fr:<18}{m['totH']:>6}{m['bodyH']:>7}{m['maxW']:>6}{m['foot']:>6}{m['top']:>5}  {rel}"
            )
    if ref:
        print(f"\nidle bodyH = {ref['bodyH']} (renderScale 基准: scale = {ref['bodyH']}/该集站姿 bodyH)")
        print(f"idle foot = {ref['foot']} (脚底锚定 FOOT_FRAC = foot/512)")


if __name__ == "__main__":
    main()
