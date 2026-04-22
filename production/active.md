# Active Work State

Last updated: 2026-04-22

## Current Objective

**设计阶段冻结，转入原型阶段**。spec 已收口到 v1.9，接下来不再扩写 M11-M33，而是做两个关键原型验证：
- **P1-a 安全原型**：M01（分类与归纳）—— 验证基础管线（Cocos Creator + Arrog 式统一手绘墨线 + 低饱和配色 + 拖拽交互 + ToolCard 产出）
- **P1-b 危险原型**：M30 隐喻熔炉（概念融合）或 M31 时间晶体（节奏构造）—— 验证 Stage 5 "命名仪式"能否产生真实认知动作体验。此原型若失败，Stage 5 整体砍掉或重构。

## Current Phase

- **Design: FROZEN at v1.9**
- **Prototyping: about to start**

## In Scope

- 搭建 Cocos Creator 3.8+ 项目脚手架
- 实现 M01 完整可玩版本（占位美术）
- 实现 M30 或 M31 的 Stage 5 原型，专门测试"命名仪式"的可行性
- 设计并实现 ToolCard 数据结构 + Journal/Toolkit UI 的最小可用版本
- 搭建 AI 美术 LoRA / 提示词管线（统一手绘墨线 + 低饱和淡彩）

## Out Of Scope

- **扩写 M11-M33 的详设**（明确停止——Codex Round 3 诊断此为"精致拖延"）
- 后端 / 云同步 / 个性化系统（P10 以后）
- 微信小游戏发布（与成人向定位需要重新评估）

## Important Decisions (v1.9 收口点)

1. **受众**：成人及青年（16+）。明确**不做儿童产品**——认知工具对儿童过于抽象。
2. **核心体验**：**修复即提炼**（不是学习）—— 唤起 / 命名 / 整理玩家已有的模糊认知直觉。
3. **关卡数**：50 → **33 关**（10-6-7-5-5 金字塔分布），按玩家 A+B 正交性裁定。
4. **美术设计已替换**：统一采用 Arrog 式简约手绘语言——清晰可见的墨线轮廓、低饱和淡彩、功能性简约机械、大量留白；颜色服务线条，不再使用“角色水彩 / 世界墨线 / Klee 饱和填色”的分层方案。
5. **整体风格锚点已入库**：`docs/design/style-references/2026-04-22-unified-handdrawn-style-anchor.png` 作为全项目视觉审稿与提示词对齐基准，重点学习“留白、线条、简化机械、尺度关系”，避免跑回淡水彩氛围图或复杂机械插画。
6. **关键机制**：**认知工具册**（§6.5）—— 每关产出 ToolCard，正面感性（工具名+场景+结晶）/ 反面理性（何时使用+生活例子+常见陷阱）。
7. **技术栈**：Cocos Creator 3.8+ / TypeScript / Dragon Bones 或 Cocos Skeleton2D（Spine Pro 已废弃）。
8. **财务定位**：用户明确"现阶段不考虑成本" —— passion project 优先，商业账延期。
9. **来自 Codex Round 3 的必做验证**：M01 和 Stage 5 原型必须先跑通，否则后续扩写无意义。

## Risks / Blockers

### 来自 Codex Round 3 诊断的三大系统性风险
- **Stage 5 命名仪式可能是空壳盖章** —— 若 M30/M31 原型无法让玩家真实经历那个认知动作，整个游戏核心卖点破产
- **认知工具册可能反噬游戏本体** —— 玩家把卡片当经验值集邮，跳过关卡本身
- **反面文案废话工厂** —— 33 张卡 × 多条内容若由 AI 批量生成，会变成新的"AI 味注释系统"

### 已承认但延期处理的风险
- 商业可行性（Codex Round 1-2 的"卖给谁"和"回不了本"批评）——passion project 路线下暂缓
- M34 拉普拉斯沙盘被砍可能是错的（Codex 两轮坚持应该保留）——待 Stage 5 原型结果后再评估是否加回

### 仍需监控的风险
- v1.9 spec 已近 1050 行，后续任何修改必须警惕"自我繁殖"重新启动
- 继续改 spec 的诱惑远大于去写 Cocos 代码的诱惑——这是作者心理定势，需要用"原型验证优先"原则硬性对抗
- 美术风格曾多次向“淡水彩氛围图”或“复杂机械插画”跑偏——后续出图必须以“线条优先、装饰减少、结构可信”为硬约束

## Next Recommended Step (immediate)

**立即开始 P0 引擎搭建 + P1-a M01 原型的 TypeScript 骨架**：
1. 用 `npx create-cocos-project` 或手动搭建 Cocos Creator 3.8+ 项目
2. 实现 PuzzleConfig / ToolCard 的 TypeScript 接口（按 §3.3 和 §6.5）
3. 实现 M01 的 JSON 配置文件（按 §5.2）
4. 写 M01 的最小可玩版本（占位方块美术，先跑通交互+胜利判定）
5. 完成后立即转 P1-b Stage 5 原型

**不再做的事**：
- ❌ 扩写 M11-M33 的详设
- ❌ 给 spec 新增章节
- ❌ 继续优化措辞 / 加 meta 层

## Verification Evidence

- Spec 收口到 v1.9（2026-04-20），Codex Round 3 审阅完成，诊断记入 §七 路线图 + §十 风险表
- 2026-04-22 已将美术主轴改为 Arrog 式统一手绘墨线 + 低饱和淡彩，并落盘到 `docs/design/game-design-spec.md` §4
- 2026-04-22 已将整体风格参考图入库到 `docs/design/style-references/2026-04-22-unified-handdrawn-style-anchor.png`，并补充提炼规则到 `docs/design/style-references/README.md`
- 会话记录见 `.context/codex-session-id`（019da998-3185-7db3-9ae8-4a74a1ab7330）
- 五阶段调性保真度审计见 `docs/design/stage-tonality-verification.md`
- 50→33 去重过程见 `docs/design/tool-dedup-audit.md` + `docs/design/50-puzzle-comparison.md`
