# 莱米动作源视频归档

这些是即梦(dreamina/Seedance 2.0)生成的**原始动作短视频**,是莱米所有逐帧动画的源头。
**永久保留**——以后任何动作想加密(多抽帧让动画更顺),直接从这里重抽,不用再花积分重新生成。

## 文件清单

| 源视频 | 对应动作 | 已抽帧数 | 运行时帧目录 |
|---|---|---|---|
| `lemmy-idle-source.mp4` | 待机(呼吸+耳朵微动) | 24 | `assets/resources/art/characters/lemmy/idle/` |
| `lemmy-walk-source.mp4` | 走路(**正面3/4**,小幅晃;area-norm锁尺寸) | 48 | `assets/resources/art/characters/lemmy/walk/` |
| `lemmy-reach-source.mp4` | 够篮(踮脚伸手) | 36 | `assets/resources/art/characters/lemmy/reach/` |
| `lemmy-startle-source.mp4` | 受惊(被砸→低头→吃惊瞪眼→恢复) | 29 | `assets/resources/art/characters/lemmy/startle/` |
| `lemmy-crouch-source.mp4` | 蹲下(站定→下蹲→蹲住,准备拾取) | 40 | `assets/resources/art/characters/lemmy/crouch/` |
| `lemmy-firstframe-white.png` | 生成上述视频用的首帧(canonical 白底版) | — | — |

规格: 全部 1440×1440, 5s, 60fps, 去重后约 56-120 独立帧。运行时帧 **512²**(2026-06-05 起,旧版 384²)。

## 2026-06-05 全套重抽 + 对齐原图处理 (更顺滑)
5 套全部从源视频重抽、帧数加密、运行时尺寸 384²→**512²**(iOS+Steam 无包体限制,质量优先)。
每帧统一收尾链路:
1. 抽帧(下方对应脚本)→ 色彩迁移到 canonical;
2. **`scripts/lemmy-tone-match.py`** —— 把每帧身体 V 对比度拉到 canonical 的 `V.std=0.160`(治"抽帧+LANCZOS缩放后比定妆图发平",同口径实测帧只有 0.143);
3. **`scripts/lemmy-pencil-outline.py`** —— 浅铅笔灰外描边(W 按内容高度缩 / 0.45 颗粒 / 深浅不一);
4. `oxipng -o4` 无损。
- ⚠️ **walk 专属一步:area-norm**(按整体不透明面积统一缩放锁尺寸)。即梦逐帧体积抖动~8-11%,**走路恒定大小会暴露成"忽大忽小"**;bodynorm 只锁身高治不了(宽度仍摆 26%),改**锁面积**(面积摆幅 11.6%→**0.7%**)即可,均匀缩放不变形。
- **walk 源 = 正面 3/4(已归档 `lemmy-walk-source.mp4`)**,非纯侧面(用户 2026-06-05 选定;纯侧面 crouch 源的宽度摆幅更大 34%)。
- `.meta` 为 512² 重建(`trimType: none` 满画布保逐帧脚底对齐;新 UUID,帧序列尚未接进 `LemmyActor`、无引用)。改帧后需在 Cocos 里 reimport 注册。

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
1. `extract-frames-arc.py … startle 40 0.0 1.0` 先抽 40 帧(2026-06-05 加密版;旧版 30→23);
2. 棕果从 #0 上方下落、**#1–#12 贴头(污染)**、~#13 起弹走;arc 主簇 bbox 能剔除"悬空"高处果子,但贴头那几帧剔不掉;
3. **重组** = `[#0, #0] + #13..#39`(丢掉带果子的 #1–#12),得到 **29 帧**:中性→[跳过带果子的低头]→低头到底→抬头吃惊→恢复;
4. 再 tone-match + 铅笔描边 + `oxipng`(见「全套重抽」节;不再压到 384²)。
所以**直接重抽会把果子带回来**,必须按上面重组步骤剔除。
另:吃惊帧的眼睛是即梦的"大白眼+黑点"——试过 prompt 明确要求"只微睁、保持深褐圆眼珠"即梦仍画大白眼,合成褐眼珠被否决,最终采用即梦原样白眼。

## 为什么源视频在 assets/ 不在 temp/

`temp/` 被 .gitignore 忽略会随时丢失。这些源视频是不可再生的关键资产(重新生成要花积分且可能漂移),
所以放 `assets/` 进 git 永久保存。

## 朝向
莱米脸朝左 → 只能向左走;游戏里朝右用 `scaleX = -1` 镜像翻转,不需要单独存朝右源视频。

## 发行平台
iOS App + Steam(PC/Mac),无 4MB 包体限制,帧数可按动画质量需要给足(复杂动作可多抽)。
