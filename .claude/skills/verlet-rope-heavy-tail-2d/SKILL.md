---
name: verlet-rope-heavy-tail-2d
description: |
  2D 游戏吊挂重物的软绳物理(割绳子式): 篮子/糖果/吊灯被撞后"弹起→被绳拽住乱晃→渐收"。
  Use when: (1) 吊挂物被顶/撞后要走真实软绳物理而非弹簧或脚本 tween, (2) 已有 Verlet 绳但
  "重物像挂在弹簧上来回弹"或"竖直方向顶不起来"(双向约束在吃竖直冲击), (3) 绳物理在不同帧率
  下快慢不一致(子步取整丢余数), (4) 想把"重物+绳"做成两套系统发现各种脱节。核心: 重物=链尾
  高质量粒子(单一系统), 约束仅拉伸侧, 固定子步+余数累加器。
author: Claude Code
version: 1.0.0
date: 2026-06-12
---

# 2D 重尾 Verlet 软绳(割绳子式吊挂物理)

## Problem
吊篮/糖果式吊挂物被从下顶起后,要呈现"弹起(绳松弛)→ 落回被绳拽住 → 左右乱晃渐收"的真实软绳感。
直觉做法(重物单独做钟摆/弹道 + 绳子只做视觉链跟随、或用引擎弹簧关节)出来的是"弹力绳"或两套
系统互相打架;照抄文献的双向距离约束又会把竖直冲击吃掉。

## Context / Trigger Conditions
- 用户反馈:"篮子像弹簧""被顶起后没有被绳子拽着乱晃""头都顶上去了篮子纹丝不动"。
- 数值症状: 纯竖直 kick(vx=0)几乎不抬升(实测双向约束下 650px/s 只抬 ~11px, 带侧向才 76px)。
- 不同机器/帧率下绳子明显快慢不同(48fps 比 60fps 快 ~20%)。

## Solution(业界标准 = Jakobsen GDC2001 / Cut the Rope 同族)
1. **单一系统: 重物 = 链的末端粒子**,不是独立物体。粒子带 `invMass`: 钉死端 0、普通绳点 1、
   重物端小值(如 0.05 ≈ 20 倍质量)。距离约束修正按 invMass 比例分摊(绳让位、重物稳)。
2. **距离约束【仅拉伸侧】**: `if (dist <= segLength) continue;` 压缩(松弛)段不撑开——真软绳
   会垮不会顶。⚠️ 双向投影(文献常见写法)会把"链上方被压缩"翻译成把重物推回去 → 竖直顶击被吃掉。
3. **固定子步 + 余数累加器**: `acc += dt; steps = floor(acc/substepDt); acc -= steps*substepDt;`
   (上限 ~16 步防卡顿螺旋, 截断时夹住 acc)。⚠️ `round(dt/substepDt)` 丢余数 → 帧率相关
   (48fps 每帧 3 步=快 20%, 50fps 2 步=慢 17%)。
4. **冲击 = 改链尾 prev**: `tail.px -= vx*substepDt; tail.py -= vy*substepDt`(Verlet 速度注入,
   可叠加)。侧向分量从物理来源取(如 撞击者偏离重物中心的横向距离 × 系数, 封顶)→ 乱晃方向可信。
5. 落回绷紧瞬间: 径向速度被位置投影吸收(不可拉伸、不回弹=非弹簧), 切向保留 → 钟摆乱晃,
   靠每子步 damping(~0.995)渐收。
6. 渲染与物理解耦: 同一条链可渲成多股(如两股吊带从钉子 splay 到重物两耳: 第 i 点横向偏移
   ±halfWidth×(i/(n-1)))。

## Verification(写成单测, 全部纯逻辑无引擎依赖)
- 静置 5s: 尾端悬在钉子正下方 ≈ 绳长处, 无侧漂、无 NaN。
- 纯竖直 kick: 抬升 > 60px(防双向约束回归)。
- 帧率无关: 同一真实时长在 30/48/60fps 下尾端峰值差 < 4px(防取整丢余数回归)。
- 乱晃: 侧向 kick 后尾端 x 过零 ≥3 次且前 1/3 段摆幅 > 末 1/3 段 ×2(摆动+衰减)。
- 质量加权: 人为拉伸末段后步进一次, 轻绳点位移 > 重尾位移 ×3。

## Example
本仓 `assets/scripts/cocos/M01RopePhysics.ts`(纯模块) + `tests/cocos/M01RopePhysics.test.ts`
(8 测试) + 消费端 `M01IntroSequence.ts`(链尾驱动篮子节点位移, 内胆/冻结子节点自然跟随,
不引刚体 → 无"静态子体不随动态父体"脱节)。

## Notes
- 迭代次数经验 ≈ 2×粒子数(12 点 → 24 迭代); 越多越不可拉伸。
- damping 是【每子步】系数: 0.995@120Hz ≈ 每秒保留 0.55, 别把"每帧"系数(如 0.86)直接拿来
  当子步系数(会瞬间冻死)。
- 重物节点跟随链尾用【节点位移】而非刚体, 子节点(容器内胆/冻结的内容物)免费跟随。
- See also: skill `jimeng-video-to-sprite-frames`(同项目的角色帧动画管线)。

## References
- Thomas Jakobsen, "Advanced Character Physics" (GDC 2001) — Verlet + 迭代约束的源头。
- https://toqoz.fyi/game-rope.html — 工程实践(迭代数/固定步长/插值)。
- https://www.owlree.blog/posts/simulating-a-rope.html — 距离约束推导。
