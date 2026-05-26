# M01 拼片物理堆叠设计

**日期**：2026-05-21
**状态**：历史设计稿（2026-05-26 已被最终实现收口）
**关联**：`production/active.md`（M01 P1-a 原型当前基线）

> 2026-05-26 收口说明：本文件记录的是物理堆叠的早期方案，不再作为当前实现的 source of truth。最终版以 `docs/design/game-design-spec.md` §5.2、`assets/scripts/cocos/M01PhysicsPile.ts`、`assets/scripts/cocos/M01PhysicsBoundary.ts` 和对应测试为准。关键差异：9 个拼片开局不是逐片 `180ms` 投放，而是从顶部以小堆布局同时自由落体；显色使用 `light-mask` 玻璃透色 + `light-edge` 原边线 overlay；拖拽时临时关闭拼片碰撞体，放下或吸附后再交还物理/关卡逻辑。

## 目标

把 M01 的 9 个拼片从"整齐 3×3 浮空网格"改成**重力下自然堆叠的小堆**，并支持运行时动态再平衡。

**用户体验目标：**

1. 进入关卡时，9 片拼片落下来堆成一小堆，落在手电筒锥形射程内的地面上
2. 玩家拖一片走时，被压住的拼片失去支撑 → 重新下落 → 找到新接触点 → 静止
3. 拖起的拼片受玩家手指控制（kinematic），松手时：
   - 落到吸附位 → 被关卡逻辑接管（保持现有逻辑）
   - 没落到吸附位 → 切回 dynamic，自由跌落重新进入堆里

## 非目标

- ❌ **不**改 M01 的玩法或解谜逻辑（颜色证据、手电筒颜色滤镜、ToolCard 等都不动）
- ❌ **不**用第三方物理库（用 Cocos Creator 3.8 自带的 2D 物理）
- ❌ **不**做柔体、断裂、粒子或其他高级仿真
- ❌ **不**动其他关卡——这个设计只针对 M01

## 视觉结果

**初始状态：**

- 9 片从屏幕上方以小堆形态同时落进手电筒锥形覆盖区域
- 在 `FRAGMENT_FLOOR` 中下部互相挤压，自然堆成一小堆
- 没有重叠（刚体不互穿）
- 每片下方有柔和椭圆阴影
- **堆的具体形状是物理涌现的结果**——可能 3 层，可能 4 层，可能塌成一长排；可能整齐、可能歪斜。不预设、不调控

**严格物理保证：**

- 圆形：任意旋转（视觉等效）
- 三角：必须有一条边贴在地面或下方拼片上
- 六边形：必须有一条平边贴在地面或下方拼片上
- 倾斜只有在有 2+ 接触点时才可能（嵌在 V 形凹槽里的拼片可能微倾）
- 没有任何刚体互穿

每次进入关卡随机种子来自 `Date.now()`，不同 session 堆形不同；同 session 内物理求解器在固定时间步下是确定的。

## 技术方案

### 物理引擎：Cocos Creator 3.8 内置 box2d

- 启用方式：`Project Settings → Physics-2D → Default Physics System`
- 重力：默认 `(0, -320)` 像素/秒²（Cocos 单位，向下）
- 时间步：fixed `1/60` 秒，确保跨设备一致

### 每片拼片的组件

```typescript
@property(RigidBody2D)
body: RigidBody2D;

@property(PolygonCollider2D)
collider: PolygonCollider2D;
```

- `body.type = Dynamic`（默认状态）
- `collider.points` 按形状预设：
  - 圆形：`CircleCollider2D` `radius = 18`
  - 三角：`PolygonCollider2D` 等边三角形 3 点
  - 六边形：`PolygonCollider2D` 正六边形 6 点
- `collider.friction = 0.6`（防止互相打滑）
- `collider.restitution = 0.02`（落地不弹，但保留一点点）
- `collider.density = 1`

### 地板与墙

`FRAGMENT_FLOOR` 矩形（200~440 X、-260~120 Y）目前只是一个 clip 区域。给它加 3 条静态边缘：

- **地面**：水平线段 collider，位于 y = -260
- **左墙**：垂直线段 collider，位于 x = 200
- **右墙**：垂直线段 collider，位于 x = 440
- **顶部不封**——允许拖拽时把拼片举到 floor 上方

实现：一个 `M01PhysicsBoundary` 组件，挂在 `FRAGMENT_FLOOR` 节点上，`start()` 里创建 3 个 `BoxCollider2D` 边缘。

### 初始堆生成（开场动画）

**关卡开场是可见的"从天而落"动画**，不是隐藏的预设置。玩家进入关卡时，先看到空地板（手电筒已就位），然后 9 个拼片从画面上方以小堆形态同时落下，互相挤压、堆叠，最后静止——整个过程肉眼可见。

```
1. 关卡 start():
   - 初始化手电筒、地板、墙
   - fragments 全部创建并保持可见，稍后统一重定位到画面顶部
   - 锁定玩家输入（拖拽、点击都不响应）
   - 显示状态文字"碎片正在落下..."

2. 用 Date.now() 种子的 mulberry32 PRNG 给 9 个 fragment 随机排序

3. 对每个 fragment（按随机顺序映射到固定小堆 offset）：
   - node.active = true
   - 起始位置: (320 + pileOffset.x * 82 + driftX, 350 + pileOffset.y + driftY)
     - 320 = FRAGMENT_FLOOR 中线 X
     - pileOffset = 4-3-2 小堆模板
     - driftX ∈ [-5, +5]，driftY ∈ [-4, +4]，避免完全机械
     - DROP_ORIGIN_Y = 350（从顶部进入画面）
   - 随机选稳定旋转角度（圆=任意，三角=0°/120°/240°，六边形=0°/60°/120°/180°/240°/300°）
   - body.type = Dynamic，速度=0

4. 等待真实 settle 检测，最大窗口 SETTLE_TIMEOUT = 3600ms

5. 检测物理静止（所有 body.linearVelocity.length < 0.5）：
   - 是 → 解锁玩家输入，状态文字切回正常提示
   - 否 → 再多等 500ms 然后强制解锁（兜底）
```

**时间预算：** 由真实自由落体和 settle 共同决定，最大约 3.6 秒；正常情况下 settle 提前触发。

**为什么从天而落而非预设静止位置：**
- 让"重力"从隐藏机制变成开场表演，玩家立刻理解"这堆是真的物理堆出来的"
- 每次进入关卡都看到不同的堆叠过程，重玩有新鲜感
- 不需要预先算静止位置，物理引擎自己得到结果

### 拖拽交互

进入拖拽：
```
on touchStart(pieceId):
  body.type = Kinematic
  body.linearVelocity = (0, 0)
  body.angularVelocity = 0
  pieceId 加入 heldFragmentIds 集合
```

拖拽中：
```
on touchMove:
  // 最终版：被指针控制的拼片临时关闭 body / collider，
  // 这样不会把旁边的 dynamic 拼片撞飞；放手时再恢复物理。
  const target = pointerWorldPosition
  piece.node.position = target + grabOffset
  其他 dynamic pieces 自然受重力下落、互相挤压
```

松手：
```
on touchEnd:
  if 落点在某 evidence target 的吸附半径内 AND 现有 snap 校验通过:
    // 吸附 ≠ 消费：拼片"停在"target 位置，但还可以再被拿起
    body.type = Kinematic            // 不再受重力影响，原地停住
    body.linearVelocity = (0, 0)
    body.angularVelocity = 0
    piece.node.position = target.position
    piece.snappedTargetId = targetId
    // 现有 evidence 触发 / completed 校验逻辑照旧
  else:
    // 自由跌落回堆
    body.type = Dynamic
    body.linearVelocity = (0, 0)
    body.angularVelocity = 0
    // 物理引擎自然让它落回堆里
```

### 拼片在吸附位上的状态

**吸附 ≠ 消失**。被吸附到 evidence target 上的拼片处于 Kinematic 状态：
- 视觉上停在 target 位置
- 不受重力影响，不会被堆里其他拼片碰撞推动
- **仍然响应 touchStart**——玩家可以再拿起它（变回 Kinematic 跟手），拖到别处或拖回堆里
- 玩家如果发现颜色/证据搭配错了，可以拖回来重试

Evidence target 的视觉位置在屏幕左侧（X 负值区域），远离 `FRAGMENT_FLOOR`（X 200~440），所以吸附位上的拼片在几何上不会影响堆里其他拼片的物理。

### 堆里失去支撑的连锁反应

一片被拖出（无论最终落到 target 还是落回堆）时，它**离开堆的那一刻**就让原本压在它身上的拼片失去支撑。物理引擎自然让那些拼片下落、找到新接触点、重新稳定。

**不需要为剩余 8 / 7 / 6 ... 1 片预设特殊布局**——物理引擎对任意剩余拼片数都能求解出合理静止形态。极端情况下，最后剩 1 片就是孤立地躺在地面上。

### 关卡完成时

当所有 evidence 都满足 → `session.completed = true` → 触发现有的 repair sequence（齿轮旋转、星光复原等）。这时吸附位上的拼片可以：
- 保持 Kinematic 停在原位（作为完成证据）
- 或随 repair 动画一起淡出/飞向中心齿轮（视觉表演，超出本设计范围，归 repair 动画段处理）

### 坐标系与现有代码的关系

- 现有 `M01GreyboxLayout.fragments[i].position` 来自 JSON 配置（手工排的网格坐标）
- **保留 JSON 里的 position 值**——作为 static 测试模式的回退坐标（物理模式实际不读它）
- 物理模式下，运行时位置完全由物理引擎决定，覆盖 layout token 的 `position` 字段
- 拖拽 / 高亮 / 阴影等渲染逻辑读 `node.position` 即可，跟着物理走

### 测试

物理引擎和单元测试不友好（非确定、需要 step 循环）。两层策略：

**1. 单元测试用"无物理模式"**

- 加配置项 `M01PhysicsMode = "physics" | "static"`
- 测试模式跑 `static`：跳过物理，用 v4 风格的硬编码堆叠位置（来自 algorithm "what physics would have produced"）
- 现有的 ~211 个测试基本不受影响

**2. 物理本身的回归用快照**

- 在确定性种子下跑一次完整 settle，记录每片最终位置/旋转 → 写入 fixture
- 新增 `M01Physics.test.ts`，固定种子，跑 settle，对比 fixture
- 如果引擎升级或物理参数变了，先看快照 diff 决定接受/拒绝

**确定性范围说明：** 同一个 Cocos 版本 + 同一组物理参数 + 同一个种子 → 结果可重现。**跨 Cocos 版本不保证确定**——box2d 内部算法可能微调，浮点累计误差也会让 fixture 失效。所以这是"per-build determinism"而非绝对确定。tests 应优先用 static 模式保证稳定，物理 snapshot 作为辅助。

### 性能

- 9 个 dynamic body + 3 个 static wall：box2d 在 60fps 下完全 over-provisioned
- settle 后大部分 body 进入 sleep 状态，不占 CPU
- 拖拽时只有少数 body active

## 改动点清单

| 文件 | 改动 |
|------|------|
| `assets/scripts/cocos/M01GreyboxBootstrap.ts` | 初始化时给 fragments 加物理组件，添加 boundary，启动初始堆生成 |
| `assets/scripts/cocos/M01PhysicsBoundary.ts` *(新)* | 地面 + 左右墙 collider |
| `assets/scripts/cocos/M01PhysicsPile.ts` *(新)* | 初始下落 + drop 协程 + settle 检测 |
| `assets/scripts/cocos/M01GreyboxDrag.ts` | touchStart/Move/End 改为切换 body.type |
| `assets/resources/configs/stage1/m01-memory-gear.json` | 添加 `physics: { mode: "physics", gravity: ..., seed: "session" }` 段（也允许测试覆盖为 static） |
| `tests/cocos/M01PhysicsPile.test.ts` *(新)* | 静态模式 fixture + 物理模式快照 |
| 现有测试 | 多数无改；如有依赖固定 fragment 坐标的，切到 static 模式 |

## 风险

1. **Cocos box2d 在 web/小游戏平台的稳定性** —— 需要在 H5 + 微信小游戏上各跑一次确认
2. **拖拽与物理的交互边界** —— Kinematic ↔ Dynamic 切换瞬间速度/旋转重置要干净，否则会有"甩飞"
3. **现有 evidence snap 逻辑假设 piece 位置可控** —— 吸附时要先 `body.enabled = false` 再移动，避免和物理冲突
4. **初始 settle 的视觉时长** —— 1.5 秒堆完，玩家会看到"掉下来"的动画。如果太慢需要加快重力或缩短间隔
5. **测试不稳定** —— 物理模式快照可能因 box2d 内部版本变化失效；保留 static 模式作为主测试路径

## 待 review 的问题（已全部决议）

1. ~~JSON 里的 `fragments[i].position` 历史值还要保留吗？~~ → **保留**，作为 static 测试模式的回退坐标（见"坐标系"段）
2. ~~初始 settle 期间，UI 是不是要锁住玩家输入？~~ → **是**。"碎片正在落下..."状态下拒绝拖拽，约 2.3-2.8 秒后解锁（见"初始堆生成"段）
3. ~~拼片被消耗后要不要保留 ghost 帧？~~ → **不消耗**。吸附 ≠ 消失；拼片停在 target 位置，仍可被玩家拿回去重试（见"吸附位上的状态"段）

## 后续

1. 用户审阅本设计
2. 通过 → 走 `superpowers:writing-plans` 出实现计划
3. 实现 → 测试 → 集成到 M01 主预览
