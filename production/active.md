# Active Work State

Last updated: 2026-04-30

## Current Objective

**设计阶段冻结，转入原型阶段**。spec 已收口到 v1.9，接下来不再扩写 M11-M33，而是做两个关键原型验证：
- **P1-a 安全原型**：M01（分类与归纳）—— 验证基础管线（Cocos Creator + Arrog 式统一手绘墨线 + 低饱和配色 + 拖拽交互 + ToolCard 产出）
- **P1-b 危险原型**：M30 隐喻熔炉（概念融合）—— 验证 Stage 5 "命名仪式"能否产生真实认知动作体验。选 M30 而非 M31 的理由：M30 概念融合是 Stage 5 里打分最高、最典型的"范式生成"动作（Codex Round 4 独立评分 9/10），用最硬的关卡试金石失败了才真正证明 Stage 5 不成立。此原型若失败，Stage 5 整体砍掉或重构。

**当前执行焦点**：M01 第一关灰盒原型继续推进中，计划文件见 `docs/plans/2026-04-29-m01-overlap-evidence-greybox-plan.md`。旧版“过滤器 + 九宫格双维度归类”灰盒已经验证了 Cocos 管线、拖拽、吸附、胜利判定、ToolCard 和 art-preview 接入能力；但 2026-04-29 起权威 spec 已将 M01 机制改为“可配置候选灰白碎片池 + 三色手电探测隐藏本色 + 目标交叠证据图 + 弱磁吸拼接验证 + 底光整体验证”。下一步不应继续打磨旧九宫格 runtime art，而应把现有 DragHandler / SnapZone / FilterSystem 技术积累迁移到新 M01：碎片默认无本色、手电可自由切红/黄/蓝、目标形态只提示交叠部分的局部形状和融合色，不显示完整轮廓线；候选碎片数量首版建议 12-16 但不写死，实际使用数量由目标证据图的 `solution.fragmentIds` 并集决定；玩家可点击拾起碎片、点击任意位置放下，只在形状/边缘/交叠轮廓足够匹配时产生弱磁吸。

## Current Phase

- **Design: FROZEN at v1.9**
- **Prototyping: M01 greybox runtime playable; hints, error feedback, repair state, completion ToolCard preview, drag-drop runtime path verified in Cocos preview, and first paper-backed M01 art candidates imported**
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

**按新版 M01 spec 重开玩法灰盒，而不是继续旧九宫格美术打磨**。执行计划见 `docs/plans/2026-04-29-m01-overlap-evidence-greybox-plan.md`。Task 1-8 已完成：童话颜料混色、真实 overlap evidence JSON、controller/session/domain 校验、layout、drop resolver、session API、Cocos bootstrap 输入接线和 legacy sorter art 隔离都已迁到新版“手电 + 证据拼接 + 底光验证”路径。下一步执行 Task 9：更新 ToolCard 与可见文本，让卡片语言和提示文案明确反映新版“关系中的分类与归纳”，而不是旧九宫格归类。

**当前 M01 灰盒进度**：
- 2026-04-29 spec 已更新：M01 从“过滤器筛选 + 九宫格归类”改为“光谱探测 + 交叠证据拼接”。以下旧灰盒进度代表已验证技术能力，不再代表最终 M01 玩法形态。
- 2026-04-30 已完成新版 M01 plan 的 Task 1：在 `M01MemoryGearController` 中新增童话颜料混色 domain helper（`blendM01PigmentColors` / `revealM01FragmentColor`），覆盖红黄蓝同色与两两混合规则。
- 2026-04-30 已完成新版 M01 plan 的 Task 2：真实 `m01-memory-gear.json` 已从旧“过滤器 + 九宫格槽位”切换为 13 个候选灰白碎片、3 个手电色、4 个两片交叠证据、`solution_defined` 使用碎片派生和 `overlap_evidence_reconstructed` 胜利目标；已提交的旧灰盒 layout/session 测试改用 `m01LegacySortConfig` 继续保护旧 runtime 壳子，不再要求真实 M01 JSON 具备旧滤镜/槽位结构。
- 2026-04-30 已完成新版 M01 plan 的 Task 3：`M01MemoryGearController` 现在支持手电显色、证据 pair staging、失败后同 evidence replacement、底光整体验证、错误候选 2 秒闪光状态、正确候选常亮并解锁 ToolCard；旧 sort controller 路径仍保留给 legacy 灰盒壳子使用。
- 2026-04-30 已完成新版 M01 plan 的 Task 4：`M01GreyboxLayout` 现在为真实 M01 配置生成三色手电、灰白候选碎片、局部交叠证据节点和拼接盘；真实配置不再暴露旧九宫格 slots，legacy sort fixture 仍可返回旧 filters/slots 以保护尚未迁移的灰盒壳子测试。
- 2026-04-30 已完成新版 M01 plan 的 Task 5：`M01GreyboxDrag` 现在支持选择手电、按局部形状证据弱磁吸碎片、形状不匹配或远离证据时自由放置；旧 filter/slot drop action 暂时保留给 legacy 灰盒壳子，后续 Task 6/7 迁移 session/bootstrap。
- 2026-04-30 已完成新版 M01 plan 的 Task 6：`M01GreyboxSession` 现在支持选择手电、显色观察、点击拾起/自由放置、弱磁吸提示、证据 pair 暂存/替换、底光整体验证和成功后 ToolCard 解锁；旧 filter/slot session API 保留给 legacy 灰盒壳子。
- 2026-04-30 Task 6 review 修复：新版 session API 对 legacy config 改为返回拒绝而不是访问缺失数组崩溃；真实 overlap-evidence 配置的提示流改为手电 -> 候选碎片 -> 形状兼容证据。
- 2026-04-30 已完成新版 M01 plan 的 Task 7：`M01GreyboxBootstrap` 现在会渲染新版拼接盘、证据点、候选碎片和三色手电；拖拽手电会进入 `selectFlashlight()`，落在碎片上会尝试 `revealFragment()`；碎片可自由放置，形状匹配证据时弱磁吸，第二个碎片吸上同一证据后自动 `submitEvidencePair()`，全部证据 staged 后自动 `validateCandidateStructure()`，不新增单独校验按钮。
- 2026-04-30 Task 7 review 修复：证据点现在使用紫 / 绿 / 橘融合色，而不是灰色 fallback；`arc_lens` / `notch_lens` / `crescent_overlap` / `branch_lens` 有独立简笔局部形状；新版 hint 可高亮手电和证据点；碎片支持点击拾起并点击拼接盘任意位置放下，仍保留拖拽路径。
- 2026-04-30 已完成新版 M01 plan 的 Task 8：旧九宫格 sorter art 已隔离为 legacy / calibration 资产；真实 overlap evidence layout 不再挂载旧红蓝黄碎片 sprite、旧滤镜 sprite 或九宫格托盘静态 layer，仅保留无害的齿轮 art token 候选。
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
- 已新增 `M01GreyboxDrag`，把 greybox token drop 解析为三类动作：过滤器落在齿轮上启用过滤器、碎片落在槽位上尝试归位、无效落点返回原位。
- 已把 `M01GreyboxBootstrap` 接到 `DragHandler` / `SnapZone`：filter / fragment 节点现在通过 Cocos `touch-*` drag session 走真实拖拽路径；全局 mouse move/up 用于防止指针离开节点后拖拽丢失，并在组件销毁时解绑。
- Cocos 浏览器预览中发现真实鼠标会同时触发 `touch-*` 与 `mouse-*`；已移除节点级 `mouse-down` 启动绑定，避免 pointer mismatch 导致 drop 不执行。真实输入路径以 Cocos `touch-*` 为主，全局 mouse move/up 只保留兜底。
- 完成态 ToolCard 预览曾遮挡底部完成反馈；已改为完成时清空底部 feedback，仅保留顶部完成状态和 ToolCard。
- 手感检查发现槽位中心上下间距 40px、槽位吸附高度 52px，吸附区存在重叠；已把 M01 drop resolver 改为在多个槽位命中时优先选择与碎片颜色/形状标签匹配更多的槽位，再按距离选择，避免边界释放误吸到相邻槽。
- 已新增 M01 WP6 美术切片校准计划：`docs/plans/2026-04-27-m01-art-slice-calibration.md`；当前已明确第一张统一手绘锚点图为主要游戏风格参考，UI/莱米参考只做次级约束；生成允许低对比纸纹 / 水彩沉积，但拒收高对比白色噪点 / 碎白斑 / 做旧斑驳。
- 已建立 M01 美术切片资产目录：`assets/art/stage1-m01/`。首个候选 contact sheet 与旧 cropped QA candidates 已移至 `docs/design/generated-m01-art-slices/`；这些文件只供视觉 QA / paintover / prompt iteration。
- 已新增 `docs/design/generated-m01-art-slices/m01-runtime-sprite-sheet-candidate-v2.png`，专门补 v1 的空齿轮 / 空九槽盘 / 独立碎片 / 独立滤镜短板。
- 已从 v2 裁出五张纸背 runtime 候选：`m01-gear-star-slice.png`、`m01-nine-slot-tray-slice.png`、`m01-memory-fragments-slice.png`、`m01-color-filters-slice.png`、`m01-toolcard-thumbnail-slice.png`；Cocos 已为每张 PNG 生成真实 `.png.meta`。
- 已新增 `M01GreyboxArt` 清单和 `tests/cocos/M01GreyboxArt.test.ts`，把五张候选的角色、来源、editor `db://...` URL、非 `resources.load` 状态、最低像素尺寸和 Cocos image `.png.meta` 结构纳入自动验证。
- 已复制同一批候选到 `assets/resources/art/stage1-m01/`，并为 gameplay-scale preview 暴露 `resources.load(.../spriteFrame)` 路径；`M01GreyboxBootstrap.enableArtPreview` 默认关闭，开启时渲染非交互 art calibration layers。
- 已从纸背 resource copies 生成五张透明 runtime 候选到 `assets/resources/art/stage1-m01/runtime-transparent/`，并为其生成 Cocos `.png.meta`；`M01GreyboxArt` 现在区分 paper-backed preview resources 与 transparent runtime candidates。
- `M01GreyboxBootstrap.enableArtPreview` 已从纸背 preview plan 切到 `buildM01GreyboxRuntimeTransparentPlan()`，默认仍关闭，开启时使用透明候选做非交互 art-enabled 复验。
- 已从透明 composite 候选自动裁出独立 fragment/filter sprite-frame 候选：9 个碎片位于 `assets/resources/art/stage1-m01/runtime-sprites/fragments/`，3 个滤镜位于 `assets/resources/art/stage1-m01/runtime-sprites/filters/`；Cocos 已为这些 PNG 生成 `.png.meta`。
- `M01GreyboxArt` 已新增 token-level runtime sprite 清单与 `getM01GreyboxRuntimeSpriteResourceForToken()` / `buildM01GreyboxTokenArtPlan()`；`M01GreyboxBootstrap.enableArtPreview` 开启时，会在 fragment/filter token 节点下挂载 `M01ArtSprite_*` 子节点加载独立 spriteFrame，子节点非交互，原 token 节点继续负责拖拽和 hit target。
- Review 修复：token-level art sprite 现在会保存到 `greyboxNodes` 并随 fragment/filter presentation 同步颜色 / alpha；dimmed 碎片会降透明，selected / hinted / placed 等状态不会再被完整不透明 sprite 遮住。
- Gear/tray 继续向表现层替换推进：`getM01GreyboxRuntimeSpriteResourceForToken()` 现在会为 gear token 返回透明齿轮 spriteFrame；`buildM01GreyboxStaticArtPlan()` 只返回九槽托盘静态 layer，不再把 fragment/filter composite sheet 或 ToolCard thumbnail 作为 gameplay overlay 加载。
- Review 修复：gear token art resource 新增 `displaySize: { width: 300, height: 281 }`，`M01GreyboxBootstrap` 挂载 token art sprite 时优先使用 `resource.displaySize ?? token.size`，保留父 token 的 `300x300` 命中区但避免齿轮美术被拉伸。
- Preview hygiene：`M01GreyboxBootstrap.enableArtPreview` 显式声明为 `@property({ type: Boolean })`，避免 Cocos 预览控制台对布尔属性报 `undefined type` warning；默认仍保持 `false`。
- Art preview polish：`enableArtPreview` 开启时，灰盒 `Graphics` 通过 `applyTokenGraphicsState()` 切到轻量 underlay；普通 token 线宽封顶到 1，slot 线宽封顶到 2，普通填充 alpha 封顶 36，错误 / 提示 / 选中状态保留更高可见度。父 token 的 `UITransform` 和拖拽 hit target 不变。
- Art preview debug hygiene：新增 `showArtPreviewDebugUnderlay`，默认关闭；`enableArtPreview` 开启时，普通 slot/gear 的灰盒 underlay 不再绘制，避免九槽盘/齿轮美术出现双重描边。fragment/filter 仍保留轻量 underlay；提示/错误等反馈态仍会显示 slot/gear underlay。
- Art preview failure fallback：新增 `artPreviewFallbackUnderlayIds`，token art 或静态 tray art 加载失败时会把对应 gear / slot 灰盒 underlay 恢复出来，避免 art preview 资源缺失时只剩不可见 hit target。
- Art v3 direction：已完成最新 art-preview 视觉 QA；当前 v2 候选可用于玩法校准但不应升为最终 runtime 替换。v3 应改为 flat chroma-key 背景的透明候选生成，重点重画空齿轮中心、九槽托盘和三枚滤镜，让资产可直接进入 alpha extraction / Cocos spriteFrame 管线。

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
- 2026-04-27 接入上一线程未提交的 M01 拖拽灰盒进展并收口：去除 runtime drag 调试日志、补全全局 input 解绑生命周期；`npm run typecheck` 成功；`npm test` 成功（13 个测试文件 / 53 个测试）。尚未做 Cocos 预览拖拽实测。
- 2026-04-27 Cocos 预览拖拽实测：`http://127.0.0.1:7456/` 下真实 canvas 加载成功；首次实测发现 `touch-*` / `mouse-*` 双事件导致 drop 未执行，修复后复测通过。验证包括：红色过滤器拖到齿轮后 status 变为“已启用 red 过滤器”；红圆拖到正确槽位后 status 变为“已归位 1 个碎片”且碎片隐藏；红三角拖到错误红圆槽位显示 wrong_slot 错误反馈；随后完整拖拽 18/18 碎片通关，最终 status 为“M01 已修复，认知工具卡已解锁。”，ToolCard 标题为“分类与归纳”，active fragment count = 0，浏览器 console/page error = 0。截图见 `temp/m01-drag-cocos-preview-complete-no-overlap.png`。
- 2026-04-27 M01 拖拽手感检查：新增相邻槽位重叠区测试，先观察到红三角在红三角/红圆边界释放会误判到 `slot_red_circle`；修复后 `npm test -- tests/cocos/M01GreyboxDrag.test.ts` 成功（4 个测试），`npm run typecheck` 成功，`npm test` 成功（13 个测试文件 / 55 个测试）。Cocos 预览复测红三角边界释放：status = “已归位 1 个碎片。”，feedback = “归位正确。”，redTriangleActive = false，redCircleActive = true，console/page error = 0；完整 18/18 拖拽通关仍通过，ToolCard 标题为“分类与归纳”，active fragment count = 0。截图见 `temp/m01-drag-overlap-boundary-fix.png` 与 `temp/m01-drag-handfeel-complete.png`。
- 2026-04-27 M01 WP6 美术切片准备：新增 `docs/plans/2026-04-27-m01-art-slice-calibration.md`，明确 contact sheet prompt、ToolCard thumbnail prompt、拒收规则、目标文件和视觉 QA；新增 `assets/art/stage1-m01/README.md` 与对应 Cocos `.meta`；随后按用户判断将 `2026-04-22-unified-handdrawn-style-anchor.png` 提升为主要游戏风格参考，并把材质规则收敛为“允许低对比纸纹 / 水彩沉积，拒收高对比白色噪点 / 碎白斑 / 做旧斑驳”。已用内置 image generation 生成首个候选 `docs/design/generated-m01-art-slices/m01-contact-sheet-v1.png`（1536x1024，SHA-256 `31425a0995df1ceb840d818c318e16579cc98777fac6760f2a4e54e484fa320a`）；视觉初筛认为构图、风格、功能件分离度较好，但仍需人工确认轻微白色颗粒是否可接受。尚未接入 bitmap art。
- 2026-04-27 M01 art candidate hygiene 修复：未验收的 contact sheet 和 cropped QA candidates 已从 Cocos `assets/` 树移到 `docs/design/generated-m01-art-slices/`，避免缺失 `.png.meta` 和误认为 runtime-ready asset；当时 `assets/art/stage1-m01/` 只保留 README 和目录 meta。后续已接受 v2 的五张纸背 runtime 候选并导入该目录，见下一条。
- 2026-04-27 M01 runtime sprite sheet v2：用内置 image generation 生成 `docs/design/generated-m01-art-slices/m01-runtime-sprite-sheet-candidate-v2.png`（1536x1024，SHA-256 `59022f0c6c18763324f59e3f2676588498dc30c6ec2c96f6fd36c9aba6508777`）。v2 视觉预检：空齿轮、空九槽盘、9 个独立碎片、3 个独立滤镜均存在，风格贴近主锚点；仍需人工视觉 QA 和后续裁切 / 隔离，禁止直接 runtime 接入。
- 2026-04-27 M01 runtime candidate import：从 `m01-runtime-sprite-sheet-candidate-v2.png` 裁出五张纸背候选 PNG 到 `assets/art/stage1-m01/`；通过本机 Cocos MCP 刷新 `db://assets/art/stage1-m01`，确认 Cocos 为五张 PNG 生成真实 image `.png.meta`，`project_get_assets` 返回 count = 5 且五项类型均为 `cc.ImageAsset`。新增 `M01GreyboxArt` 清单测试，红灯为缺少清单 / 缺少 `.png.meta`，绿灯为 `npm test -- tests/cocos/M01GreyboxArt.test.ts` 成功（1 个测试文件 / 3 个测试）。随后 `npm run typecheck` 成功，`npm test` 成功（14 个测试文件 / 58 个测试）。尚未完成 art-enabled Cocos 玩法接入。
- 2026-04-27 review follow-up：修正 `M01GreyboxArt` 的 runtime 语义，明确当前五张 PNG 是 editor/import catalog，不是 `resources.load` 路径；清单新增 `assetDatabaseUrl` 与 `resourcesLoadPath: null`。`tests/cocos/M01GreyboxArt.test.ts` 现在会解析 `.png.meta` 并检查 `importer = image`、`imported = true`、texture 和 sprite-frame subMeta。同步修复 active 中“当前不含 PNG”的过期句子。
- 2026-04-27 M01 art preview resource path：复制五张纸背候选 PNG 到 `assets/resources/art/stage1-m01/`，通过 Cocos MCP 刷新该目录，`project_get_assets` 返回 count = 5 且五项类型均为 `cc.ImageAsset`。`M01GreyboxArt` 新增 `M01_GREYBOX_ART_PREVIEW_RESOURCES` 和 `buildM01GreyboxArtPreviewPlan()`，为每张候选提供 `art/stage1-m01/<name>/spriteFrame` 动态加载路径。`M01GreyboxBootstrap` 新增默认关闭的 `enableArtPreview`，开启时用 `SpriteFrame` 加载非交互校准层。验证：`npm test -- tests/cocosProjectScaffold.test.ts tests/cocos/M01GreyboxArt.test.ts` 成功（2 个测试文件 / 15 个测试），`npm run typecheck` 成功，`npm test` 成功（14 个测试文件 / 61 个测试），`npm_config_registry=https://registry.npmjs.org npm audit --audit-level=moderate` 返回 0 vulnerabilities。
- 2026-04-28 art preview review follow-up：`M01GreyboxBootstrap` 现在在赋值 `spriteFrame` 前设置 `sprite.sizeMode = Sprite.SizeMode.CUSTOM`，避免 Cocos Sprite 按原图尺寸覆盖 preview plan 的 gameplay-scale `UITransform` 尺寸；`tests/cocos/M01GreyboxArt.test.ts` 新增 source PNG 与 `assets/resources` preview copy 的字节一致性测试，防止双份候选漂移。验证：`npm test -- tests/cocosProjectScaffold.test.ts` 成功（10 个测试），`npm test -- tests/cocos/M01GreyboxArt.test.ts` 成功（6 个测试），`npm run typecheck` 成功。
- 2026-04-28 接盘复验：`npm run typecheck` 成功；`npm test` 成功（14 个测试文件 / 62 个测试）；`npm_config_registry=https://registry.npmjs.org npm audit --audit-level=moderate` 返回 0 vulnerabilities。Cocos 预览与 MCP 均在线：`http://127.0.0.1:7456/` 返回 200，`http://127.0.0.1:3000/health` 返回 `{"status":"ok","tools":157}`。通过 Cocos MCP 临时打开 `M01GreyboxBootstrap.enableArtPreview` 后，Playwright 复验 5 个 `M01ArtPreview_*` 节点全部 active，红色过滤器仍可拖到齿轮并把状态推进到“已启用 red 过滤器。请选择同色碎片。”，console/page error = 0，截图见 `temp/m01-art-preview-enabled-check.png`。视觉结论：当前五张纸背候选存在矩形纸背与裁切遮挡，适合校准 / paintover，不适合直接作为最终 gameplay sprite 替换。
- 2026-04-28 透明 runtime 候选首轮接入：从 `assets/resources/art/stage1-m01/` 的五张纸背 preview copy 生成五张 RGBA 透明候选到 `assets/resources/art/stage1-m01/runtime-transparent/`，并通过 Cocos MCP 刷新目录；`project_get_assets` 返回 count = 5 且五项类型均为 `cc.ImageAsset`。新增透明候选测试：每个 PNG 必须 RGBA、四角 alpha = 0、保留足够 opaque 像素、存在 `.png.meta`，并暴露 `art/stage1-m01/runtime-transparent/<name>/spriteFrame`。`M01GreyboxBootstrap.enableArtPreview` 已改用透明候选 plan。验证：先确认新增测试红灯（缺少清单 / plan），再实现后 `npm test -- tests/cocos/M01GreyboxArt.test.ts` 成功（8 个测试），`npm test -- tests/cocosProjectScaffold.test.ts` 成功（10 个测试）。Cocos 预览临时打开 art preview 后，5 个 `M01ArtPreview_*` 节点全部 active，红色过滤器仍可拖到齿轮并把状态推进到“已启用 red 过滤器。请选择同色碎片。”，console/page error = 0，截图见 `temp/m01-runtime-transparent-preview-check.png`。验证后已把 `enableArtPreview` 关回 false。
- 2026-04-28 透明 art-enabled 完整通关复测：临时打开 `M01GreyboxBootstrap.enableArtPreview` 后，用 Playwright 按配置自动拖拽 3 个过滤器与 18 个碎片，最终状态为“M01 已修复，认知工具卡已解锁。”，ToolCard 标题为“分类与归纳”，active fragment count = 0，5 个 `M01ArtPreview_*` 节点均 active，console/page error = 0，截图见 `temp/m01-runtime-transparent-complete.png`。复测后已把 `enableArtPreview` 关回 false。视觉观察：透明候选已经消除纸背矩形，但仍作为 overlay 叠在灰盒之上；下一步应拆 sprite-frame / atlas 并改为表现层替换。
- 2026-04-28 token-level sprite 拆分接入：先新增 M01 art 测试红灯，要求独立 9 个 fragment + 3 个 filter runtime sprites、RGBA 透明边角、Cocos `.png.meta`、以及 layout token 到 spriteFrame 的映射；随后从透明 composite 候选自动裁出 12 张 PNG 到 `assets/resources/art/stage1-m01/runtime-sprites/`，通过 Cocos MCP 刷新 `db://assets/resources/art/stage1-m01/runtime-sprites`，`project_get_assets` 返回 count = 38（包含 12 个 `cc.ImageAsset` 及其 texture / spriteFrame subassets）。`M01GreyboxBootstrap.enableArtPreview` 开启时为 fragment/filter token 增加非交互 `M01ArtSprite_*` 子节点；灰盒 hit targets 和拖拽节点仍保留。验证：红灯为缺少清单 / 函数，绿灯为 `npm test -- tests/cocos/M01GreyboxArt.test.ts` 成功（10 个测试）；`npm test -- tests/cocosProjectScaffold.test.ts` 成功（10 个测试）；`npm run typecheck` 成功；`npm test` 成功（14 个测试文件 / 66 个测试）。
- 2026-04-28 token art review 修复：新增 scaffold 测试红灯，要求 `M01GreyboxBootstrap` 保存 `artSprite` 引用并在 `syncVisualState()` 中同步 token-level art sprite presentation；修复后 `npm test -- tests/cocosProjectScaffold.test.ts` 成功（11 个测试）。完整验证：`npm run typecheck` 成功；`npm test` 成功（14 个测试文件 / 67 个测试）；`npm_config_registry=https://registry.npmjs.org npm audit --audit-level=moderate` 返回 0 vulnerabilities；密钥扫描与危险 JS pattern 扫描无命中。
- 2026-04-28 gear/tray node-level art plan：新增测试红灯，要求 gear 进入 token art plan、tray 进入静态 gameplay art plan，并且 static plan 不再包含 `memoryFragments` / `colorFilters` composite overlay。实现后 `npm test -- tests/cocos/M01GreyboxArt.test.ts` 成功（11 个测试），`npm test -- tests/cocosProjectScaffold.test.ts` 成功（11 个测试）。完整验证：`npm run typecheck` 成功；`npm test` 成功（14 个测试文件 / 68 个测试）；`npm_config_registry=https://registry.npmjs.org npm audit --audit-level=moderate` 返回 0 vulnerabilities；密钥扫描与危险 JS pattern 扫描无命中。尚未完成 art-preview Cocos 完整通关复验。
- 2026-04-28 gear art display size review fix：先新增测试红灯，要求 gear runtime sprite resource 声明 `displaySize: { width: 300, height: 281 }`，并要求 Bootstrap token art sprite 使用 `resource.displaySize ?? token.size` 设置 `UITransform`；实现后 `npm test -- tests/cocos/M01GreyboxArt.test.ts` 成功（11 个测试），`npm test -- tests/cocosProjectScaffold.test.ts` 成功（11 个测试），`npm run typecheck` 成功，`npm test` 成功（14 个测试文件 / 68 个测试），`npm audit --audit-level=moderate` 返回 0 vulnerabilities，密钥扫描与危险 JS pattern 扫描无命中。
- 2026-04-28 token-level art-preview Cocos 复验：通过 Cocos MCP 刷新脚本与 soft reload scene 后，在浏览器运行时临时打开 `enableArtPreview` 并重渲染灰盒；验证 22 个 `M01ArtSprite_*` 与 1 个 `M01StaticArt_nineSlotTray` 均加载 spriteFrame，gear sprite size = `300x281`，tray size = `156x166`。红色过滤器启用后，红色 fragment sprite alpha = 220，蓝/黄 fragment sprite alpha = 56，证明 dim/highlight 已同步到 art 子层；完整真实鼠标拖拽 3 个过滤器 + 18 个碎片后，active fragment count = 0，placed fragment 父节点 inactive 且 sprite alpha = 0，gear sprite repaired alpha = 255，console/page error/warning = 0。截图见 `temp/m01-art-token-preview-red-filter-dim.png` 与 `temp/m01-art-token-preview-complete.png`。视觉观察：当前候选已可完成 gameplay-scale preview，但 art preview 下灰盒线框/槽位叠加仍偏重，需下一轮视觉 polish。
- 2026-04-28 art-preview greybox underlay polish：新增 scaffold 红灯，要求 `M01GreyboxBootstrap` 通过 `applyTokenGraphicsState()` 在 art preview 模式下降低灰盒 `Graphics` 强度；实现后 `npm test -- tests/cocosProjectScaffold.test.ts` 成功（12 个测试），`npm run typecheck` 成功，`npm test -- tests/cocos/M01GreyboxArt.test.ts` 成功（11 个测试）。Cocos 预览中临时打开 `enableArtPreview` 后，初始 `entity_memory_gear` / fragment / filter lineWidth = 1、fillAlpha = 36、strokeAlpha = 48，slot lineWidth = 2、fillAlpha = 36、strokeAlpha = 82；完整拖拽后 active fragment count = 0，console/page error/warning = 0。截图见 `temp/m01-art-preview-subdued-initial.png` 与 `temp/m01-art-preview-subdued-complete.png`。
- 2026-04-28 art-preview debug underlay toggle：视觉 QA 发现 `temp/m01-art-preview-subdued-complete.png` 中 slot/gear 仍有双重灰盒描边；新增 `showArtPreviewDebugUnderlay` 默认关闭，并让普通 slot/gear 在 art preview 下 lineWidth = 0、fill/stroke alpha = 0。验证：新增 scaffold 红灯后实现，`npm test -- tests/cocosProjectScaffold.test.ts` 成功（13 个测试），`npm run typecheck` 成功。Cocos 预览临时打开 `enableArtPreview` 后，初始 `entity_memory_gear` 与 `slot_red_circle` lineWidth = 0、fillAlpha = 0、strokeAlpha = 0，fragment/filter 仍为 lineWidth = 1、fillAlpha = 36、strokeAlpha = 48；完整拖拽后 status = “M01 已修复，认知工具卡已解锁。”，active fragment count = 0，ToolCard 存在，console/page error/warning = 0。截图见 `temp/m01-art-preview-debug-underlay-hidden-initial.png` 与 `temp/m01-art-preview-debug-underlay-hidden-complete.png`。
- 2026-04-28 art-preview load failure fallback：新增 scaffold 红灯，要求 token/static art load failure 登记 fallback underlay；实现后 `npm test -- tests/cocosProjectScaffold.test.ts` 成功（14 个测试），`npm run typecheck` 成功。Cocos 预览中临时打开 `enableArtPreview` 并手动触发 fallback：正常状态下 `entity_memory_gear` / `slot_red_circle` lineWidth = 0、fillAlpha = 0、strokeAlpha = 0；触发 `markArtPreviewUnderlayFallback("entity_memory_gear")` 与 `markStaticArtPreviewUnderlayFallback("nineSlotTray")` 后，gear 恢复 lineWidth = 1、fillAlpha = 36、strokeAlpha = 48，slot 恢复 lineWidth = 2、fillAlpha = 36、strokeAlpha = 82，console/page error/warning = 0。
- 2026-04-28 M01 art v3 visual QA / prompt：复看 `temp/m01-art-preview-debug-underlay-hidden-complete.png`、主风格锚点和 `m01-runtime-sprite-sheet-candidate-v2.png` 后，确认 v2 在 gameplay-scale 已可读，但滤镜仍像纸背标签，gear/tray 仍有 composite/crop 痕迹，不适合升为最终 runtime art。已新增 `docs/design/generated-m01-art-slices/m01-runtime-v3-visual-qa-and-prompt.md`，要求下一轮生成 flat `#00ff00` chroma-key 背景、可透明提取的正式 runtime sprite sheet，并明确 gear / tray / filters / fragments 的验收规则；review 后已修正 tray prompt 的行列语义：列为 red/blue/yellow，行为 circle/triangle/hexagon，与 runtime hit targets 一致。
- 2026-04-28 review recheck：复核 gear art `displaySize`、art load failure fallback underlay、v3 tray 行列语义三条 review finding，当前工作树已覆盖对应修复。验证：`npm run typecheck` 成功；`npm test -- tests/cocosProjectScaffold.test.ts tests/cocos/M01GreyboxArt.test.ts` 成功（25 个测试）；`npm test` 成功（14 个测试文件 / 71 个测试）；`npm audit --audit-level=moderate` 返回 0 vulnerabilities；密钥扫描与危险 JS pattern 扫描无命中。下一步仍是按 v3 prompt 生成 / 导入新的透明 runtime 候选。
- 2026-04-28 v3 generation rejected attempt：一次纯文本 imagegen 生成的 v3 sheet 风格明显偏离主参考图，原因是未把主风格锚点作为视觉输入，且 runtime sheet / flat `#00ff00` / functional cartridge 等约束压过了 Arrog 式手绘线条与留白比例。该图未导入 repo 资产树，不作为候选继续推进。下一次应以主风格锚点和 v2 结构图作为显式视觉参考，优先保留粗糙墨线、纸面留白感、低对比水彩沉积和不规则边缘，再解决透明提取。
- 2026-04-28 主参考图清理：新增 `docs/design/style-references/2026-04-22-unified-handdrawn-style-anchor-cleaned-v1.png` 和更深补色版 `docs/design/style-references/2026-04-22-unified-handdrawn-style-anchor-cleaned-v2.png`，用局部同色系补色方式处理高亮白色噪点 / 碎白斑，不覆盖原图。v2 取周围更暗的水彩邻域色填回白点，目标是保留原图水彩深浅不均、墨线和纸感，同时进一步减少看起来脏的盐粒白点；对比图见 `temp/m01-style-anchor-cleaned-v2-comparison.png`。
- 2026-04-28 贴图源复核：当前 Cocos runtime gear 仍来自 `m01-runtime-sprite-sheet-candidate-v2` 裁图，即使清理白噪点也不会变成主参考图造型。已新增直接从 cleaned-v2 主参考图裁出的对照候选 `docs/design/generated-m01-art-slices/m01-anchor-cleaned-v2-gear-composite-candidate.png`，对比图见 `temp/m01-current-v2-vs-anchor-cleaned-gear.png`。该候选中心是已完成九宫格，不应直接替换初始 gameplay 空 gear；下一步应基于 cleaned-v2 参考图重做“空心 gear / 空 tray”的贴图，而不是继续修 v2 生成资产。
- 2026-04-29 M01 empty gear candidate：用户最终选择以 16:37 版本作为原型母版，不再继续调色 / 修线 / 重绘。当前 preferred review-only candidate 为 `docs/design/generated-m01-art-slices/m01-anchor-cleaned-v2-gear-empty-center-rich-color-candidate.png`；它保留更丰富的机械主体灰褐水彩浓淡。后续工作应只围绕该图做工程化裁切、透明化和 gameplay-scale 导入预检。`m01-anchor-cleaned-v2-gear-empty-center-rich-color-outline-tidy-candidate.png` 仅保留为后续对照，不作为当前原型推进。
- 2026-04-30 新版 M01 Task 1 验证：先新增混色测试并确认红灯（`blendM01PigmentColors is not a function` / `revealM01FragmentColor is not a function`），随后实现最小 helper；`npm test -- tests/levels/stage1/M01MemoryGearController.test.ts` 成功（1 个测试文件 / 7 个测试），`npm run typecheck` 成功。
- 2026-04-30 新版 M01 Task 2 验证：真实 M01 JSON 已切到 `overlap_evidence_reconstructed`，新增测试覆盖候选池 12-16、证据数 4-6、solution 派生使用碎片、shape-compatible decoys、不泄露目标答案；已提交的旧九宫格 layout/session runtime 测试改用 legacy fixture。可在 clean checkout 复现的验证：`jq empty assets/resources/configs/stage1/m01-memory-gear.json` 成功；`npm test -- tests/levels/stage1/M01MemoryGearController.test.ts tests/core/PuzzleConfig.test.ts` 成功（14 个测试）；`npm test -- tests/cocos/M01GreyboxLayout.test.ts tests/cocos/M01GreyboxSession.test.ts` 成功（14 个测试）；`npm run typecheck` 成功。
- 2026-04-30 新版 M01 Task 3 验证：先新增 controller tests 并确认红灯（缺少 `stageEvidencePair` / `validateCandidateStructure` / evidence completion 字段），随后实现候选结构验证。验证：`npm test -- tests/levels/stage1/M01MemoryGearController.test.ts` 成功（17 个测试）；`npm test -- tests/core/PuzzleConfig.test.ts tests/cocos/M01GreyboxLayout.test.ts tests/cocos/M01GreyboxSession.test.ts` 成功（17 个测试）；`npm run typecheck` 成功。
- 2026-04-30 新版 M01 Task 3 review 修复：`rejectCandidateStructure()` 的底光闪烁现在按 `validationLightSeconds` 到期返回 `off`，`getCompletionState()` 不再无限保留 `flash_then_off`。验证：`npm test -- tests/levels/stage1/M01MemoryGearController.test.ts` 成功（18 个测试），`npm run typecheck` 成功。
- 2026-04-30 新版 M01 Task 4 验证：先把 layout 测试改为真实 M01 overlap evidence 配置并确认红灯（`layout.flashlights` / `layout.evidence` 不存在），随后实现新版 layout 节点。验证：`npm test -- tests/cocos/M01GreyboxLayout.test.ts` 成功（3 个测试）；`npm test -- tests/cocos/M01GreyboxLayout.test.ts tests/cocos/M01GreyboxSession.test.ts tests/levels/stage1/M01MemoryGearController.test.ts tests/core/PuzzleConfig.test.ts` 成功（33 个测试）；`npm run typecheck` 成功。
- 2026-04-30 新版 M01 Task 5 验证：先把 drag resolver 测试改为真实 M01 overlap evidence 配置并确认红灯（手电返回 `wrong_token_kind`，碎片仍访问旧 `layout.slots`），随后实现新版 drop action。验证：`npm test -- tests/cocos/M01GreyboxDrag.test.ts` 成功（4 个测试）；`npm test -- tests/cocos/M01GreyboxDrag.test.ts tests/cocos/M01GreyboxLayout.test.ts tests/cocos/M01GreyboxSession.test.ts tests/levels/stage1/M01MemoryGearController.test.ts` 成功（34 个测试）；`npm run typecheck` 成功。
- 2026-04-30 新版 M01 Task 6 验证：先新增 session tests 并确认红灯（`selectFlashlight` / `revealFragment` / `submitEvidencePair` / `pickFragment` 等方法不存在），随后实现新版 session API。验证：`npm test -- tests/cocos/M01GreyboxSession.test.ts` 成功（15 个测试）；`npm test -- tests/cocos/M01GreyboxSession.test.ts tests/cocos/M01GreyboxDrag.test.ts tests/cocos/M01GreyboxLayout.test.ts tests/levels/stage1/M01MemoryGearController.test.ts` 成功（40 个测试）；`npm run typecheck` 成功。
- 2026-04-30 Task 6 review 修复验证：新增 session tests 并确认红灯（legacy config 下 `selectFlashlight` 抛 TypeError；真实配置 hint targetIds 为空），随后修复数组兼容和新版 hint 分支。验证：`npm test -- tests/cocos/M01GreyboxSession.test.ts` 成功（17 个测试）；`npm test -- tests/cocos/M01GreyboxSession.test.ts tests/cocos/M01GreyboxDrag.test.ts tests/cocos/M01GreyboxLayout.test.ts tests/levels/stage1/M01MemoryGearController.test.ts` 成功（42 个测试）；`npm run typecheck` 成功。
- 2026-04-30 新版 M01 Task 7 验证：先新增 bootstrap scaffold 红灯，要求 `layout.board` / `layout.flashlights` / `layout.evidence` 渲染路径和 `select_flashlight` / `weak_snap_fragment` / `place_fragment_freely` action 接线；实现后 `npm test -- tests/cocosProjectScaffold.test.ts` 成功（16 个测试），`npm test -- tests/cocosProjectScaffold.test.ts tests/cocos/M01GreyboxSession.test.ts tests/cocos/M01GreyboxDrag.test.ts` 成功（37 个测试），`npm run typecheck` 成功，`npm test` 成功（14 个测试文件 / 92 个测试）。
- 2026-04-30 Task 7 review 修复验证：先新增 scaffold/session 红灯，覆盖融合色 palette、局部证据 shape 绘制、新版 hint target 高亮、点击拾取/点击放置，以及弱磁吸后释放 held fragment；实现后 `npm test -- tests/cocosProjectScaffold.test.ts` 成功（19 个测试），`npm test -- tests/cocos/M01GreyboxSession.test.ts` 成功（18 个测试），`npm test -- tests/cocosProjectScaffold.test.ts tests/cocos/M01GreyboxSession.test.ts tests/cocos/M01GreyboxDrag.test.ts` 成功（41 个测试），`npm run typecheck` 成功，`npm test` 成功（14 个测试文件 / 96 个测试），`npm audit --audit-level=moderate --registry=https://registry.npmjs.org` 返回 0 vulnerabilities。
- 2026-04-30 新版 M01 Task 8 验证：先新增 art tests 并确认红灯（真实 overlap evidence layout 仍加载 legacy nine-slot tray）；实现后 `npm test -- tests/cocos/M01GreyboxArt.test.ts` 成功（13 个测试），`npm test -- tests/cocosProjectScaffold.test.ts tests/cocos/M01GreyboxArt.test.ts tests/cocos/M01GreyboxLayout.test.ts` 成功（35 个测试），`npm run typecheck` 成功，`npm test` 成功（14 个测试文件 / 98 个测试），`npm audit --audit-level=moderate --registry=https://registry.npmjs.org` 返回 0 vulnerabilities。
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
