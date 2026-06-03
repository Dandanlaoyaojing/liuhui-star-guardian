# 莱米动作源视频归档

这些是即梦(dreamina/Seedance 2.0)生成的**原始动作短视频**,是莱米所有逐帧动画的源头。
**永久保留**——以后任何动作想加密(多抽帧让动画更顺),直接从这里重抽,不用再花积分重新生成。

## 文件清单

| 源视频 | 对应动作 | 已抽帧数 | 运行时帧目录 |
|---|---|---|---|
| `lemmy-idle-source.mp4` | 待机(呼吸+耳朵微动) | 12 | `assets/resources/art/characters/lemmy/idle/` |
| `lemmy-walk-source.mp4` | 走路(纯侧面朝左小碎步) | 36 | `assets/resources/art/characters/lemmy/walk/` |
| `lemmy-reach-source.mp4` | 够篮(踮脚伸手) | 18 | `assets/resources/art/characters/lemmy/reach/` |
| `lemmy-startle-source.mp4` | 受惊(被砸→低头→吃惊瞪眼→恢复) | 23 | `assets/resources/art/characters/lemmy/startle/` |
| `lemmy-crouch-source.mp4` | 蹲下(站定→下蹲→蹲住,准备拾取) | 24 | `assets/resources/art/characters/lemmy/crouch/` |
| `lemmy-firstframe-white.png` | 生成上述视频用的首帧(canonical 白底版) | — | — |

规格: 全部 1440×1440, 5s, 60fps, 去重后约 100-117 独立帧。

## 怎么重抽帧(加密/调整)

用 skill `jimeng-video-to-sprite-frames` 的脚本:
```
python3 .claude/skills/jimeng-video-to-sprite-frames/scripts/extract-frames.py \
  assets/art/characters/lemmy/source-videos/lemmy-walk-source.mp4 \
  assets/art/style-references/lemmy-rabbit-canonical.png \
  assets/resources/art/characters/lemmy/walk walk 48     # 把36改成48即加密
```
- **待机**(循环、身高应恒定、耳朵基本不动): 用 `extract-frames.py` 的逐帧等高归一化
- **够篮 / 受惊 / 蹲下**(有蹲→伸 / 低头→抬头 / 站→蹲的高度弧线): 用 `extract-frames-arc.py`(统一缩放+脚底锁定+主簇bbox),**不要等高归一化**否则毁掉弧线
  - 蹲下: `extract-frames-arc.py lemmy-crouch-source.mp4 … crouch 24 0.5 1.0`(seg 0.5–1.0 只取"站定→蹲下→蹲住";源视频前半段是没走起来的弱走路、弃用)
- ⚠️ **走路(正侧)别再用即梦抽帧了**: 2026-06-02 试过用即梦生成纯正侧走路,即梦逐帧把身子"画胖画瘦"~10%(固有抖动,等比缩放修不掉),走路要求大小恒定→暴露成忽大忽小。最终走路回退到**第一版斜侧 walk** + 引擎横移。**必须恒定大小的循环走路/待机走引擎变换,别指望即梦帧。**(详见 skill 注意/坑)

## ⚠️ 受惊(startle)重抽须知:源视频里有「小果子」,运行帧是去掉的
即梦把 prompt 里的"小物件落到头顶"真画进了视频:一颗棕色小果先落在头顶、随低头弹动,约前 1s 出现后掉走。
用户要的是**不画出物件**,所以运行帧是这样得到的(不是直接抽):
1. `extract-frames-arc.py … startle 30 0.0 1.0` 先抽 30 帧;
2. 果子只出现在「站立等待」帧(约 f1–f7)和「低头第一帧」f8;f0 干净、f9 起果子已掉走;
3. **重组** = `[f0, f0] + f9..f29`(丢掉 f1–f8 这些带果子/无意义静止的帧),得到 23 帧:中性→猛地低头→抬头吃惊→恢复;
4. 再 `compress-frames.sh … 384`。
所以**直接重抽会把果子带回来**,必须按上面重组步骤剔除。
另:吃惊帧的眼睛是即梦的"大白眼+黑点"——试过 prompt 明确要求"只微睁、保持深褐圆眼珠"即梦仍画大白眼,合成褐眼珠被否决,最终采用即梦原样白眼。

## 为什么源视频在 assets/ 不在 temp/

`temp/` 被 .gitignore 忽略会随时丢失。这些源视频是不可再生的关键资产(重新生成要花积分且可能漂移),
所以放 `assets/` 进 git 永久保存。

## 朝向
莱米脸朝左 → 只能向左走;游戏里朝右用 `scaleX = -1` 镜像翻转,不需要单独存朝右源视频。

## 发行平台
iOS App + Steam(PC/Mac),无 4MB 包体限制,帧数可按动画质量需要给足(复杂动作可多抽)。
