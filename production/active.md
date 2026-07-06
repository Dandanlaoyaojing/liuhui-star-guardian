# Active Work State

Last updated: 2026-07-06

> 这是**当前状态薄层**(CLAUDE.md 要求)。已完成的历史流水归档在 `production/archive/`,细节查那里或 `git log`。

## 当前活跃线:M02 Phase 3B/3C 视图反馈 + 胜利收尾(2026-07-06, 分支 `codex/m02-phase3b`)

承接 `main` 上已合并的 Phase 3A，按 `docs/plans/2026-07-05-m02-phase3.md` 完成 3B/3C 的自动验证部分。为避开主仓未提交的 Cocos 编辑器状态文件，工作在隔离 worktree：`/Users/danmac/.config/superpowers/worktrees/liuhui-star-guardian/m02-phase3b`。

3B 已补完 T7/T8，均有红灯 scaffold 测试 → 实现 → 目标测试/typecheck：

1. T7 — `M02StarWebView` 用配置 `mechanic.lifeMax` 计算 `life/lifeMax`，每颗亮星先画倒数光晕；`frozen` 用稳定色/固定满圈。
2. T8 — 新增 `M02FailureOverlay`，`status==="exhausted"` 时铺半透明暗场和漏光点；原有点击任意处 `resetBoard()` 后 `renderStars()` 会清空覆盖层。
3. Stargaze 星形移植 — 从隔壁 `/Users/danmac/bunnies-stargaze/src/utils/starRenderer.ts` 搬 `generateStarVertices` 的五点星几何与 `[0,2,4,1,3,0]` pentagram 画序，翻译成 Cocos `Graphics` 直画；保留 M02 原状态色、倒数光晕和点击命中半径。
4. 自审修复 — 光晕/星体、失败暗场/漏光点分别拆成独立 `Graphics` 节点，避免同一 `Graphics` path 在连续 `stroke()` / `fill()` 间串形，导致亮星被光晕圆重新填成圆点或失败暗场被漏光色覆盖。

3C 已补完 T9-T11，均有红灯 scaffold 测试 → 实现 → 目标测试/typecheck：

1. T9 — 单板 `won` 后不再直接切板，改走 `beginBoardWinFlow()`；用 tween 逐星放大光晕节点形成修复流，动画期间锁输入，并在 tween 回调里检查 `disposed`，销毁时统一 `stopRepairTweens()`。
2. T10 — 末板 `isLevelComplete()` 后调用 `grantM02Completion(this.progressStore, this.config.toolCard, Date.now())` 写进度并拿完整 `ToolCard`；再用 `buildToolCardPreview(card)` 格式化，场景内生成 `M02CompletionPanel` / `M02ToolCardPreview` 灰盒卡面。
3. T11 — 非末板修复流结束后自动 `nextBoard()` + `buildBoard()`；末板进入完成奖励分支；完成态再次点击会 `pulseCompletionPanel()`，不再静默无响应。
4. 合并前自审修复 — 配置层拒绝重复 `board.id`；`grantM02Completion` 拒绝非 `m02` 工具卡，避免完成态和工具卡解锁写到不同 puzzleId。

验证：`npm test` ✅(39 files / 443 tests)，`npm run typecheck` ✅，`git diff --check` ✅。

已提交的 batch 1 完成 T4-T6：

1. `eb654c3` `feat(M02): guard star web touch input` — `M02StarWebView` 增加 `activeTouchId`，绑定 `TOUCH_START/TOUCH_END/TOUCH_CANCEL`，只处理匹配的单触点；`onTouchEnd` 开头拍 `session.view` 快照并传给 `nearestNodeId`。
2. `c6683e6` `refactor(M02): centralize star web graphics nodes` — 新增 `makeGraphicsNode(name,parent)` 统一 UI_2D + UITransform + Graphics 样板；`StarWebView.edges` 改为 `ReadonlyArray<readonly [string,string]>`。
3. `d657361` `feat(M02): render star wand charges` — 代码内生成 `M02ChargeMeter`，按 `chargesTotal/chargesLeft` 画棒尖光点，点后随 `renderStars()` 同步刷新。

未完成：3B/3C Preview checkpoint。`.ts` 改动需要在 Cocos 编辑器手动重启 Preview 后才能肉眼/截图验证；本轮尚未做编辑器预览验证。

## 已完成:M02 Phase 3A 会话/工具卡/进度数据(2026-07-05, 已合并 main)

按 `docs/plans/2026-07-05-m02-phase3.md` 先执行 Phase 3A 三个可无头验证任务，均 TDD 红→绿并逐 Task 提交：

1. `310533b` `feat(M02): add level completion state` — `StarWebSession` 记录已 won 的 board id，新增 `isLevelComplete()`，不信任 `nextBoard()` 顺序。
2. `30ff2ea` `feat(M02): add tool card config` — M02 `toolCard` 文案入 `m02-starweb-warmth.json`，`StarWebConfig` 类型/校验接 `ToolCardDraft`。
3. `66c46cb` `feat(M02): grant completion progress` — 新增 `M02CompletionController.grantM02Completion(store, toolCardData, now)`，写入完成进度并解锁工具卡，二次调用保持原时间戳。

审阅修复：Phase 3A 自审发现 `toolCard` 只校验自身形状，未校验它是否属于当前 M02 配置。已补 `StarWebConfig` 交叉校验，拒绝 `toolCard.puzzleId/stage/front.wisdomCrystal` 与父级 `id/stage/wisdomCrystal` 不一致，避免完成奖励把 M02 完成态和错误工具卡解锁混写。

验证：`npm test` ✅(39 files / 429 tests)，`npm run typecheck` ✅。计划文档已把 3A 勾掉并写入 checkpoint。

后续状态：Phase 3B/3C 已在上方当前活跃线继续完成；主仓仍有一处既有未提交编辑器浮窗配置 `profiles/v2/packages/scene.json`，本轮未触碰。

## 已收口:M01 交叠显色"旧色"排查 = 缓存假象(2026-07-05, 已 push origin/main e9cfe33)

用户报"齿轮中心目标交叠色偏旧、和通关时不一样"。逐段验证(无头空缓存渲染 + 节点 fillColor dump + 服务端 chunk grep)证明:**齿轮中心风车(M01TargetOverlapEvidence)显色代码一直是新 OBSERVED 色板(橘222,150,94/绿129,171,132/紫173,136,172), 用户所见"旧色"纯是浏览器缓存旧 import-map 的假象, 非代码问题**。主玩法显色无 bug。

**真改的只有一处**(`ca37ee7`): 左侧参考卡 `drawStandardReferencePattern` 的 `STANDARD_REFERENCE_OVERLAPS` 仍挂旧暗色硬编码(199,126,75/92,145,112/139,105,156)→ 改为 colorToken 派生 `colorForTargetOverlapEvidence`→OBSERVED, 与风车/盘面证据/拼片显色同源。另加常驻预览窗口脚本 `scripts/preview-watch.sh`(`e9cfe33`, 持久 profile+DevTools Disable cache 根治缓存旧码)。typecheck+393 全绿, 已 push。
教训入库: [[feedback_verify_stale_visual_headless_first]] / [[project_cocos_preview_stale_is_browser_importmap_cache]](已补 SW 排除+watch 脚本)。

**⚠️ 并发会话注意**: 本会话期间检测到多个 claude 进程共用主仓 worktree, 一个 ultracode M02 会话中途把共享树切到 `feat/m02-starweb`(8f4f148 "点亮你温暖我"重设计, 本地未推)又切回 main。我的 M01 提交走**独立 worktree 挂 main** 隔离做, 没碰 M02 那条线。处置法入库 [[project_parallel_session_hijacked_worktree_commit]]。M02 现有两条并行草稿: `feat/m02-starweb`(星网/协同, 主仓分支) 与 `claude/m02-compass-logic-fix`(罗盘校准, m02-fix worktree) —— 待用户定夺哪条。

## 已收口:M01 画风统一调色 + 吸附旋转规则修复(2026-07-02, 已并入 main)

**分支 `feat/m01-lemmy-celebrate`。两组未提交改动, 测试全绿(typecheck ✅ + 390 ✅), 待用户 live 验收后一起 commit。**

### A. 调色(6 张 PNG, 纯像素改动, alpha/尺寸未动)
用户反馈篮子和平台画风不和谐 → 诊断=篮子太饱和太"实" vs 平台低饱和水彩速写。
- 篮子 4 张(hanging/empty/tipped/front-occluder): 原↔B 中间档 S×0.775+V 抬 0.05 (S 0.32-0.37→0.25-0.29)。**前挡片渲染在最前, 漏调它会看着"没变"**。
- 绳子 rope-segment: muted 档 S 0.259→0.195(用户选的, 比篮子略灰一档)。
- 提示灯泡 icon-hint: 暖玻璃橘调加强 S 0.264→0.451(色相蒙版只吃 H18-62 暖玻璃, 灰灯丝/灯座 S0.081 未动)。**灯泡是可交互按钮, 抢眼是有意的**(codex 审后用户确认)。
- codex 独立看图审过(exec --image): 前三协调 ✓; 载片篮内部碎片明度对比略变弱(整图统一降饱和的代价, 暂接受)。
- 原图备份 `/tmp/basket-orig-backup/`。**坑**: refresh_assets 可能不重导单张改动贴图(library 停旧值) → 必须 reimport_asset + 读 library 均值验证, 见记忆 project_cocos_refresh_vs_reimport_library_stale。

### B. 吸附旋转规则(M01GreyboxDrag.ts + 测试)
用户实测: 角度不对的三角片也被吸住。规则=圆任意角, 三角/六边形须角度匹配(按对称周期: 三角 120°/六边 60°, 容差 1°)。
- 对称周期判定本轮之前已落(shapeRotationSymmetryDegrees), codex 复核真理值表一致(玩家 90° 步进 → 三角 4 个可达角命中 1 个, 六边命中 2 个, 自洽)。
- **本轮修 codex 逮到的两个真 bug**:
  1. 诱饵片(无预期槽)在证据弱磁吸路径整体免检、任意角可吸 → 新 `isEvidenceTrialFitRotationCompatible`: 按**该证据生成片**(fragmentSnapPositions 的键=solution.fragmentIds)中同形状者的目标角判, 真解/诱饵同一规则(按身份判会向玩家泄露真解); spec §606/630/633 支持诱饵可试拼。
  2. 重叠槽(两三角槽矩形交叠 dx18/dy29 vs 56×56)先筛旋转再取最近 → 最近槽角度不对时静默吸去较远槽(位置错→验证永不过→底光永不亮) → 改为**先取最近槽再判它的旋转**, 不对就 rotationHint。
- 测试: tests/m01SnapRotation.test.ts(9 用例; 证据路径用合成布局——真实 config 里证据中心全被槽矩形盖住, 从公共 API 打不到弱磁吸路径); scaffold 锁串同步更新。
- **待办**: ① 用户手动重启 Cocos 预览(.ts 改动 MCP 刷不了)live 实测; ② codex 零框架 diff 审在跑(后台任务 bqrz2gu9o), 结果消费完才 commit。
- 中断的支线: 灯泡按钮"点击变亮"特效(挂点已找好: M01HintButton touch-end→requestHint, 可复用 getRadialGlowSpriteFrame+addGlowSprite+tween), 被吸附 bug 打断未写。

## 已收口:M01 显色/线索同步 + 死功能清理 + CI 门禁(2026-06-30, 全部已 push origin/main d73e78c)

用户需求链(逐步): 拼片被手电照射的反应色更鲜艳 → 线索/目标预览也换成同一显色且代码同步生成(别用烤死 PNG) → 发现点击放大参考卡功能其实点不开 → 整体移除该功能 → 修 main 上 pre-existing 红测试 → 加最小 CI 门禁。

**已落地(全部 commit 且 push)**:
1. **反应色提饱和**(`75d1884`): `OBSERVED_FRAGMENT_TINT_COLORS` 套 `saturateRgb(k=1.4)` 绕 luma 拉(色相不变); smoke 同步复刻同一公式。
2. **线索↔显色同源**(`618064c`+`2bbd858`): `colorForTargetOverlapEvidence` 改读 `OBSERVED_FRAGMENT_TINT_COLORS` → 盘面目标证据/预览与拼片显色**共用同一调色板**, 以后调 `OBSERVED_TINT_SATURATION`/调色板三处自动同步。放大参考卡一度从 PNG 改为代码画多边形(bbox 半对角线缩放进圆)。
3. **移除点击放大参考卡功能**(`550c028`): headless 网格暴力点击整画布 0 命中证明该热区(reference_pattern 节点 touch-end)真实点击从不命中=死功能, 用户决定整体删(toggle 方法+字段+绑定+代码画卡)。盘面目标证据上色保留。
4. **修 pre-existing 红测试**(`6e5e841`): `e115afa`(篮子重贴图+新灯泡)有意改了 hint 图标 24.5×30→62、移除底光便签 `M01BottomLightNote`, 但 scaffold 断言没跟 → main 一直红 2 个; 对齐断言, 纯测试无代码改。
5. **最小 CI 门禁**(`574167e`+`d73e78c`): `.github/workflows/ci.yml` = `npm ci + typecheck + test`(push main/PR 触发); smoke:* 需 Cocos 预览服务器, CI 无编辑器故排除。首跑红抓到真问题→`tests/m01PreviewSmokeHelpers.test.ts` import smoke 脚本触发顶层 main()→CI 无 Chrome process.exit(1) 拖红(本地有 Chrome 不触发); 加 `import.meta.url===argv[1]` 直跑守卫修掉, 现 CI 绿。

**验证**: 每步 codex 零框架 + 独立 code-review 消费完(仅几条注释/陈旧断言, 已修); typecheck ✅ + 377 测试 ✅ + **CI 绿**。放大卡视觉用 headless playwright 真实点击实拍确认过。

**保留/留意**: `m01-target-reference-card.png` + getter 仅作设计参考/测试夹具(已注释标注), runtime 不再加载。用户机 Safari/Chrome 看旧画面是浏览器强缓存 import-map(弱ETag无Cache-Control), 非代码; 解法见记忆 [[project_cocos_preview_stale_is_browser_importmap_cache]]。方案 B(参考卡也用水彩底图×染色连质感一致)未做, 用户暂取方案 A(平涂)。

## 历史活跃线:M01 弱磁吸一致性修复(2026-06-19)

用户反馈: 拼片吸到平台按形状判断,但同形状有的能吸附有的不能。
根因: `resolveTargetPieceSlotDrop` 的锁定目标槽位先按 `expectedFragmentId` 过滤,导致同为 `shape:circle` 的 `fragment_circle_blue_1` 不能吸到圆形目标槽;圆形无旋转问题,这里是 ID 锁死而不是形状判定。
修复: 目标槽位吸附改为按形状 + 现有旋转容差判断,不再按具体碎片 ID 判断;完成判定仍由后续证据/solution 校验负责。未改玩法 spec。
验证: 先加红灯用例 `fragment_circle_blue_1` 放到 `target_piece_circle_yellow_1` 圆槽失败→修复; `npm test -- tests/cocos/M01GreyboxDrag.test.ts ... M01GreyboxLayout.test.ts` ✅(82 tests); `npm run typecheck` ✅; `npm test` ✅(33 files / 364 tests)。
下一步: Cocos Stop→Play 现场验三个圆片都能吸到圆形目标槽;三角/六边形仍需旋转角度正确才吸。

## 当前活跃线:M01 设计达成收口(2026-06-12 全部代码落地并提交;⚠️待用户 Stop→Play live 验收)

**本轮(2026-06-12, 接 6-08 session handoff)按计划 `docs/plans/2026-06-08-m01-design-completion-plan.md` 全自主跑完 B→H**, 每步 codex 零框架审($consumed)+ 测试门禁。**HEAD `9c82d5e`, typecheck ✅ + 358 测试全绿 ✅, 工作区干净**(未 push)。

**已落地(全部已 commit)**:
1. **spec §5.2 回写**(`3e9d606`+残留修): 开场=点哪走哪→(不在篮下点篮)走近伸手【够不着】教学 beat→走到篮下(靠近收耳)→顶篮(上升段初触受力)→篮子被软绳拽住乱晃→3 顶×3 片→手电掉砸头(尺寸=莱米 1/5)→仍可走位→点手电蹲拾。核心谜题段未动。
2. **兔子不忽大忽小**(`7187949`+`15cf342`): 契约 renderScale(number/ramp/**逐帧曲线**)+LemmyActor 脚底锚定; earsback/earsup 逐帧实测曲线(线性 ramp 中段瘪 14%, codex 抓的; 量具在耳翻越段有换挡伪影→锚点分段拟合), idleback/walkback 1.338, headbutt 1.423→1.502; 接缝显示身体高恒 404±1.5%(测试守卫)。**重抽否决**(用户: 适当放大和 idle 一致即可)。
3. **绳子真实化**(`edb45b0`+`f0797e7`): 研究对标割绳子(Jakobsen Verlet)→ `M01RopePhysics` 纯模块: **篮子=链尾重粒子**(invMass 0.05), 质量加权距离约束【仅拉伸侧】(codex: 双向会吃掉竖直顶击只抬 11px), 固定子步+余数累加器(codex: 取整丢余数 48fps 快 20%); 顶篮 kickTail(竖直 600+侧向=莱米偏心×3 封顶 220)→ 弹起被绳拽住乱晃渐收。8 测试含帧率无关性。两股吊带渲染 splay 到两耳(±99)。
4. **伸手够不着**(`5a1318c`): 即梦 reachmiss 40 帧(frames2video 双锁 pencil 首帧, arc 统一缩放, 站姿躯干 102-103% idle/脚底 490)——踮脚伸够两次落空→耳朵耷拉失望→回站; 篮子**零运动**(删 gentleNudge)。源视频已归档+README。meta 逐文件新 uuid。
5. **v4 手电 Task8-10**(`6ff0ce1`/`af31ff1`/`f10451c`): 删两套旧路径(-707 行/40+符号, scaffold 不可达守卫)+Session.clearFlashlight; intro 拾起→手电重挂莱米节点(handoff {lemmyNode, flashlightNode}); bootstrap 覆盖面锚莱米每帧 fragmentsInCoverage(onTray 排除拼接盘+光池 coveragePoolHalfHeight 钳不照盘), 点手电 cycleLight→红/黄/蓝/灭, 点拼片=拾取+灭灯, `physicsSettled&&flashlightAcquired` 双门控(不挡开场)。config flashlightCoverage{radius:150,centerOffsetY:-52}。
6. **修复动画 v1**(`f969e80`+`9c82d5e`): `M01RepairSequence` 纯时序(config repair.steps 数据驱动)→ bootstrap 完成后播【齿轮转→碎片漩涡**喷出**→星光脉冲】, 播完才出智慧结晶卡。镜头拉远无相机系统, 省略(电影化留美术轮)。

**⚠️ 待 live 验收(Cocos MCP 本轮断线, 未 refresh; 用户 Stop→Play 清单)**:
① 收耳后大小(renderScale 曲线观感, 旋钮=契约里各动作 renderScale) ② 顶篮: 篮子弹起+被绳拽着乱晃手感(`BASKET_KICK_STRENGTH` 600/`ROPE_OPTS`/`ROPE_TAIL_INV_MASS`) ③ 够不着 beat 观感(reachmiss fps 18) ④ 手电: 1/5 大小/光池跟随/循环灯色/覆盖面显色/点拼片灭灯 ⑤ 双门控不挡开场 ⑥ 完成→修复动画→卡片 ⑦ 已知边缘: 手持手电与拼片重叠时节点抢点(点到手电不拾片, F2 agent 记录) ⑧ smoke .mjs 两脚本仍旧手电时代(待预览可用后重写)。
**遗留(非阻塞)**: bootstrap 两个本轮前就有的孤儿函数(`addTargetReferenceCircleFrame`/`drawStandardPieceShape`); walk-00 身高 97% idle(630936e 已签收过, 未动)。

## 莱米动画资产现状(2026-06-08 收口)
11 套帧动作全接入 `LemmyActorContract`(idle24/walk48/reach36/**reachmiss40**/startle29/crouch40/earsback40/idleback48/walkback28/earsup38/headbutt124), 512²、脚底行恒 490、源视频全归档 `assets/art/characters/lemmy/source-videos/`(重抽方法 README+skill `jimeng-video-to-sprite-frames`)。canonical 拆分: pencil 版(游戏/即梦输入)+trademark 版(商标)。renderScale 见上。量具: `scripts/lemmy-measure-framesets.py`(重抽后必须重测重定曲线)。

## 发行平台(2026-06-01 定)
iOS App + Steam(PC/Mac)。放弃 Web/微信小游戏/安卓 → 微信 4MB 包体限制不再适用,动画帧数可按质量给足。CLAUDE.md / game-design-spec.md 已同步。

## 仓库整洁(2026-06-01)
- 删了无引用的 PSD(`m01-reference-psd-slices/` 55个 + `source/` 旧迭代版 7个,共~44MB)。
- 运行时图压缩 17MB→8.4MB(按 displaySize×2.5 等比缩 + oxipng 无损,meta/UUID 不变引用不断,画质 OK)。
- `.git` 历史重写(清历史里的大文件旧版)评估后**不做** —— 高风险(10分支+worktree+force-push)换低收益(省80MB,不影响项目本身),当前工作区清爽即达标。

## M01 现状
M01(秩序之基首关)美术/物理/手电/拼片已于 2026-05-26 收口。详细调试历史见 `production/archive/2026-05-m01-polish-log.md`。
权威玩法 spec: `docs/design/game-design-spec.md` §5.2。

**M01 剧情改版(2026-06-02,spec §5.2 已改)**:开场从"碎片从天上掉 + 直接给手电"改成**有动机的"捡到式"叙事**——莱米走近大螺母(齿轮=螺母同一机械星体;关名/ID/文件名不动)→观察→(玩家点吊篮)够吊篮→篮子摇晃→9 拼片掉出堆地→**一支三色手电筒也从篮里掉出、砸到莱米头上**→莱米**蹲下把手电筒捡起**→玩家用手电照拼片发现短暂显色、自然学会核心机制。核心谜题(照色推理+交叠拼接+颜色规则+底光验证)**不变**;开场关键步玩家点触发。
(↑此剧情改版连同后续顶篮迭代,已于 2026-06-12 全部实现并回写 spec,见顶部「当前活跃线」;开场叙事现为: 够不着教学 beat → 顶篮分批撞出 → 手电砸头 → 蹲拾 → 手持观察。)
**M01 手电交互最终定(v4,2026-06-03,spec §5.2 已据此改)**:**推翻 v3 的"固定三按钮工具 / 固定光束"**——手电是莱米**手持**的,固定光束讲不通。最终模型:莱米捡起手电后手持;**点手里的手电**循环 红→黄→蓝→灭(手电小,无需精准点按钮);**点地面空白**莱米走过去、手电**覆盖面(不止1片)随莱米移动**扫照;覆盖面内候选碎片按当前灯色显色,移出/灭即恢复灰白;**点某拼片 = 玩家拾取(拼片随指针、非莱米去捡)并使手电熄灭**;拼片由玩家拾放、莱米只负责持手电。代码:代码里**现有两套手电机制(固定光束路径 + 手持指针拖动路径)全删**(含旧 `heldFlashlightId` 约20处引用、`revealAllFragmentsWithActiveFlashlight` reveal-all);只保留底层显色/选色模型并**新增 `clearFlashlight()`(灭态)**;覆盖面光束**新建**、锚到莱米(新字段 `flashlightAcquired`/`lemmyFlashlightNode`/`activeLightState`,不复用旧名)。`physicsSettled && flashlightAcquired` **仅**门控正式拼接/拾放片/底光验证,**不**挡开场走位/点篮/点掉落手电。config 实路径 `assets/resources/configs/stage1/m01-memory-gear.json`(load `configs/stage1/m01-memory-gear`)。**v4 计划(`docs/plans/2026-06-03-m01-intro-frame-anim-plan.md`)Task 1-10 已于 2026-06-12 全部执行完毕**(Task8 删旧/Task9 新接线/Task10 验证见顶部), 此段仅留作设计依据。**Claude 本环境实测 cocos MCP 在线可用**(可自做 refresh/reimport/scene 查询)。但**预览服务器起停 MCP 与 HTTP(:3000) 都返回 "not supported"**(2026-06-03 双复验)——`.ts` 改动重编译须在编辑器**手动**重启预览(Project>Preview),**Codex 也做不到、无额外能力**;Codex 走 HTTP 只是做 refresh_assets。
**M01 灯泡组件候选(2026-06-05)**:按用户要求用 Ideogram V4 `/v1/ideogram-v4/generate` 生成,不是 remix;4 张风格参考图在 `docs/design/generated-stage1-intro-art/ideogram-style-refs/bulb-style-ref-*.jpg`,调用字段 `style_reference_images`。已出 4 个独立候选源图 `docs/design/generated-stage1-intro-art/m01-bulb-ideogram-generate-v4-style-refs-v3-option-{1..4}.png`,并本地抠出透明版 `...-transparent.png`;预览拼图 `m01-bulb-ideogram-generate-v4-style-refs-v3-transparent-contact-sheet.png`。当前观感:2/4 更像可用游戏组件,1 偏旧灯泡,3 偏大和真实。
