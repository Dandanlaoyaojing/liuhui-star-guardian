# 提示漫画绘画风格提示词

> 状态：2026-07-11 从 M01 提示漫画第一格定稿图提取，作为全游戏提示漫画出图 / 手绘落地的专用风格锚点。
> 视觉锚点：`docs/design/generated-m01-art-slices/m01-hint-comic-panel-01-bump-basket-final.png`

## 风格提取

这套提示漫画不是正式关卡场景插画，而是像藏在游戏世界里的无字小纸片：轻、安静、可读，第一眼只让玩家看见一个动作。

- **媒介**：米白纸底上的冷淡蓝灰铅笔线稿，辅以极薄的低饱和水彩。线条先成立，颜色只轻轻贴在线条下面。
- **线条**：细、浅、略抖，带手绘铅笔 / 淡墨的粗细变化；不做硬黑描边，也不做干净矢量线。
- **上色**：像被水轻轻带开的淡彩，而不是厚涂。色块透明、克制，可见纸感，但不能脏、不能满屏噪点。
- **留白**：大量干净纸面留白。每格只有一个主要动作，主物件居中或偏中心，背景只保留必要的地面阴影和少量运动线。
- **角色**：莱米保持小体量、淡紫色、长耳、表情克制；不能变成圆润吉祥物、动漫大眼角色或高饱和卡通角色。
- **道具**：使用真实谜题道具的造型语言，但简化到一眼可读。机械 / 绳索 / 篮子 /碎片等都要保持手工画出来的轻质感。
- **提示符号**：允许单个手绘箭头、点按标记、晃动线、运动线、幽灵前后姿态；它们也必须是同一支浅蓝灰铅笔画出来的。

## 可复用英文提示词

把第一句替换成具体格子的动作和对象；其余风格块尽量原样保留。

```text
Create one wordless puzzle-game hint comic panel showing [PANEL_ACTION_WITH_REAL_PUZZLE_PROPS].

Draw it as a delicate pencil-and-watercolor sketch on warm off-white paper. Use thin, slightly wobbly blue-gray pencil / pale ink outlines, very light low-saturation watercolor washes, subtle paper texture, soft pooled pigment, and large quiet negative space. The panel should feel like a small diegetic paper hint found inside the game world: gentle, handmade, readable, and quiet.

Keep the composition simple: one clear action, one clear focus, full objects visible, no clutter. Lemmy, if present, is a small pale-lavender rabbit with long ears, restrained features, and the same light hand-drawn line quality. Puzzle props should match the real game object shapes but remain simplified and functional. Use only sparse diagrammatic cues such as one hand-drawn arrow, tap mark, wobble line, motion line, or faint before/after ghost pose.

No words, labels, numbers, speech bubbles, captions, UI panels, readable signs, heavy black outlines, clean vector art, anime style, cute mascot exaggeration, glossy 3D rendering, realistic metal, dense background, saturated colors, decorative machinery, dramatic lighting, dirty old-paper stains, or watercolor blur that weakens the linework.
```

## 中文短版

```text
单格无字提示漫画，米白纸底，冷淡蓝灰铅笔 / 淡墨线，极薄低饱和水彩，大量留白。每格只画一个动作；道具造型遵循真实游戏物件但强力简化；莱米是小体量淡紫兔子，表情克制。只允许手绘箭头、点按标记、晃动线、运动线、前后幽灵姿态等图像提示。禁止文字、数字、对白、UI、厚黑描边、矢量感、动漫感、3D 金属、复杂背景、高饱和色、脏旧纸噪点和冲淡线稿的水彩糊化。
```

## 拒收清单

- 看起来像完整宣传插画，而不是一张轻量提示纸片。
- 背景补满星空、舱室、复杂机械，抢走动作焦点。
- 线条太黑、太粗、太干净，或变成规则矢量图标。
- 水彩太浓、太糊，导致篮子、绳索、碎片、角色轮廓不清。
- 莱米过度可爱化：大眼、圆头、卡通高饱和紫、夸张表情。
- 使用真实文字、伪文字、编号、标签、对白框或系统 UI 框。
- 提示符号太多，一格里同时出现多个箭头、多个手势或多个动作。

## 使用关系

- M01 第一格是当前唯一已确认的提示漫画视觉样张。
- `stage1-hint-comic-storyboards.md` 规定每关画什么；本文规定提示漫画应该怎么画。
- 全局美术仍遵循 `game-design-spec.md` §4.1 的线条优先、低饱和淡彩、功能性简约机械原则；本文只是提示漫画这个载体的更轻、更纸面化子风格。
