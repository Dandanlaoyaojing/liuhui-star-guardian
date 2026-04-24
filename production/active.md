# Active Work State

Last updated: 2026-04-24

## Current Objective

**设计阶段冻结，转入原型阶段**。spec 已收口到 v1.9，接下来不再扩写 M11-M33，而是做两个关键原型验证：
- **P1-a 安全原型**：M01（分类与归纳）—— 验证基础管线（Cocos Creator + Arrog 式统一手绘墨线 + 低饱和配色 + 拖拽交互 + ToolCard 产出）
- **P1-b 危险原型**：M30 隐喻熔炉（概念融合）—— 验证 Stage 5 "命名仪式"能否产生真实认知动作体验。选 M30 而非 M31 的理由：M30 概念融合是 Stage 5 里打分最高、最典型的"范式生成"动作（Codex Round 4 独立评分 9/10），用最硬的关卡试金石失败了才真正证明 Stage 5 不成立。此原型若失败，Stage 5 整体砍掉或重构。

**当前执行焦点**：M01 第一关灰盒原型继续推进中，计划文件见 `docs/plans/2026-04-24-m01-prototype-plan.md`。当前已从“可完成并展示最小 ToolCard 预览”推进到“带提示 / 错误反馈 / 修复态的可测试灰盒”，下一步应把点击式灰盒升级为拖拽式灰盒，再进入首个美术切片校准。

## Current Phase

- **Design: FROZEN at v1.9**
- **Prototyping: M01 greybox runtime playable; hints, error feedback, repair state, and completion ToolCard preview added**
- **Local toolchain**: Cocos Creator 3.8.8 installed at `/Applications/CocosCreator-3.8.8.app` on 2026-04-24.
- **Cocos project integration**: repo now has Cocos Creator 3.x project metadata (`.creator/`, `settings/v2/`, shared `profiles/v2/packages/scene.json`) and generated `.meta` files for current assets.
- **Local editor automation**: Cocos MCP server plugin installed locally at `extensions/cocos-mcp-server/` and configured to auto-start on `127.0.0.1:3000` when Cocos opens this project.

## In Scope

- 搭建 Cocos Creator 3.8+ 项目脚手架
- 实现 M01 完整可玩版本（占位美术）
- 实现 M30 的 Stage 5 原型，专门测试"命名仪式"的可行性（不再"M30 或 M31"二选一，锁死 M30）
- 设计并实现 ToolCard 数据结构 + Journal/Toolkit UI 的最小可用版本
- 搭建 AI 美术 LoRA / 提示词管线（统一手绘墨线 + 低饱和淡彩）
- 生成 Stage 1 场景概念图，验证统一手绘风格能否覆盖多种谜题装置
- 将已选中的 Stage 1 场景图落成项目内可复用美术资产

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
6. **游戏界面参考图已入库**：2026-04-23 新增两张界面/面板参考图，定位为服务本游戏开发的通用 UI 与面板资产基准，不再按外部工具界面方向解释；文件见 `docs/design/style-references/2026-04-23-game-interface-style-reference.png` 与 `docs/design/style-references/2026-04-23-game-ui-board-style-reference.png`。
7. **莱米角色参考图已入库**：2026-04-24 新增 `docs/design/style-references/2026-04-24-lemmy-rabbit-style-reference.png`，作为莱米 / 小兔子主角的造型、比例、线条和陶土红 / 灰蓝低饱和彩色块基准；资产副本见 `assets/art/style-references/lemmy-rabbit-style-reference.png`。
8. **关键机制**：**认知工具册**（§6.5）—— 每关产出 ToolCard，正面感性（工具名+场景+结晶）/ 反面理性（何时使用+生活例子+常见陷阱）。
9. **技术栈**：Cocos Creator 3.8+ / TypeScript / Dragon Bones 或 Cocos Skeleton2D（Spine Pro 已废弃）。
10. **财务定位**：用户明确"现阶段不考虑成本" —— passion project 优先，商业账延期。
11. **来自 Codex Round 3 的必做验证**：M01 和 Stage 5 原型必须先跑通，否则后续扩写无意义。

## Risks / Blockers

### 来自 Codex Round 3 诊断的三大系统性风险
- **Stage 5 命名仪式可能是空壳盖章** —— 若 M30 原型无法让玩家真实经历那个认知动作，整个游戏核心卖点破产
- **认知工具册可能反噬游戏本体** —— 玩家把卡片当经验值集邮，跳过关卡本身
- **反面文案废话工厂** —— 33 张卡 × 多条内容若由 AI 批量生成，会变成新的"AI 味注释系统"

### 已承认但延期处理的风险
- 商业可行性（Codex Round 1-2 的"卖给谁"和"回不了本"批评）——passion project 路线下暂缓
- M34 拉普拉斯沙盘被砍可能是错的（Codex 两轮坚持应该保留）——待 Stage 5 原型结果后再评估是否加回

### 仍需监控的风险
- v1.9 spec 已近 1050 行，后续任何修改必须警惕"自我繁殖"重新启动
- 继续改 spec 的诱惑远大于去写 Cocos 代码的诱惑——这是作者心理定势，需要用"原型验证优先"原则硬性对抗
- 美术风格曾多次向“淡水彩氛围图”或“复杂机械插画”跑偏——后续出图必须以“线条优先、装饰减少、结构可信”为硬约束
- 批量生图容易出现“每关概念成立，但同批次内部尺度关系和留白强度不一致”——后续需要逐关筛选与二次迭代，而不是整批直接定稿

### 2026-04-24 一致性审视处理项
- 已同步 `CLAUDE.md` / `vision.md` 的受众定位：成人及青年（16+），不再使用“不限年龄”作为入口定位。
- 已将 spec 内残留的 SpineRuntime / `resources/spine/` / Spine Pro 统一到 Dragon Bones 或 Cocos Skeleton2D。
- 已将残留的“Klee 点彩 / 保罗·克利风格 LoRA”替换为“清晰墨线 + 低饱和淡彩 / 统一手绘线条 LoRA 或提示词管线”。
- 已把 P1-a 验收拆成两层：先灰盒/占位美术跑通交互、胜利判定和 ToolCard；随后用四张主动参考图校准首个美术切片。
- 当前已生成 M02-M10 概念图、落盘 M02-M08 资产，但立即原型对象是 M01；M01 除全局风格锚点外尚无明确可复用关卡资产，原型应先确认是否直接用锚点拆资产，还是先灰盒实现。
- Stage 1 首批资产保留为备选概念 / 历史探索，不再作为生产级风格标准；正式图后续围绕四张主动参考图重新生成或精修。

## Next Recommended Step (immediate)

**继续补齐 M01 Milestone A 的“可被人测试”部分**：
1. 把当前点击式灰盒升级为拖拽式灰盒，贴近 M01 计划中的“过滤器拖拽 + 吸盘分拣”。
2. 在拖拽稳定后补一次 Cocos 预览实测，确认提示按钮、错误槽位描边、完成修复态和 ToolCard 预览不互相遮挡。
3. 灰盒交互稳定后，再进入 WP6 首个美术切片校准。

**当前 M01 灰盒进度**：
- 已建立 Cocos 3.8.8 项目元数据与 TypeScript/Vitest 验证脚手架。
- 已实现 `PuzzleConfig` / `GoalEvaluator` / `ProgressStore` / `ToolCard` 核心契约。
- 已实现 `DragHandler` / `SnapZone` / `FilterSystem` 交互基础件。
- 已落地 `assets/resources/configs/stage1/m01-memory-gear.json`，并用真实 JSON 跑通 M01 控制器、完成判定、进度持久化与 ToolCard 一次性解锁。
- 已补充 `M01GreyboxBootstrap`，通过 Cocos `resources.load` 载入 M01 配置，避免 Creator 脚本编译不支持 JSON import attributes 的问题。
- 已补充 `M01GreyboxLayout` / `M01GreyboxSession`，运行时生成 M01 灰盒节点，并提供首版点击式验证路径：过滤器 -> 碎片 -> 槽位。
- 已补充 `assets/scenes/M01Greybox.scene`，并修复点击放置后的视觉状态同步：激活过滤器会刷新高亮/变暗，选中碎片会加粗，归位碎片会隐藏并禁用交互。
- 已补充最小 `ToolCardView` presenter 与完成态卡片预览：通关后场景内显示“认知工具卡已解锁 / 分类与归纳 / 智慧结晶 / 核心行动 / 何时使用”。
- 已修正 M01 初始碎片点位，避免碎片压住匹配槽位导致点击式灰盒无法完成 18/18。
- 已将 M01 灰盒运行期 status 本地化为中文，避免完成反馈混入英文调试文本。
- 已补充 WP4 首段反馈层：提示按钮按上下文提示过滤器 / 可选碎片 / 目标槽位；错误放置会保留选中并标出错误槽位；完成后齿轮进入修复态并展示 ToolCard。
- 已新增 `M01GreyboxText` 与 ToolCard preview text overrides，当前新增/触碰的可见文字均可通过 overrides 替换，后续接多语言不需要改玩法逻辑。

**不再做的事**：
- ❌ 扩写 M11-M33 的详设
- ❌ 给 spec 新增章节
- ❌ 继续优化措辞 / 加 meta 层

## Verification Evidence

- 2026-04-24 已安装 Cocos Creator 3.8.8 到 `/Applications/CocosCreator-3.8.8.app`；`Info.plist` 显示 `CFBundleShortVersionString = 3.8.8`，二进制为 universal `x86_64 + arm64`，`codesign --verify --deep --strict` 通过。
- 2026-04-24 已用 `/Applications/CocosCreator-3.8.8.app/Contents/MacOS/CocosCreator --project /Users/danmac/liuhui-star-guardian` 打开项目入口；日志显示 engine 加载成功，并注册 `web-desktop` / `web-mobile` / `ios` / `android` / `wechatgame` 等平台成功；所有当前 `assets/` 下的 PNG/JPG/JSON/TS 资源均已生成对应 `.meta` 文件。随后修正 `M01GreyboxBootstrap.ts` 的 JSON 载入方式，避免 Cocos/Babel 不支持 `import attributes` 的脚本编译错误；复测未再出现该语法错误。
- 2026-04-24 已安装本机 Cocos MCP 插件（DaxianLee/cocos-mcp-server v1.4.0）到 `extensions/cocos-mcp-server/`，并写入本机 `.mcp.json` 的 `cocos-creator` HTTP 连接；启动 Cocos 后 `http://127.0.0.1:3000/health` 返回 `{"status":"ok","tools":157}`。
- 2026-04-24 M01 灰盒 TypeScript 原型验证通过：`npm run typecheck` 成功；`npm test` 成功（9 个测试文件 / 30 个测试）。
- 2026-04-24 M01 灰盒可视化入口补强：新增运行时布局与点击会话测试，`npm test -- tests/cocos/M01GreyboxSession.test.ts tests/cocos/M01GreyboxLayout.test.ts` 成功（2 个测试文件 / 6 个测试）。
- 2026-04-24 review 修复验证：`assets/scenes/M01Greybox.scene` 可通过 Cocos MCP 打开，`M01GreyboxRoot` 上识别到 `M01GreyboxBootstrap` 组件且无 `MissingScript`；`npm run typecheck` 成功；`npm test` 成功（11 个测试文件 / 38 个测试）。
- 2026-04-24 下一步执行验证：新增 M01 完成态 ToolCard 预览、中文完成状态和布局防遮挡测试；`npm run typecheck` 成功；`npm test` 成功（12 个测试文件 / 43 个测试）；Cocos 预览从过滤器 -> 18 个碎片 -> 槽位完整跑通，完成画面显示中文 ToolCard 预览，浏览器与 Cocos 控制台均无 error。
- 2026-04-24 WP4 反馈层验证：新增 M01 hint / wrong placement feedback / repair state / visible text replacement 测试；`npm run typecheck` 成功；`npm test` 成功（12 个测试文件 / 48 个测试）；Cocos 预览刷新资源后，Playwright + 本机 Chrome 点击提示按钮无 console/page error，截图见 `temp/m01-feedback-hint-click.png`。
- 2026-04-24 WP4 review 修复验证：Level 1/2 hint 现在会让过滤器 / 可选碎片进入 `hinted` 视觉态；hint 文案改为走 `M01GreyboxText` overrides，不再被 `config.hints[].text` 绕过；`npm run typecheck` 成功；`npm test` 成功（12 个测试文件 / 49 个测试）；Cocos 预览刷新资源后，Playwright + 本机 Chrome 点击提示按钮无 console/page error，截图见 `temp/m01-feedback-hint-review-fix.png`。
- Spec 收口到 v1.9（2026-04-20），Codex Round 3 审阅完成，诊断记入 §七 路线图 + §十 风险表
- 2026-04-22 已将美术主轴改为 Arrog 式统一手绘墨线 + 低饱和淡彩，并落盘到 `docs/design/game-design-spec.md` §4
- 2026-04-22 已将整体风格参考图入库到 `docs/design/style-references/2026-04-22-unified-handdrawn-style-anchor.png`，并补充提炼规则到 `docs/design/style-references/README.md`
- 2026-04-22 桌面截图 `截屏2026-04-22 09.43.48.png` 与已入库的 `docs/design/style-references/2026-04-22-unified-handdrawn-style-anchor.png` 哈希一致；已补充资产副本到 `assets/art/style-references/unified-handdrawn-style-anchor.png`
- 2026-04-23 已将新增界面参考图重命名并重新表述为游戏界面/面板参考，去除外部工具界面方向词，更新 `docs/design/game-design-spec.md`、`docs/design/style-references/README.md` 与资产路径
- 2026-04-24 已将新增莱米兔子图纳入主动风格参考：`docs/design/style-references/2026-04-24-lemmy-rabbit-style-reference.png`；同步资产副本 `assets/art/style-references/lemmy-rabbit-style-reference.png`
- 2026-04-24 已新增 M01 第一关原型项目计划：`docs/plans/2026-04-24-m01-prototype-plan.md`，明确先灰盒可玩、再按四张主动参考图做首个美术切片
- 2026-04-22 已生成 Stage 1 `M02-M10` 首轮场景概念图，并存入 `docs/design/generated-stage1-scenes/`
- 2026-04-22 已选定并落盘 Stage 1 首批 7 张场景资产到 `assets/art/stage1-scenes/`：`M02-M08`，其中 `M07` 采用 `v1`，`M08` 采用 `v1`
- 会话记录见 `.context/codex-session-id`（019da998-3185-7db3-9ae8-4a74a1ab7330）
- 五阶段调性保真度审计见 `docs/design/stage-tonality-verification.md`
- 50→33 去重过程见 `docs/design/tool-dedup-audit.md` + `docs/design/50-puzzle-comparison.md`
