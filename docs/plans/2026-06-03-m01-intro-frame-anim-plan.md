# M01 新开场（捡到式叙事）+ 手持手电观察 实现计划 (v4，已过 plan-review)

> **For Claude / Codex workers:** REQUIRED SUB-SKILL: 用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐 task 执行。**专用 git worktree**；每 task 一 commit；改产品行为前先对 spec §5.2。可测核心逻辑一律 TDD（先写失败测试）。本计划的行号锚点已逐一核对（2026-06-03），但大文件会漂移——执行时以 grep 符号名为准、行号仅作参考。

**Goal:** 实现 spec §5.2 的 M01 开场与手持手电玩法：莱米自动走近大螺母→观察→(点吊篮)够篮→篮子摇晃→9 拼片掉出→脚本化掉出一支实体手电砸到莱米(startle)→(点手电)莱米蹲下捡起(crouch)→此后手电由莱米**手持**，玩家**点手电循环 红/黄/蓝/灭**、**点地走位(手电覆盖面随莱米移动)**、**点拼片=玩家拾取(随指针)且手电灭**，靠扫照观察推断隐藏色再拼接。

**Architecture:** 可测核心逻辑抽成纯模块（vitest 直测，不 mock cc，沿用 `LemmyActor.test.ts` 模式）：帧播放状态机(`LemmyActorContract`)、intro 相位机(`M01IntroFlow`)、手电观察(`M01FlashlightObservation`：`cycleLight` + `fragmentsInCoverage`)、拼图输入路由(`M01PuzzleInputRouter`：`routeTap`)。cc 组件只做薄胶水。动画：`idle_right/walk_right/reach_up_right` 维持 transform，新增 `startle/crouch` 帧动作。手电见下"手电架构"。

**Tech Stack:** Cocos Creator 3.8 + TS strict；vitest(`vitest run` / `npm test`)；`npm run typecheck`；冒烟 `node scripts/m01-preview-smoke.mjs`（`npm run smoke:m01-preview`）。Cocos 资源刷新：**Claude 本环境已实测 cocos MCP 在线可用（2026-06-03：server status + asset DB ready + project info 三验证通过）**，直接用 `mcp__cocos-creator__project_refresh_assets` / `project_reimport_asset`（需 Cocos 编辑器开着）。**仅当**某执行者无 MCP（Codex / headless run）才回退 HTTP `http://127.0.0.1:3000/api/project/refresh_assets`。注：Task 0 正常路径**无需刷新**（meta 已存在），刷新仅为将来新增帧缺 meta 的兜底。**TS 改动后 Cocos 预览要手动重启预览服务**才会重编译，再跑冒烟。

---

## 手电架构（v4 核心，先读懂再动手）

代码里**现存两套手电机制，v4 把两套都删掉**，只保留底层**显色/选色模型**，并在其上**新建**"莱米锚定的覆盖面光束"：

- **KEEP（保留 + 扩展"灭"态）= 显色/选色模型**：`M01GreyboxSession.selectFlashlight(flashlightId)`（`M01GreyboxSession.ts:278`）按**灯 ID** 读 `config.flashlights`（`assets/resources/configs/stage1/m01-memory-gear.json` L45-73 的 `flashlight_red/yellow/blue`；Cocos load path `configs/stage1/m01-memory-gear`），设 `activeFlashlightColor`，驱动碎片显色/tint。**它没有"灭"态**——v4 要加一个 `clearFlashlight()`（清 `activeFlashlightColor` + 候选碎片复位灰白）。
- **REMOVE ①「固定光束」路径**（整条删）：`singleFlashlightTool` 点击守卫(`Bootstrap` ~L1357，注意是 camelCase 图层 id，不是 `single_flashlight_tool`)→ `cycleFixedFlashlight`(L1387)→ `getNextFixedFlashlightToken`(L1396)/`selectFixedFlashlight`(L1408)→ `activateFixedFlashlightBeam`(L2190，被 L1426 与 L2002 两处调用)→ `resolveFixedFlashlightBeamAnchor`(L2217，是 `FIXED_FLASHLIGHT_BEAM_ANCHOR` L133 的唯一消费者)。
- **REMOVE ②「手持指针拖动」路径**（整条删；这才是代码里现有的 "held flashlight"，它是**指针跟随 + 拖动瞄准**，正是 spec 禁止的）：`heldFlashlightId`(L223)、`moveHeldFlashlightWithPointer`(L1659，`entry.node.setPosition(pointer)`)、`suppressHeldFlashlightFollow`(L230)、`heldFlashlightPointerId`、`moveFlashlightBeamWithPointer`(L1636)、`beginFlashlightBeamGesture`(L1676)、`updateFlashlightBeamGesture`(L1716)、`flashlightBeamTarget`/`getFlashlightBeamTarget`(L981)、`flashlightBeamGesturePointerId`、`flashlightBeamReach`/`setFlashlightBeamReach`(L229/L472)+ scroll 调射程(L1726)。
- **REMOVE ③ 三个颜色按钮 token**：`M01GreyboxLayout.buildFlashlightNode`(L263) + `positionForFlashlightButton`(L282，red{361,77}/yellow{360,59}/blue{359,43})；`M01GreyboxDrag` 的 `select_flashlight`(L14/L61)。⚠️ Session 读的是 `config.flashlights`、**不是** `layout.flashlights`——删 layout 按钮**不会**破坏显色模型。
- **NEW（新建，复用上面的显色模型）= 莱米锚定覆盖面光束**：莱米手部挂一个"手电"标记节点（捡起时 reparent 到莱米）；**光束源点 + 覆盖面圆心 = 莱米当前世界坐标**（不是固定 anchor、不是指针）。新建字段 `flashlightAcquired`(布尔) / `lemmyFlashlightNode`(手部标记节点) / `activeLightState`(当前灯态)——**不复用旧 `heldFlashlightId` 的名字与语义**（旧字段约 20 处引用随旧路径整体删除）。`cycleLight` 四态（off→red→yellow→blue→off）映射到 `selectFlashlight(flashlight_<color>)` / `clearFlashlight()`；`fragmentsInCoverage` 决定覆盖面内（**排除已在拼接盘上的**碎片）哪些以当前灯色显色；点地 `lemmyActor.walkTo` 走位、光束随莱米移动；点拼片=玩家拾取 + `clearFlashlight()`。

---

## V4 关键决策（相对 v3）

1. **手电是莱米手持、不是固定光束**（v3 的"固定三按钮工具/固定光束"作废）。光束有**覆盖面**(不止1片)、**随莱米移动**。
2. **现有两套手电机制（固定光束 + 手持指针拖动）都删**；只 KEEP 显色/选色模型并加"灭"态；覆盖面光束**新建**、锚到莱米。（注意：代码里的 "held flashlight" 是指针拖动瞄准的，**不可"保留改造"**，必须删。）
3. **颜色用"点手电循环"** 红→黄→蓝→**灭** 四态（手电小，点中手电体即可，无需精准按钮）。"灭"态靠新 `clearFlashlight()`。
4. **两阶段输入**，且**莱米始终可点地走位**，区别只在光束是否随行：拾起前点地=莱米自己走(无光束)、点地上掉落的手电=蹲下捡起；拾起后点手里手电=循环换色、点地=走+覆盖面随行、点拼片=玩家拾取(随指针)且灭灯、持片时点任意处放下。
5. **正式拼接输入门控**：`physicsSettled && flashlightAcquired` 同时为真才进正式拼接判定——**仅**限正式拼接 / 拾片 / 放片 / 底光验证，**不**门控开场的点地走位 / 点篮 / 点掉落手电。
6. **不手写假 meta**：帧 `.png.meta` 已存在（见 Task 0）；如将来新增帧缺 meta，用 Cocos/MCP 刷新生成，不手写。

---

## Current Facts（执行者必读；行号 2026-06-03 已核对，漂移以符号名为准）

- 权威 spec：`docs/design/game-design-spec.md` §5.2（手电模型最终版已在其中）。
- **帧资产现状（重要）**：`assets/resources/art/characters/lemmy/startle/`(23 png) 与 `crouch/`(24 png) **均已存在且每 png 都有 `.png.meta`**（23/23、24/24，meta 含真实 uuid）。但**当前全部未提交**：startle 已从旧 30 帧重剪为 23（00-22 改动、23-29 删除、meta 未跟踪、gif 改动），crouch 整个目录未跟踪。→ **Task 0 先把这批资产作为干净基线提交**（用户此前已要求"蹲下转正式资产"），再做不变量守卫测试。
- `LemmyActor.ts`：`walkTo`(L81)、`playAction`(L96)、`LEMMY_ACTION_SCHEDULES`(L99)；单图 + transform。`LemmyActorContract.ts`：`LemmyActionId`(L7，现仅 3 个 transform 动作)、`LEMMY_ACTION_SCHEDULES`(L47)、`LemmyCancellationContext`(L36，`beginAction(actionId: LemmyActionId)`)、`LemmyActionToken.actionId`(L26)、`LemmyPendingAction.token`(L44)、`LemmyActionInterrupted`/`LemmyActorDestroyed`(L79/L86)。`tests/cocos/LemmyActor.test.ts` 只测纯逻辑。`startle/crouch` / `LEMMY_FRAME_ACTIONS` / `playFrameAction` 目前**全不存在**（Task1-5 是新增）。
- `M01IntroSequence.ts`：`init`(L129，options `fragments`/`onSpill`/`onSettled` L96-100)、`handleBasketTap`(**L270**)、`beginWalk` 里**自动 `beginReach`**(**L284**)、`wobbleBasket`、`startSpill`(L331，**自动** `beginExit` L339→342) spill 9 拼片。文件内 6 处 "flashlight" **都是注释**、无逻辑（手电逻辑确实不在此文件）。
- `M01GreyboxBootstrap.ts`(~3600 行)：intro 接线 `addComponent(M01IntroSequence)` + `init({...})`(L351)；`physicsSettled`(L208) 已存在、`flashlightAcquired` **不存在**(net-new)；两套手电路径符号见上"手电架构"。
- 美术：`single_flashlight_tool`（`M01GreyboxArt.ts` L631/826）可复用作"实体手电"本体贴图。
- 受影响测试：`tests/cocos/{M01GreyboxArt,M01GreyboxLayout,M01GreyboxDrag,M01GreyboxSession}.test.ts`、`tests/m01PreviewSmoke*`、`tests/cocosProjectScaffold.test.ts`。（注：暂无 basket 容量护栏测试，Task 4 是**新增**断言而非扩展。）

## Success Criteria
1. `npm run typecheck` 通过；`npm test` 全绿（新增纯逻辑测试 + 旧手电移除相关测试更新 + 现有不回归）。
2. 帧：startle/crouch 已提交、有 meta、`loadDir` 稳定；`LemmyActor` 能一次性播放、保持末帧、可取消、完成 resolve。
3. 玩家流程严格匹配 spec §5.2（见 Task 10 逐拍清单）。**绝不一点串完**。
4. 旧手电两套路径不可达：无 draggable token、无指针跟随/拖动瞄准、无 scroll 射程、无 drop 选光、无三独立按钮、无固定光束 anchor。
5. `cycleLight` 四态正确驱动显色，"灭"态清显色；`physicsSettled && flashlightAcquired` 双门控才进正式拼接。
6. 颜色混合/交叠证据/底光验证/拼接判定行为不变；光束**不照拼接盘**；`npm run smoke:m01-preview` 通过（TS 改动后重启预览）。

## File Structure
- **Create** `M01IntroFlow.ts` — 纯 intro 相位 reducer。
- **Create** `M01FlashlightObservation.ts` — 纯：`cycleLight`、`fragmentsInCoverage`。
- **Create** `M01PuzzleInputRouter.ts` — 纯：两阶段点击路由 `routeTap`。
- **Modify** `LemmyActorContract.ts` / `LemmyActor.ts` — 帧动作 + 播放 + 类型加宽。
- **Modify** `M01IntroSequence.ts` — 自动走近/观察/点篮/够篮/脚本化手电掉落砸/蹲下捡。
- **Modify** `M01GreyboxSession.ts` — 加 `clearFlashlight()`（"灭"态）。
- **Modify** `M01GreyboxLayout.ts` / `M01GreyboxDrag.ts` / `M01GreyboxArt.ts` — 删旧手电入口（见"手电架构"）。
- **Modify** `M01GreyboxBootstrap.ts` — 删两套旧路径；beam 锚莱米 + 覆盖面；点手电 `cycleLight`；点地 `walkTo`；拾取门控；双门控拼接。
- **Modify** `scripts/m01-preview-smoke*.mjs` + tests；**Modify** `production/active.md`（收尾）。

---

## Task 0: 提交帧资产基线 + 帧不变量守卫测试
**Files:** Create `tests/cocos/LemmyFrameAssets.test.ts`
- [ ] **先确认并提交当前未跟踪/改动的帧资产**作为干净基线：`git add assets/resources/art/characters/lemmy/{startle,crouch}` 后 commit（startle 重剪为 23 + meta、crouch 24 + meta + gif）。执行时**重新数一遍**帧数（资产可能还在改），以实际为准更新断言常量。
- [ ] 写**守卫**测试（不是"缺 meta 的红"——meta 已存在）：startle 帧数==实际值（应 23）、crouch==24、命名 `-NN` 从 00 连续无空洞、**每个 `.png` 有同名 `.png.meta`**、无孤儿 meta。
- [ ] 跑 → 预期 **PASS**（守卫现状）。若意外 FAIL 说明帧/ meta 不一致，先修齐再继续。
- [ ] （仅当未来新增帧缺 meta 的回退）用 `mcp__cocos-creator__project_refresh_assets`（folder `db://assets/resources/art/characters/lemmy/startle`、`/crouch`）或 Codex HTTP 刷新生成；**不手写 meta**。
- [ ] commit。

## Task 1: 帧播放 contract + 类型加宽（无 `as`）
**Files:** `LemmyActorContract.ts` / `tests/cocos/LemmyActor.test.ts`
- [ ] 失败测试：`LEMMY_FRAME_ACTIONS` 只含 startle/crouch、one-shot + holdLast；`advanceFramePlayback` 一次性 clamp 末帧 + done、循环 wrap 不 done；且 `LemmyActionId` 现在能接纳 `"startle"`/`"crouch"`（类型层断言：把帧动作传给一个 `(id: LemmyActionId)=>` 的桩函数能编译）。
- [ ] 实现**类型加宽**：把现有 3 动作联合**改名** `LemmyTransformActionId`，导出宽别名 `export type LemmyActionId = LemmyTransformActionId | LemmyFrameActionId`。这样所有现引用 `LemmyActionId` 的类型（`beginAction` 参数、`LemmyActionToken.actionId`、`LemmyActionHandle`、`LemmyPendingAction.token`、`LemmyActionInterrupted`/`LemmyActorDestroyed`）**自动接纳帧动作、无需 `as`**。`LEMMY_ACTION_SCHEDULES: Record<LemmyTransformActionId, …>`（仅 transform）；新增 `LEMMY_FRAME_ACTIONS: Record<LemmyFrameActionId, {dir;fps;loop;holdLast}>`（startle dir `art/characters/lemmy/startle` fps16；crouch dir `…/crouch` fps14；均 loop:false holdLast:true）；`createFramePlayback`/`advanceFramePlayback`。
- [ ] PASS + `npm run typecheck`（确认全仓无新报错、无 `as`）。commit。

## Task 2: LemmyActor 帧播放胶水
**Files:** `LemmyActor.ts`
- [ ] `loadFrames(id)`：`resources.loadDir(LEMMY_FRAME_ACTIONS[id].dir, SpriteFrame)`→按 name 排序缓存→空帧 reject。
- [ ] `playFrameAction(id, opts)`：`cancellation.beginAction(id)`（union 合法、无 `as`）→设首帧→存 playback state；`update(dt)` 用 `advanceFramePlayback(state, dt*1000)` 切帧；一次性 done→`resolveActive`（holdLast 停末帧）。`opts.facing` 用 `setScale(±1,1,1)`。
- [ ] `npm run typecheck` + 冒烟基线（暂无人调，行为不变）。commit。

## Task 3: intro 相位机（自动走近→观察→等点篮→够篮）+ 防自动串完
**Files:** Create `M01IntroFlow.ts` / `tests/cocos/M01IntroFlow.test.ts`；Modify `M01IntroSequence.ts`
- [ ] 失败测试（纯 reducer）：相位链 `approaching→observing→(basketTapped)reaching→tipping→spillingFragments→bonking→waitingPickup→(flashlightTapped)pickingUp→acquired`；断言 `observing` 无 `basketTapped` **不前进**、`waitingPickup` 无 `flashlightTapped` **不前进**（证明旧的 `beginWalk` 自动 `beginReach`(L284) 与 `startSpill` 自动 `beginExit`(L339) 捷径已被移除）。
- [ ] 实现 `nextIntroPhase(phase, event)` 纯函数 → PASS。
- [ ] 组件接线：**自动** `beginWalk`（不再点击触发）→`observing`(idle 朝吊篮一拍)；`handleBasketTap`(L270) 仅在 `observing` 推进到 `reaching`；删 `beginWalk` 的自动 `beginReach`、删 `startSpill` 后自动 `beginExit`。
- [ ] typecheck + 冒烟。commit。

## Task 4: 实体手电道具 + 脚本化掉落砸莱米→startle
**Files:** `M01IntroSequence.ts`、`M01GreyboxLayout.ts`/intro layout、`M01GreyboxArt.ts`、`M01GreyboxBootstrap.ts`
- [ ] 新增**实体手电节点**（复用 `single_flashlight_tool` 贴图），初始在吊篮内（与 9 拼片同 stage），与旧三色按钮 token 无关。
- [ ] tip 后：先走现有 `onSpill`（9 拼片物理掉落不变）；新相位 `bonking`：脚本化 tween 让实体手电从篮口弧线落到莱米头顶。
- [ ] 命中拍 `await lemmyActor.playFrameAction("startle")`（末帧=吃惊定住）；锁输入。
- [ ] **新增** basket 容量断言（非扩展，此前无此测试）：9 拼片 + 1 实体手电都放得下。
- [ ] typecheck + 冒烟。commit。

## Task 5: 点手电→crouch 捡起→`flashlightAcquired`
**Files:** `M01IntroSequence.ts`、`M01GreyboxBootstrap.ts`
- [ ] `waitingPickup`：玩家点**地上的实体手电**→`pickingUp`→`await lemmyActor.playFrameAction("crouch")`；近末帧把实体手电 reparent 到莱米手部锚点（成为"手持"标记节点）。
- [ ] 回调 `onFlashlightPickedUp()`→bootstrap 置 `flashlightAcquired=true`。
- [ ] typecheck + 冒烟。commit。

## Task 6: 手电观察纯逻辑（颜色循环 + 覆盖面命中）
**Files:** Create `M01FlashlightObservation.ts` / `tests/cocos/M01FlashlightObservation.test.ts`
- [ ] 失败测试：
  - `cycleLight("off")==="red"`，`red→yellow→blue→off`（四态循环）。
  - `fragmentsInCoverage(center,radius,frags)`：返回中心半径内**多个** id（覆盖面不止 1 片）；半径外不返回；**`onTray:true` 的碎片即使在半径内也排除**（spec：光束不照拼接盘）。
- [ ] 实现：`type LightState="off"|"red"|"yellow"|"blue"`；`cycleLight`；`fragmentsInCoverage(center:{x,y}, radius, frags:{id;pos;onTray?}[])`（欧氏距离≤radius 且 !onTray）。
- [ ] PASS + typecheck。commit。

## Task 7: 两阶段拼图输入路由（纯）
**Files:** Create `M01PuzzleInputRouter.ts` / `tests/cocos/M01PuzzleInputRouter.test.ts`
- [ ] 失败测试 `routeTap(target, ctx)`：
  - `{flashlightAcquired:false, holdingPiece:false}`：`groundEmpty`→`"walkLemmy"`；`fallenFlashlight`→`"pickupFlashlight"`。
  - `{flashlightAcquired:true, holdingPiece:false}`：`heldFlashlight`→`"cycleLight"`；`groundEmpty`→`"walkLemmyWithBeam"`；`fragment`→`"pickupPieceAndLightOff"`。
  - `{holdingPiece:true}`：任意 `tap`→`"dropPiece"`。
- [ ] **命中优先级（按阶段；上层 hit test 决定 `target.kind`，`routeTap` 据此路由）**：① **持片时**——任何点击 = `dropPiece`（最高，压过一切）；② **拾起手电前（含 `waitingPickup`）**——`fallenFlashlight` > fragment > ground（掉落手电即使和碎片重叠也优先被点到拾起；此阶段碎片尚不可拾，落到点地走位）；③ **拾起手电后**——fragment > heldFlashlight > groundEmpty（点碎片先拾片灭灯、点手电先循环灯色、都没命中才点地走位）。测试覆盖：`waitingPickup` 时掉落手电与碎片重叠 → `pickupFlashlight`（非 pickupPiece）；持片时点手电/碎片/地 → 一律 `dropPiece`；拾起后碎片与空地重叠 → fragment。
- [ ] 实现 `routeTap`（target.kind + ctx → action 纯函数）→ PASS。typecheck。commit。

## Task 8: 删两套旧手电路径 + 给 Session 加"灭"态（保留显色模型）
**Files:** `M01GreyboxSession.ts`、`M01GreyboxLayout.ts`、`M01GreyboxDrag.ts`、`M01GreyboxBootstrap.ts`、`M01GreyboxArt.ts` + 相应测试
- [ ] **Session 加"灭"**：失败测试 `clearFlashlight()` 后 `activeFlashlightColor` 为空、候选碎片显色清除；实现最小 `clearFlashlight()` → PASS。
- [ ] **删固定光束路径**：`cycleFixedFlashlight`(L1387)、`getNextFixedFlashlightToken`(L1396)、`selectFixedFlashlight`(L1408)、`activateFixedFlashlightBeam`(L2190 + 两处调用 L1426/L2002)、`resolveFixedFlashlightBeamAnchor`(L2217)、`FIXED_FLASHLIGHT_BEAM_ANCHOR`(L133)、`singleFlashlightTool` 点击守卫(~L1357)。
- [ ] **删手持指针拖动路径**：`moveHeldFlashlightWithPointer`(L1659)、`moveFlashlightBeamWithPointer`(L1636)、`beginFlashlightBeamGesture`(L1676)、`updateFlashlightBeamGesture`(L1716)、`flashlightBeamTarget`/`getFlashlightBeamTarget`(L981)、`flashlightBeamGesturePointerId`、`heldFlashlightPointerId`、`suppressHeldFlashlightFollow`(L230)、`flashlightBeamReach`/`setFlashlightBeamReach`(L229/L472)+scroll(L1726)。（旧 `heldFlashlightId` 字段约 20 处引用，**随旧路径整体删除、不复用其名字与语义**；"莱米持有"改用新字段 `lemmyFlashlightNode` / `flashlightAcquired`。）
- [ ] **删 reveal-all helper**：`revealAllFragmentsWithActiveFlashlight`（L2228 定义、L2212 调用）一次性显色全部碎片，与覆盖面玩法冲突——删除，由 Task 9 覆盖面显色取代。
- [ ] **删三按钮 + drop 选光**：`layout.buildFlashlightNode`/`positionForFlashlightButton`、`M01GreyboxDrag.select_flashlight`(L14/61)。
- [ ] **保留**：`Session.selectFlashlight` 颜色/显色模型、observed color、tint（Session 读 `config.flashlights`，与 `layout.flashlights` 无关）。
- [ ] 更新受影响测试（`M01GreyboxDrag`/`Layout`/`Art`/`Session`、scaffold、smoke helpers）：删旧手电断言、加"旧入口不可达"断言。
- [ ] typecheck + `npm test`。commit。

## Task 9: 新手电运行时接线（beam 锚莱米 + 覆盖面 + 点手电循环 + 点地 walkTo + 双门控）
**Files:** `M01GreyboxBootstrap.ts`
- [ ] beam 源点 + 覆盖面圆心 = **莱米当前世界坐标**（手部标记节点）；用 Task6 `fragmentsInCoverage`（排除拼接盘上的）决定哪些碎片以当前 `LightState` 显色。**每次莱米移动 / 换色都重算覆盖面**：仅覆盖面内碎片置当前灯色、其余复灰白（**取代已删的 `revealAllFragmentsWithActiveFlashlight`**）。验证三态：覆盖面外保持灰白、莱米移动后旧覆盖区恢复灰白、新覆盖区显色。
- [ ] 点击路由用 Task7 `routeTap`：点手持手电→`cycleLight`，映射 red/yellow/blue→`Session.selectFlashlight(flashlight_<color>)`、off→`Session.clearFlashlight()`；点地空白→`lemmyActor.walkTo(point)`（拾起后 beam 随莱米移动、拾起前仅走无光束）；点拼片→玩家拾取(现有拼片拖拽) + `clearFlashlight()`。
- [ ] 正式拼接判定入口加 `physicsSettled && flashlightAcquired` 双门控——**仅**门控正式拼接 / 拾片 / 放片 / 底光验证；**不**挡开场的点地走位、点篮、点掉落手电（否则开场会卡死）。
- [ ] typecheck + 冒烟（重启预览）。commit。

## Task 10: 整体验证 + 收尾
- [ ] `npm run typecheck` + `npm test` 全绿；`npm run smoke:m01-preview`（重启预览后）。
- [ ] 对 spec §5.2 逐拍核验：自动走近→观察→点篮→够篮→9 拼片掉→实体手电掉砸 startle→点手电 crouch 捡→点手电循环 红/黄/蓝/灭→点地莱米走+覆盖面随行→点拼片玩家拾取(随指针)且灭灯→拼接(双门控)。确认旧手电两套路径全不可达、光束不照拼接盘。
- [ ] 更新 `production/active.md`：M01 开场 + 手持手电已实现；LemmyActor 已具帧播放(startle/crouch)。

## 范围/风险
- 只接 startle/crouch 帧；idle/walk/reach 维持 transform。
- cc 胶水/tween/渲染靠纯逻辑单测(Task1/3/6/7) + 冒烟兜底。
- **Task 8 牵动多个测试**，必须同步更新它们（别留悬空断言）；删两套路径时用 grep 符号名确认无悬空调用（尤其 `activateFixedFlashlightBeam` 的两处调用、`resolveFixedFlashlightBeamAnchor` 唯一消费 anchor）。
- Task 0 / 冒烟需 Cocos 编辑器在线；TS 改动后重启预览再冒烟。
- 与现有 M01 行为冲突先停下报告（CLAUDE.md：三次不同尝试无果即重审根因）。
