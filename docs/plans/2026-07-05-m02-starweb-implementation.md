# M02《点亮你温暖我》Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans (inline, batch with checkpoints) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 把已定稿、已被求解器验证的 M02 星网玩法（协同/临界质量：点亮扩散→逐拍衰减→亮邻居够多则冻结自持）实现为 Cocos Creator 里可玩的关卡，三板难度递进（独环/双环/三瓣花）。

**Architecture:** 沿用仓库既有的 **core/(纯逻辑, Vitest 可测) ↔ cocos/(视图)** 分层与 M01 的"每关自带 bespoke 配置 + 自带加载器 + greybox 先行"模式。把已验证的求解器逻辑移植成纯 `StarNetworkModel`（引擎无关、单测钉死正确性），配置走已入库的 `assets/resources/configs/stage1/m02-starweb-warmth.json`；Cocos 侧只做点触输入、逐拍驱动 model、把 model 状态渲染成星点/光丝的 greybox 视图。**先 greybox 跑通核心，再谈美术/动画/工具卡。**

**Tech Stack:** TypeScript(strict), Cocos Creator 3.8, Vitest, 现有 `assets/scripts/core` 纯模块约定。

**Source of truth:** 设计见 `docs/design/game-design-spec.md` §5.3；数值/星网/参考解见 `assets/resources/configs/stage1/m02-starweb-warmth.json`；机制的可执行规格 = `assets/scripts/core/StarNetworkModel.ts` + 其单测（tightness/参考解全锁已折进 `tests/core/`，挂 CI）。

**已知约束（来自项目记忆）:**
- 并发会话共用主 worktree：**频繁提交**保护未提交改动不被别的会话 checkout 冲掉。
- Cocos 编辑器打开的是主仓不是 worktree；`.ts` 改动预览不热更，需手动重启预览面板。
- 玩法/视觉时序 headless 验不了 → Phase 2+ 的验证在编辑器/预览里做，别指望无头截图。

---

## File Structure

**Phase 1 — 纯逻辑（headless 全可测，本计划的地基）**
- Create `assets/scripts/core/StarNetworkModel.ts` — 机制状态机：`tap` / `tick` / `step` / `isWon` / `reset` / 查询。引擎无关，无 Cocos import。
- Create `assets/scripts/core/StarWebConfig.ts` — M02 配置的类型 + `validateStarWebConfig()`（仿 `PuzzleConfig.ts` 风格）+ `boardGraph(board)` 取邻接。
- Create `tests/core/StarNetworkModel.test.ts` — 机制单测，用求解器已证事实钉死。
- Create `tests/core/StarWebConfig.test.ts` — 载入真实 json、校验形状、并把每板 `referenceTaps` 喂 model 断言全锁（把 verify 脚本折进 CI）。

**Phase 2 — Cocos greybox 视图（编辑器内验证）**
- Create `assets/scripts/cocos/M02StarNode.ts` — 单颗星视图：渲染 暗/亮/衰减中/冻结 四态 + 点触发事件；无关卡逻辑。
- Create `assets/scripts/cocos/M02StarWebLayout.ts` — 按 board.layout 生成星点节点 + 光丝连线（greybox：圆点 + 细线）。
- Create `assets/scripts/cocos/M02StarWebSession.ts` — 关卡编排器（仿 `M01GreyboxSession.ts`）：载配置、建板、接点触→`model.step`→刷新视图、判定 `isWon`、配额耗尽兜底、三板推进。
- Scene：新建 M02 greybox 场景（仿 M01 greybox 场景），挂 Session。

**Phase 3 — 反馈与收尾（编辑器/预览验证）**
- 剩余电量 UI（棒尖光点数）、衰减倒数光晕、失败提示。
- 胜利→修复动画（沿环流光）→ 智慧结晶 → ToolCard（复用 `assets/scripts/ui/ToolCardView.ts` + `core/ToolCard.ts`）。
- 板间过渡（tutorial→twin→trefoil）。

---

## Phase 1 — 纯逻辑（TDD）

### Task 1: StarNetworkModel 骨架 + tap 点亮邻居

**Files:**
- Create: `assets/scripts/core/StarNetworkModel.ts`
- Test: `tests/core/StarNetworkModel.test.ts`

- [ ] **Step 1: 写失败测试** — tap 把目标星及其邻居置满命，其余仍暗
```ts
import { describe, it, expect } from "vitest";
import { StarNetworkModel } from "../../assets/scripts/core/StarNetworkModel.ts";

const RING = { nodes: ["A","B","C"], edges: [["A","B"],["B","C"],["C","A"]] as [string,string][] };
const RULES = { lifeMax: 3, freezeThreshold: 2 };

describe("StarNetworkModel.tap", () => {
  it("点一颗星把它和直连邻居都置满命，其余为暗", () => {
    const m = new StarNetworkModel(RING, RULES);
    m.tap("A");
    expect(m.lifeOf("A")).toBe(3);
    expect(m.lifeOf("B")).toBe(3); // A 的邻居
    expect(m.lifeOf("C")).toBe(3); // A 的邻居
  });
});
```
- [ ] **Step 2: 跑测试确认失败** — `npx vitest run tests/core/StarNetworkModel.test.ts`（Expected: 模块不存在/方法未定义）
- [ ] **Step 3: 最小实现** — 构造函数存邻接表 + `life:Map`（全 0）；`lifeOf(id)`；`tap(id)` 置 id+邻居为 `lifeMax`。
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: 提交** — `feat(M02): StarNetworkModel tap 点亮邻居`

### Task 2: tick 同时衰减 + 冻结

- [ ] **Step 1: 写失败测试**
```ts
it("tick: 亮邻居<freeze 掉1命；孤星会掉命", () => {
  const m = new StarNetworkModel(RING, RULES);
  m.tap("A");           // A,B,C 满命(环上3点互为邻居)
  // 环上3点各有2个亮邻居 -> 全冻结, tick 后不掉
  m.tick();
  expect(m.lifeOf("A")).toBe(3);
});
it("tick: 只有1个亮邻居的星会漏光", () => {
  const line = { nodes:["X","Y","Z"], edges:[["X","Y"],["Y","Z"]] as [string,string][] };
  const m = new StarNetworkModel(line, RULES);
  m.tap("X");           // 亮 X,Y; Z 暗
  m.tick();             // X 邻居只有Y(1<2) 掉->2; Y 邻居 X(Z暗)=1 掉->2
  expect(m.lifeOf("X")).toBe(2);
  expect(m.lifeOf("Y")).toBe(2);
});
```
- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现** — `litNeighborCount(id)`；`tick()` 用衰减前快照同时结算：`life>0 && litNeighborCount<freeze → life-1`（0 则暗）。
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: 提交** — `feat(M02): StarNetworkModel tick 同时衰减+冻结`

### Task 3: step + isWon + reset

- [ ] **Step 1: 写失败测试** — `step(id)=tap+tick`；`isWon`=全亮且每颗亮邻居≥freeze；三角环 tap 任一点后 isWon（3点各2亮邻居）
```ts
it("三角环 step 一点即全锁", () => {
  const m = new StarNetworkModel(RING, RULES);
  m.step("A");
  expect(m.isWon()).toBe(true);
});
it("reset 清回全暗", () => {
  const m = new StarNetworkModel(RING, RULES);
  m.step("A"); m.reset();
  expect(m.isWon()).toBe(false);
  expect(m.lifeOf("A")).toBe(0);
});
```
- [ ] **Step 2/3/4:** 跑失败 → 实现 `step`/`isWon`/`reset` → 跑通过
- [ ] **Step 5: 提交** — `feat(M02): StarNetworkModel step/isWon/reset`

### Task 4: StarWebConfig 类型 + 校验 + boardGraph

**Files:** Create `assets/scripts/core/StarWebConfig.ts`; Test `tests/core/StarWebConfig.test.ts`

- [ ] **Step 1: 写失败测试** — 载入真实配置文件、断言 3 板、mechanic 数值、`boardGraph` 从 edges 还原邻接
```ts
import config from "../../assets/resources/configs/stage1/m02-starweb-warmth.json";
import { validateStarWebConfig, boardGraph } from "../../assets/scripts/core/StarWebConfig.ts";
it("真实配置合法且三板", () => {
  const r = validateStarWebConfig(config);
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.value.boards.map(b=>b.id)).toEqual(["tutorial","twin","trefoil"]);
});
```
- [ ] **Step 2/3/4:** 跑失败 → 实现类型 + `validateStarWebConfig`(仿 PuzzleConfig 校验风格) + `boardGraph(board)` → 跑通过
- [ ] **Step 5: 提交** — `feat(M02): StarWebConfig 类型+校验+boardGraph`

### Task 5: 配置×模型 集成断言（把 verify 折进 CI）

**Files:** 追加到 `tests/core/StarWebConfig.test.ts`

- [ ] **Step 1: 写失败测试** — 对每板：`referenceTaps` 逐个 `step` 后 `isWon()===true`；且 `referenceTaps.length === charges`
```ts
it("每板参考解在配额内全锁", () => {
  const r = validateStarWebConfig(config); if(!r.ok) throw new Error();
  for (const b of r.value.boards) {
    const m = new StarNetworkModel(boardGraph(b), r.value.mechanic);
    for (const id of b.solution.referenceTaps) m.step(id);
    expect(m.isWon(), b.id).toBe(true);
    expect(b.solution.referenceTaps.length).toBe(b.charges);
  }
});
```
- [ ] **Step 2/3/4:** 跑失败 → （逻辑已就绪，主要接线）→ 跑通过
- [ ] **Step 5:** `npm test` 全绿 + `npm run typecheck` 绿 → 提交 `test(M02): 配置×模型集成断言, verify 折进测试套件`

**Phase 1 完成判据:** `npm test` + `npm run typecheck` 全绿；纯逻辑正确性由单测钉死。**这是最高价值、可完全无头验证的地基。到此 checkpoint 给用户看。**

---

## Phase 2 — Cocos greybox 视图（编辑器内验证，Phase 1 绿后细化）

> 逐拍模型已可信，此阶段只做"输入→step→渲染"。按 M01 greybox 模式，参照 `M01GreyboxSession.ts` / `M01PuzzleInputRouter.ts`。验证在编辑器/预览，非 headless。

- [ ] **T6 M02StarNode**：一颗星的视图组件——四态显色(暗灰/暖金/衰减中/冻结)、点触发 `onTapped` 事件；greybox 用 Graphics 圆点。
- [ ] **T7 M02StarWebLayout**：读 board.layout 在场景里生成星点 + 光丝(细线)。
- [ ] **T8 M02StarWebSession**：载配置→建当前板→接 node.onTapped→`model.step(id)`→按 life/frozen 刷新所有 node 视图→`model.isWon()` 判胜→配额耗尽且未胜则可重来。
- [ ] **T9 场景**：新建 M02 greybox 场景挂 Session；编辑器内手动走通 tutorial 板(A,D)→全锁。
- [ ] **Checkpoint**：预览里 tutorial 可玩通。

---

## Phase 3 — 反馈与收尾（Phase 2 通后细化）

- [ ] **T10** 剩余电量 UI + 衰减倒数光晕 + 失败(漏光)可视化。
- [ ] **T11** 胜利→修复动画(沿环流光)→智慧结晶→ToolCard(复用 `ui/ToolCardView.ts`+`core/ToolCard.ts`)。
- [ ] **T12** 三板推进(tutorial→twin→trefoil) + 进度存储(复用 `core/ProgressStore.ts`)。
- [ ] **合并前**：跑 codex + code-review 消费完，再 ff 合并进 main。

---

## 执行方式

Inline execution（superpowers:executing-plans），逐 Task 提交，Phase 1 结束 checkpoint。Phase 2/3 每个 Task 完成即在编辑器/预览验证并 checkpoint（玩法视觉 headless 验不了）。
