# Active Work State

Last updated: 2026-06-01

> 这是**当前状态薄层**(CLAUDE.md 要求)。已完成的历史流水归档在 `production/archive/`,细节查那里或 `git log`。

## 当前活跃线:莱米角色动画

**主角原型(canonical) 已定稿** —— 带手、干净无噪点、2000×2000 透明:
- `assets/art/style-references/lemmy-rabbit-canonical.png`(identity 母版,2000²)
- `assets/resources/art/characters/lemmy/lemmy-canonical.png`(runtime)
- `docs/design/style-references/2026-05-28-lemmy-rabbit-canonical.png`(dated 记录)
- 所有旧形象(4-24 低清/无手版/带噪点版/Luma 兔变体)已删,引用全部改向 canonical。

**动画管线 = 即梦图生视频→抽帧**(完整方法见 skill `jimeng-video-to-sprite-frames`):
- 三套动作帧已产出并压缩(512→384/按显示尺寸缩 + oxipng 无损):
  - idle 12 帧 `assets/resources/art/characters/lemmy/idle/`(frames2video 首尾锁,等高归一化)
  - walk 36 帧 `.../walk/`(纯侧面朝左小碎步,等高归一化;朝右用 scaleX=-1 翻转)
  - reach 18 帧 `.../reach/`(够篮,统一缩放保留蹲→伸高度弧线)
- 源视频归档 `assets/art/characters/lemmy/source-videos/`(进 git,可重抽更多帧)
- 关键经验进 memory: 即梦防漂移(frames2video 双锁/prompt 只写动作/纯侧面防第二只眼)、pngquant 安全边界(高对比可用/低对比水彩会掏空→用 oxipng)、复杂动作可多抽帧。

**下一步**:把 idle/walk/reach 帧表接进 Cocos `LemmyActor`,在 M01 跑起来(莱米从右走入→够篮→篮子物理晃动打翻)。
codex 的 `LemmyActorContract.ts` 取消契约(`LemmyActionInterrupted`/`LemmyActorDestroyed`/`createLemmyCancellationContext`)可复用;M01IntroSequence 已有接入 diff。

## 发行平台(2026-06-01 定)
iOS App + Steam(PC/Mac)。放弃 Web/微信小游戏/安卓 → 微信 4MB 包体限制不再适用,动画帧数可按质量给足。CLAUDE.md / game-design-spec.md 已同步。

## 仓库整洁(2026-06-01)
- 删了无引用的 PSD(`m01-reference-psd-slices/` 55个 + `source/` 旧迭代版 7个,共~44MB)。
- 运行时图压缩 17MB→8.4MB(按 displaySize×2.5 等比缩 + oxipng 无损,meta/UUID 不变引用不断,画质 OK)。
- `.git` 历史重写(清历史里的大文件旧版)评估后**不做** —— 高风险(10分支+worktree+force-push)换低收益(省80MB,不影响项目本身),当前工作区清爽即达标。

## M01 现状
M01(秩序之基首关)美术/物理/手电/拼片已于 2026-05-26 收口。详细调试历史见 `production/archive/2026-05-m01-polish-log.md`。
权威玩法 spec: `docs/design/game-design-spec.md` §5.2。
