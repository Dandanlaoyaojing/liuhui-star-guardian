# 莱米动作源视频归档

这些是即梦(dreamina/Seedance 2.0)生成的**原始动作短视频**,是莱米所有逐帧动画的源头。
**永久保留**——以后任何动作想加密(多抽帧让动画更顺),直接从这里重抽,不用再花积分重新生成。

## 文件清单

| 源视频 | 对应动作 | 已抽帧数 | 运行时帧目录 |
|---|---|---|---|
| `lemmy-idle-source.mp4` | 待机(呼吸+耳朵微动) | 12 | `assets/resources/art/characters/lemmy/idle/` |
| `lemmy-walk-source.mp4` | 走路(纯侧面朝左小碎步) | 36 | `assets/resources/art/characters/lemmy/walk/` |
| `lemmy-reach-source.mp4` | 够篮(踮脚伸手) | 18 | `assets/resources/art/characters/lemmy/reach/` |
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
- **走路/待机**(循环、身高应恒定): 用 extract-frames.py 的逐帧等高归一化
- **够篮**(有蹲→伸高度弧线): 改用统一缩放+脚底锁定(见 reach 的抽帧逻辑),**不要等高归一化**否则毁掉踮脚

## 为什么源视频在 assets/ 不在 temp/

`temp/` 被 .gitignore 忽略会随时丢失。这些源视频是不可再生的关键资产(重新生成要花积分且可能漂移),
所以放 `assets/` 进 git 永久保存。

## 朝向
莱米脸朝左 → 只能向左走;游戏里朝右用 `scaleX = -1` 镜像翻转,不需要单独存朝右源视频。

## 发行平台
iOS App + Steam(PC/Mac),无 4MB 包体限制,帧数可按动画质量需要给足(复杂动作可多抽)。
