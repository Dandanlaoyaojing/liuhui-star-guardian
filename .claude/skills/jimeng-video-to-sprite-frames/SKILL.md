---
name: jimeng-video-to-sprite-frames
description: |
  用即梦(dreamina/Seedance 2.0)把一张定妆角色图做成游戏 2D 精灵逐帧动画(走路/待机/伸手等),
  且严格保持角色形象不漂移、大小不忽大忽小。适用场景:(1)已有一张干净透明的角色定妆图,
  想做成游戏里循环播放的帧动画;(2)用 AI 视频生成角色动作但发现"越走越大/脸变形/多出第二只眼/
  掉色/帧太少卡顿";(3)需要把生成的 mp4 抽帧、抠透明、对齐成可直接进 Cocos/引擎的精灵帧。
  覆盖即梦 CLI 调用、frames2video 首尾帧双锁防漂移、prompt 只写动作、ffmpeg 抽帧、
  逐帧等比等高归一化、白底转 alpha、HSV 色彩迁移、2D 朝向镜像翻转。
author: Claude Code
version: 1.0.0
date: 2026-05-29
---

# 即梦视频 → 游戏精灵帧动画管线

## 问题

要把一张角色定妆图(如莱米 canonical)做成游戏里能循环播放的 2D 逐帧动画(走路/待机/够东西)。
直接用 AI 反复生图会身份漂移;纯引擎变换像橡皮膜;手绘成本高。
**有效路线:用即梦图生视频生成一段动作,再抽帧做成精灵帧。** 但这条路有一堆坑,
本 skill 是踩平后的成品管线。

## 触发条件

- 有一张干净(最好透明)的角色定妆图,想做帧动画
- 出现这些症状之一:角色"越走越大"、脸/比例变形、纯侧脸多出第二只眼、颜色发灰掉色、帧数少导致卡顿
- 需要把 AI 生成的 mp4 转成可进引擎的透明精灵帧

## 前置

- 即梦 CLI `dreamina` 已装(`~/.local/bin/dreamina`),已 OAuth 登录(`dreamina user_credit` 能查余额)
- `ffmpeg` 已装
- 一张角色定妆图(透明 PNG 最佳);若背景是棋盘格/纯色,先用连通域 flood-fill 从四角抠透明(只抠和边缘连通的背景,避免抠掉角色身上浅色造成内部破洞)

## 解决步骤

### 1. 准备首帧输入图
- 角色图转成**白底 PNG**(视频生成用白底比透明稳,后续好抠):`Image.alpha_composite(白底, 透明图)`
- 记下角色**朝向**(看脸和脚指向哪边)——决定只能朝那个方向走,反向靠镜像翻转

### 2. 用即梦生成动作短视频(防漂移的关键全在这步)

强约束清单(全部写进 prompt 或用对命令):

| 目标 | 做法 |
|---|---|
| 大小不变/不漂 | **优先 `frames2video` 首尾帧都用同一张定妆图** → 首尾强制一致,中间被两端拉回。实测首/中/尾帧身高完全一致(228/228/228) |
| 形象不漂 | prompt **只写动作,绝不写美术细节**("红色/蓝灰色水彩"会把模型带跑,尤其"蓝灰色"把暖灰带成冷色) |
| 镜头不动 | prompt 明确"固定机位、不推拉缩放平移、角色同位置同大小" |
| 纯侧脸不长第二只眼 | prompt 明确"全程纯侧面、头不转动、始终只露一只眼、脸朝向不变" |
| 动作幅度 | 单一动作、幅度小、时长 4-5s → 漂移最小 |
| 队列快 | VIP 账号用 `--model_version=seedance2.0_vip`(queue_idx:0 秒进;普通版排免费33万队列);`--video_resolution=1080p` 仅 vip |

走路/位移类动作:让角色**原地踏步**(不要真走出画面),移动靠引擎位移。待机类:`frames2video` 首尾锁同图最稳。
命令模板见 `scripts/gen-video.sh`。
**注意**:`video_url` 后缀不是 .mp4(带 mime_type 参数),下载要解析 JSON 的 `"video_url"` 字段,别按扩展名 grep。

### 3. ffmpeg 抽独立帧
`ffmpeg -i 视频.mp4 -vf "mpdecimate,setpts=N/FRAME_RATE/TB" -vsync vfr 帧-%03d.png`
mpdecimate 去重复帧(60fps 视频实际独立帧约 100-120)。**帧太少会卡顿:走路抽 24-36 帧,待机 12 帧。**

### 4. 逐帧规范化(治"忽大忽小"+抠透明+校色) —— 核心
对中段稳定区均匀取 N 帧,每帧:
1. **测角色 bbox 身高 → 按各自身高等比缩放到统一 TARGET_H**(必须等比!只压高度会变形)
2. **脚底锁定同一 GROUND 基线**、水平按脚部重心对齐 → 不上下跳不左右跳
3. **白底转 alpha**:接近纯白判透明,边缘羽化
4. **HSV 色彩迁移到 canonical**(均值+方差迁移,保 hue 只校 S/V) → 修掉发灰/掉色

完整实现见 `scripts/extract-frames.py`(改 SOURCE/动作名/帧数即可复用)。
验证:输出每帧身高应完全一致(如全 429px)、四角 alpha=0。

### 5. 朝向与移动(游戏侧)
- 角色只能朝定妆图的朝向走;反向用 `scaleX=-1` 镜像翻转,**不要重新生成**
- "走路移动" = 原地踏步循环帧 + 引擎 tween 横向位移(2D 标准做法)

## 验证
- 抽帧后量每帧 bbox 身高,应完全一致(脚本会打印)
- 棋盘背景叠图看透明干净、无内部破洞
- 做循环 GIF 看顺滑度和漂移:`scripts/preview-gif.py`

## 完整案例(莱米 2026-05-29)
- 定妆图:`assets/art/style-references/lemmy-rabbit-canonical.png`(2000²透明带手)
- 待机:`frames2video` 首尾锁同图 5s → 抽 12 帧(避开眨眼帧)→ 身高全 429px
- 走路:`image2video` 纯侧面+小碎步 5s → 抽 36 帧 → 朝左原生,朝右翻转
- 产物:`assets/resources/art/characters/lemmy/{idle,walk}/`

## 注意 / 坑
- **Luma `--modify`(img2img)会累积脏噪点**,别用它做角色微调;要干净图用 text2image 重生
- 即梦长视频(10s+)后段必漂,**拆 3-5s 短视频分动作**
- 即梦 content policy 会误杀正常 prompt(如"举起前爪够东西"被拒),换中性措辞重试
- `frames2video` 首尾同图 → 动作"回到原点"(适合 idle/呼吸/原地循环);要净位移动作首尾用不同姿态图
- 中文文件名在 shell 里是 NFD 编码,grep 匹配不到,用 Python `unicodedata.normalize('NFC',...)` 或按文件大小定位

## References
- 即梦 CLI 安装:`curl -s https://jimeng.jianying.com/cli | bash`(字节官方)
- 相关项目 memory: project_jimeng_identity_consistency, project_img2img_noise_and_video_drift
