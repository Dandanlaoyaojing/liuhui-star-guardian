# M01 通关过场 v2(静态齿轮 + 星光路径)· 合成管线

定稿母版 = `m01-completion-cutscene-master.mp4`(1920×1280 = 设计分辨率 960×640 的 2x, 24fps, 14.35s, 带音轨)。
运行时资产由它派生:iOS 直接用母版 mp4(retina 清晰);Steam 抽 344 帧 960×640 JPG(母版下采样)+ 抽音轨 mp3(见下)。

## 结构

1. **0–3s 齿轮身水彩漩涡**:门开源片的齿轮,用**齿轮形遮罩**(圆盘+齿身+齿牙),漩涡在齿身那圈完整显示、齿牙处切断。
2. **3–7s 圆盘动画**:遮罩收成**中心圆盘圈**(r160);门在圆盘里成形→打开露星。齿牙/齿身由**静态齿轮垫底**(门开源片某帧的齿轮定格),彻底零漂移。
3. **7.3s 交叉过渡**:门开露星 → 星光溢出。
4. **7.3–14.3s 星光路径 finale**:即梦 `multimodal2video` 生成(`finale-starpath-jimeng-raw.mp4`,首帧星芒=ref-1,目标光径云海=ref-2,水彩风)→ 裁 3:2 → 淡出泛白。

## 关键坑与解法(复现必读)

- **源齿轮抖**:门开源片齿轮在 ~4.4s 有个 +8px 拼接台阶(AI 合成)。逐帧检测齿轮 bbox 高 → **中值滤波(w=5,保台阶杀噪声,别用均值会糊台阶)** → REF/检测 缩放归一;齿轮化开(帧>192)后**冻结缩放**别信坏检测。中心固定不逐帧追(追反引噪)。
- **遮罩**:漩涡溢出的是**圆盘**不是齿轮 → 0–3s 用齿轮形遮罩(含齿身),3s 后收圆盘圈。别用内容抠图(会带出齿牙外淡晕)、别用大圆(带白底)。
- **无白框**:齿轮形遮罩合成在米底上,牙外是米纸不是源白底。
- **音轨**:原修复音轨 12.16s < 成片 14.35s;末尾 finale 段做混响拖尾/淡出补足(见音轨命令)。

## 派生运行时资产

```sh
# Steam 帧序列
ffmpeg -i m01-completion-cutscene-master.mp4 -vf fps=24 -q:v 3 completion-frames/frame_%04d.jpg
# 独立音轨
ffmpeg -i m01-completion-cutscene-master.mp4 -vn -c:a libmp3lame -q:a 4 completion-audio.mp3
```

即梦 finale 重生成:`dreamina multimodal2video --image finale-ref-1-starburst.webp --image finale-ref-2-lightpath.webp --prompt "<水彩星光路径演变,泛白>" --ratio 16:9 --duration 7 --model_version seedance2.0_vip --video_resolution 1080p`。

> 归一化/静态齿轮/时变遮罩的逐帧 Python 合成脚本较长,完整实现见会话记录;本目录归档了成片+finale源+参考图,可据此重合成。
