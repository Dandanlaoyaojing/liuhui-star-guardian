# M01 → Unity 迁移调整草案

> 首轮草案(2026-07-12)。基于对现有 M01 代码的引擎耦合度扫描,逐块归类"迁到 Unity 要怎么调"。待 Unity 装好、Phase 1 光效切片验证后细化。

## TL;DR — 一个好消息

M01 相关 **38 个脚本里 31 个是纯逻辑**(无 `cc` import):规则、状态机、布局/几何、吸附旋转判定、Verlet 绳数学、拼片显色、关卡生成、存档模型、交互判定——**全是引擎无关的算法**,C# 里 1:1 照搬(设计不变、vitest 测试同步搬成 EditMode 测试)。

**真正要对着 Unity 重做的引擎耦合只有 7 个文件**(Bootstrap / IntroSequence / LemmyActor / CutscenePlayer / PhysicsBoundary / PhysicsPile / SpriteAspect)。所以这不是"15k 行全是硬骨头",而是"大头是低风险转写 + 一小撮引擎重写"。

## ⚠️ 头号架构决定:世界空间 2D,不是 UI Canvas

M01 现在整个搭在 **Cocos UI 层**(到处 `UITransform`/Canvas)。**Unity 的 URP 2D 光照(`Light2D`)只照 world-space 的 `SpriteRenderer`,不照 UI Canvas 的 Image。** 换引擎的核心目的就是那套光——所以 **M01 必须在 Unity 里用世界空间 SpriteRenderer 重建,不能照着 UI Canvas 直译**,否则拿不到 2D 光照/Bloom,白换。这是最先要定死的结构差异。

## 迁移类别(5 桶)

| 桶 | 含义 | 风险 |
|---|---|---|
| **A 纯逻辑照搬** | 引擎无关算法 → C# 转写,测试同搬 | 低(设计不变,机械但稳) |
| **B 引擎 API 重写** | 建场景/精灵/输入/补间 → Unity API | 中高(要熟 Unity + 重验) |
| **C 物理重调** | Box2D → Unity 2D 物理,常量归零重调 | 中(手感靠调) |
| **D 渲染重做** | 代码画形/显色 → SpriteRenderer + URP 2D Light + Bloom + Shader Graph | 中(**迁移增益点**) |
| **E 删除简化** | Unity 原生覆盖,整块删 | 低(净减负) |

## M01 文件分类

| 文件 | 桶 | Unity 目标 / 备注 |
|---|---|---|
| M01GreyboxSession | A | 核心状态机,直接转写 |
| M01GreyboxLayout | A | 布局/坐标数学 |
| M01GreyboxDrag | A | 吸附旋转判定(容差/对称周期),纯逻辑 |
| M01GreyboxArt | A | 生成的颜色/几何**数据**;消费端改 D |
| M01GreyboxText | A | 文案数据 |
| M01TargetPatternGenerator | A | 关卡生成 |
| M01StandardPieceBlend | A | 拼片交叠显色证据 |
| M01CutsceneTiming | A | 过场计时(dt 驱动) |
| M01FlashlightBeam / …Observation | A | 光束几何 + 观察判定(**显色渲染**归 D) |
| M01PhysicsCollider / …Random / …Rotation | A | 碰撞/随机/旋转**数学**(刚体接线归 C) |
| M01RopePhysics | A | Verlet 绳数学,照搬(**接刚体/调参归 C**) |
| M01RepairSequence / ObservedResetScheduler | A | 时序 |
| M01PuzzleInputRouter | A | 路由逻辑(输入源换成 Input System) |
| M01IntroFlow / M01IntroLayout | A | 开场编排逻辑/布局(**播放归 B**) |
| M01ManualTargetPersistence | A | 逻辑纯;**IO 落地改 E**(PlayerPrefs) |
| M01MemoryGearController | A | 关卡编排 |
| core/*(GoalEvaluator/ProgressStore/PuzzleConfig/ToolCard 等) | A | 引擎无关内核;ProgressStore 的存储 IO 改 E |
| interaction/*(DragHandler/FilterSystem/SnapZone) | A | 通用交互判定,照搬 |
| ui/ToolCardView | A→B | 视图数据纯;实际渲染接 Unity UI |
| **M01GreyboxBootstrap**(3962) | **B** | 巨型场景编排器 → 拆成多个 MonoBehaviour + prefab;世界空间重搭 |
| **M01IntroSequence**(1343) | **B** | 开场 cinematic(节点/tween)→ DOTween/Timeline + SpriteRenderer |
| LemmyActor | B/D | 逐帧驱动 → Sprite atlas + Animator 或自写帧驱动(**保留归一化:脚底锚 + renderScale 曲线**) |
| M01SpriteAspect | B | 精灵尺寸 → Unity 导入设置 + SpriteRenderer(**保留 trim 逻辑**) |
| M01PhysicsBoundary | C | 边界 → Rigidbody2D/Collider2D |
| M01PhysicsPile | C | 顶篮碎片堆物理 → Unity 2D 物理,**kick/allowSleep 等常量重调** |
| M01CutscenePlayer + `completion-frames/` | **E** | **删**:Unity VideoPlayer 桌面原生直播母版 mp4 → FFmpeg 计划整个作废,344 帧资产可弃 |

## Cocos → Unity 概念映射(总表)

| Cocos | Unity | 备注 |
|---|---|---|
| Node + UITransform | GameObject + Transform(**世界空间**) | 见上:别用 UI Canvas 承载可发光元素 |
| Sprite / SpriteFrame | SpriteRenderer / Sprite | |
| Graphics(代码画形) | SpriteShape / Mesh / 生成纹理 / Shader Graph | 代码画的 glow/形状换策略 |
| `cc.tween` | DOTween(标配)/ Coroutine / Timeline | |
| Component + `@property` | MonoBehaviour + `[SerializeField]` | |
| `resources.load` / `loadDir` | Addressables(推荐)/ Resources.Load | |
| AudioSource(cc) | AudioSource(Unity) | 概念一致 |
| Box2D RigidBody2D/Collider | Rigidbody2D/Collider2D | 调参归零 |
| VideoPlayer(桌面不编译) | **VideoPlayer(桌面原生支持)** | 视频洞消失 |
| `.effect` 自定义材质 | Shader Graph / HLSL | |
| (无 2D 光照) | **URP 2D:Light2D + Bloom** | **核心增益** |
| localStorage(ProgressStore) | PlayerPrefs / File(JSON) | |
| EventTouch 输入 | Input System / EventSystem | |
| 逐帧动画(LemmyActor) | Sprite atlas + Animator / 自写帧驱动 | 保留脚底锚 + renderScale 归一化 |

## Phase 2 现在就能开(不依赖 Unity 装好)

把桶 A 的纯逻辑 + 对应 vitest 测试,按依赖序转写 C#(先搬测试当规格,红→绿):

1. `core/*`(内核:PuzzleConfig / ProgressStore / GoalEvaluator / ToolCard)—— 无依赖,先搬
2. `M01GreyboxSession` + `M01TargetPatternGenerator` + `M01StandardPieceBlend`(谜题核心)
3. `M01GreyboxDrag` + `interaction/*`(吸附旋转/拖拽判定)
4. `M01RopePhysics` + `M01Physics{Collider,Rotation,Random}`(物理数学)
5. `M01CutsceneTiming` / `M01RepairSequence` / 布局与文案

> 注:C# 转写仍是**逐行人工重写**(TS≠C#),但设计不变、有测试兜底,是低风险机械活;可与 Unity 安装/Phase 1 并行。

## 重头戏(点名,桶 B/C/D)

- **Bootstrap 3962 行**:不是照搬,是**拆解重建**——按职责拆成场景装配 / 交互 / 过场 / 手电 等多个 MonoBehaviour + prefab。最大工作量。
- **IntroSequence 1343 行**:开场 cinematic,DOTween/Timeline 重编排。
- **物理**:Pile/Boundary 接 Unity 2D 刚体,Verlet 绳数学照搬但**手感常量全部重调**(记忆里那些 kick 强度/allowSleep/子步都要重来)。
- **帧动画**:802 帧导入 Unity,重建 LemmyActor 的**脚底线锚定 + renderScale 逐帧曲线**归一化(否则又会忽大忽小)。
- **光效(桶 D,换引擎的理由)**:手电显色/齿轮 finale/水彩/星光 → URP 2D `Light2D` + Bloom + Shader Graph。**Phase 1 先在这里验证 go/no-go。**
- **视频(桶 E)**:直接删,VideoPlayer 播母版 mp4。

## 桶 B 细化:Bootstrap(3962 行)拆解

> 深读结论:它不是一团浆糊,是**九个职责簇挤在一个类里**(Cocos 期为省 prefab 图快堆的)。Unity 侧照簇拆成组件,每簇内聚、簇间用 C# event 接,拆完没有哪个组件超 ~600 行。

### 职责簇 → Unity 组件

| # | 簇(现 Bootstrap 行域) | 主要方法 | → Unity 组件 | 备注 |
|---|---|---|---|---|
| 1 | **装配根**(start 417-556, update, onDestroy) | 加载 config → 建 session/layout → 装配各系统 | `M01Level`(组合根,**保持薄**) | `resources.load`→Addressables;`Date.now` 种子→`System.DateTime`;各系统从这里注入 |
| 2 | **盘面渲染**(690-1400) | renderGreybox / addBottomLightNode / addShapeNode / applyTokenGraphicsState / addTokenArtSprite / renderStaticArtPreview / renderTargetOverlapEvidence | `PuzzleBoardView` + 每片一个 `FragmentView` prefab | Graphics 画形→SpriteRenderer+生成 Sprite/SpriteShape;底光→**Light2D 直接上**(迁移增益);世界空间! |
| 3 | **输入/拖拽**(1401-1685, 2095-2145) | bindGreybox/GlobalPointerInput / begin/move/endTokenDrag / rotate pins / eventToLocalPoint | `DragInputController` | EventTouch→**Input System**;`setCanvasCursor`→`Cursor.SetCursor`;拖拽判定逻辑本体在桶 A(DragHandler/M01GreyboxDrag)照搬 |
| 4 | **手电覆盖/显色**(1686-2093) | handleHeldFlashlightTap / syncFlashlightCoverage / computeBeamGeometry / redrawCoverageBeam / loadColorFilterShader / applyHeldFlashlightTint | `FlashlightRig` | **迁移的核心增益点**:光锥+光池→URP `Light2D`(spot/freeform)+Bloom,替掉整套代码生成 glow 贴图;fx_color-filter→Shader Graph;⚠️ 逐片 uniform 用 **MaterialPropertyBlock**(Cocos 共享材质 uniform 投递坑的正解) |
| 5 | **落子/吸附/验证**(2146-2512, 2888-3097) | handleTokenDrop / trackWeakSnapped / trySubmit* / tryValidateCompleteEvidenceCandidate / scheduleValidationLightReset / scheduleFailedCandidateReturn / park/releaseFragmentBody | `EvidenceValidator` | 判定逻辑在桶 A;这里只剩"调度+刚体停摆/复活"接线;`setTimeout`→coroutine/UniTask.Delay |
| 6 | **通关导演**(2513-2820) | beginRepairSequenceThenToolCard / playCelebrationThenCompletionVideo / completion overlay/watchdog/teardown | `CompletionDirector` | **净缩水**:双路径(VideoPlayer/帧序列)塌缩成单路径 Unity VideoPlayer 播母版 mp4;保留 skip+看门狗+幂等收尾;帧序列/loadDir/releaseAsset 全删 |
| 7 | **提示按钮**(648-660, 1022-1120) | requestHint / addHintButton / addHintGlow / playHintFlash | `HintButton` | tween 回弹→DOTween;辉光→Light2D 或 additive sprite |
| 8 | **ToolCard 渲染**(1121-1235) | renderToolCardPreview / renderToolCardArtFrame / addCardLabel | `ToolCardView`(UI Canvas 可以,不需要光) | 数据侧已具名字段化,直译 |
| 9 | **manualTarget 调试工具**(770-956, 3216-3360) | ~15 个 manualTarget* 方法 + localStorage 草稿 | **v1 不迁**(调试用) | 真需要时做成 Editor Window;localStorage→PlayerPrefs |

### 跨簇的 Unity 关键替换

- **销毁安全**:Cocos 期靠手工 `destroyed` 标志 + 各处守卫(onDestroy 清 8 类 timer/tween/监听)。Unity 直接用 **`destroyCancellationToken`**(2022.2+ 内建)贯穿所有 async/延时,整类问题系统性消掉——比逐处守卫强。
- **`setTimeout` 家族**(验证复位/失败回位/看门狗/沉降):统一 UniTask.Delay(或 coroutine)+ 上面的 token。
- **物理停摆/复活**(parkFragmentBodyAtSnap 等):Cocos"预挂 active 节点注册 body"的怪要求 Unity 没有;`bodyType Static↔Dynamic` + `simulated` 直接映射。

## 桶 B 细化:IntroSequence(1343 行)拆解

> 深读结论:它是**开场小剧场的导演**,八个簇。纯逻辑(M01IntroFlow 状态机 / nextWalkBoost / RopePhysics 数学)已在桶 A;这里剩的是演出编排 + 节点搭建。

| # | 簇 | 主要方法 | → Unity | 备注 |
|---|---|---|---|---|
| 1 | 事件状态机 | advance / phase | 桶 A(M01IntroFlow 照搬) | |
| 2 | 莱米走位 | roamLemmyTo / boostedWalkMs / alignEarToPosition / playIdleback | `LemmyController`(包桶 A 的 LemmyActor 帧驱动) | tween 走位→DOTween;**收耳位置驱动判定**(isXUnderBasket 按实际落点)原样保留——那是修过的坑,别回退成目标驱动 |
| 3 | 吊篮 rig | spawnBasket/Rope/FixedNail/InnerCavity/FrontOccluder / drawRope | `BasketRig` prefab | **钉子仍须独立节点**(不画进篮 PNG,老坑);绳渲染 Graphics→LineRenderer(Verlet 数学桶 A 照搬);前挡片/内腔用 sorting layer 表达 |
| 4 | 拼片入篮/冻结/释放 | stageFragmentsInBasket / freeze / releaseFragmentsFromBasket | `BasketRig` | Static 冻结→bodyType 切换,直译 |
| 5 | 顶篮演出 | walkToBasketAndHeadbutt / beginRepeatHeadbutt / playHeadbuttStrike / commitHeadbuttSpill / basketJolt / applyHeadbuttImpulse | `IntroDirector` | async 链全挂 destroyCancellationToken;冲量常量进桶 C 重调清单 |
| 6 | 手电掉落/拾取 | spawnIntroFlashlight / beginFlashlightDrop / releaseFlashlightToPhysics / beginPickup | `IntroDirector` | 落点物理 + settle timer 直译;拾起回调交接 FlashlightRig |
| 7 | 够不着 beat | beginBasketReachMiss | `IntroDirector` | reachmiss 帧动画,LemmyActor 驱动 |
| 8 | 庆祝 | playCelebrationThenIdle | `LemmyController` | CompletionDirector 调它 |

### async 编排的坑位声明

IntroSequence 是 async/await 重灾区(走位/顶篮/拾取全是可打断的 await 链)。Cocos 期的血泪教训**必须带着走**:
- **可被打断的 await 之后不写关键状态**(收耳标志那次的根因)——位置驱动判定,不用"到达即置位"。
- 连点/打断:walkBoost 连点加速、pickupInProgress/headbuttInProgress 重入闩,直译保留。
- Unity 侧统一 `destroyCancellationToken`,销毁即取消整条链,替代手工 `destroyed` 守卫。

## 桶 B 移植顺序(依赖序,每步可玩可验)

1. **`M01Level` + `PuzzleBoardView` + `FragmentView`**:配置加载 + 盘面静态渲染(桶 A 的 layout/session 已就位)→ 能"看到关卡"
2. **`DragInputController` + `EvidenceValidator`**:拖/转/吸/验证 → 能"玩核心谜题"(先用调试开关跳过 intro,等价 `debugPlayCompletionOnStart` 思路)
3. **`FlashlightRig`**:Light2D 光锥 + Shader Graph 显色 → 核心机制完整(与 Phase 1 光效切片直接衔接)
4. **`CompletionDirector` + `ToolCardView` + `HintButton`**:VideoPlayer 过场 + 出卡 → 通关闭环
5. **`IntroDirector` + `BasketRig` + `LemmyController`**:开场小剧场**最后搬**(演出最重、依赖物理手感,且没有它核心玩法已可验收)

## 桶 C 细化:物理常量清单 + 单位映射策略

> **修正此前"调参归零重来"的估计**:深挖后发现大部分常量可以**换算迁移**,不用盲调。关键是把单位映射定对。

### 关键洞见:定死 PPU = 32,常量按规则换算

两家底层都是 Box2D。Cocos 内部按 **32 px = 1 米** 把像素喂给 Box2D;Unity 用 PPU(Pixels Per Unit)+ 1 unit = 1 米。**只要 Unity 侧精灵导入统一 PPU=32,两边 Box2D 看到的就是同一套米制世界**,常量按下表机械换算,动力学行为应接近原样——桶 C 从"归零重调"降级为"换算 + 验证微调":

| 常量类型 | 换算规则 |
|---|---|
| 速度/冲量(px/s) | ÷32 → units/s |
| 重力(px/s²) | ÷32 → m/s²(Cocos `-640` → Unity `Physics2D.gravity=(0,-20)`) |
| friction / restitution / density | **无量纲,原值照抄** |
| linearDamping / angularDamping | 每秒衰减率,**原值照抄** |
| 角速度(deg/s) | 原值照抄(Unity Rigidbody2D.angularVelocity 也是 deg/s) |
| 固定步长 | Unity Fixed Timestep 默认 0.02(50Hz)→ **改 1/60** 对齐 Cocos |

⚠️ 仍要人肉验证:两家 Box2D fork 版本/接触容差/睡眠阈值有差,换算完 = 起点接近,不是免验。

### Box2D 侧旋钮全清单(换算迁移)

| 常量 | 现值 | 语义 | 迁移 |
|---|---|---|---|
| `PhysicsSystem2D.gravity` | -640 px/s² | 世界重力(2026-06-19 调低配 kick 520) | → -20 m/s² |
| `M01_PHYSICS_FRAGMENT_RESTITUTION` | 0.08 | 拼片弹性(几乎不弹) | 照抄 |
| `M01_PHYSICS_CIRCLE_FRICTION` | 0.18 | 圆片摩擦(会滚) | 照抄 |
| `M01_PHYSICS_POLYGON_FRICTION` | 0.6 | 多边形摩擦(堆得住) | 照抄 |
| `M01_PHYSICS_LINEAR_DAMPING` | 0.05 | 线性阻尼 | 照抄 |
| `M01_PHYSICS_ANGULAR_DAMPING` | 0.55 | 角阻尼(压翻滚) | 照抄 |
| `M01_PHYSICS_GROUND_FRICTION` | 0.82 | 地面摩擦(落地即停) | 照抄 |
| `M01_PHYSICS_WALL_FRICTION` | 0.25 | 墙摩擦 | 照抄 |
| 拼片 `density` | 1 | 密度 | 照抄 |
| `allowSleep` | **false(下落期)** | ⚠️ 带语义:堆叠 island 睡眠会假沉降;但**常驻体必须 true**(老坑:false 会钉醒邻居) | 语义照搬,Unity=`Rigidbody2D.sleepMode` |
| `WALL_THICKNESS` | 40 px | 防隧穿墙厚(-640 重力 0.5s ≈800px/s 推算) | ÷32;或直接给拼片开 Continuous 碰撞检测(Unity 现成)更稳 |
| `jitterX` | 22 px | 落点横向抖动 | ÷32 |
| `settleTimeoutMs` | 3600 | 沉降兜底超时 | 照抄 |
| `BASKET_HEADBUTT_IMPULSE_VY / VX_SPREAD / VY_JITTER` | 20 / 10 / 5 px/s | 顶出拼片的初速三件套(弧线/开花/层次) | ÷32 |
| `BASKET_HEADBUTT_IMPULSE_SPIN` | 22 deg/s | 顶出翻滚 | 照抄 |
| `HEADBUTT_PIECES_PER_HIT` | 3 | 每顶出片数(玩法,非物理) | 照抄 |
| `FLASHLIGHT_SETTLE_MS` / `BASKET_PILE_SETTLE_MS` | 1100 / 900 | 手电/篮堆落定判定窗 | 照抄 |

### Verlet 绳(引擎无关,**零重调**)

`M01RopePhysics` 是自写数学、不过 Box2D,**整套照搬零换算**(它自己的 px 世界,渲染时再映射):
`ROPE_POINTS=12` / `gravity=-1100` / `damping=0.995`(每子步) / `iterations=24` / `substepDt=1/120`(固定子步+余数累加,不可变 dt) / `ROPE_TAIL_INV_MASS=0.05`(篮≈20×绳点质量) / `kickTail(lateral, BASKET_KICK_STRENGTH)`。
唯一注意:`update` 里 `Math.min(deltaSeconds, 1/30)` 的钳制一并带走。

### 混合区(绳↔Box2D 交接,重点人肉验证)

顶篮链条 = `kickTail`(Verlet)+ `basketJolt` + `applyHeadbuttImpulse`(Box2D)三者协奏:
`BASKET_KICK_STRENGTH=520 px/s`(绳侧,照搬)+ `BASKET_KICK_LATERAL_PER_PX=3` / `LATERAL_MAX=220`(绳侧,照搬)× Box2D 侧冲量(÷32)。**绳零换算、拼片换了单位,两边节奏是否还合拍——这是桶 C 唯一真正要盯着调的手感点。**

### 非物理的演出配速(照抄,列全备查)

`WALK_TO_BASKET_DURATION=7.2s` / `WALK_BOOST_WINDOW_MS=650` / `WALK_BOOST_STEP=0.7` / `WALK_BOOST_MAX=3×` / `LEMMY_HEADBUTT_UNDER_TOLERANCE=80px` / `LEMMY_EAR_FOLD_HALF_WIDTH=140px` / 场景坐标族(`GROUND_Y=-270`、`BASKET_X=300` 及其全部派生量)——纯数值,搬进 Unity 时统一除以 PPU 进世界坐标,相对关系不变。

## 桶 D 细化:渲染/光效重做点位清单

> 原则:凡是 Cocos 期"代码生成纹理 + 普通混合 sprite"凑合出来的光,Unity 侧一律升级成 **URP 2D Light2D / Shader Graph**——这正是换引擎买的东西。凡是纯形状绘制,选最省的对应物,不借机加戏。

| 现状点位 | 现实现(Cocos) | → Unity | 备注 |
|---|---|---|---|
| **手电光锥+光池**(`getRadialGlowSpriteFrame`/`getConeSpriteFrame`+`addGlowSprite`) | 代码生成径向/锥形渐变贴图,普通混合,`packable=false` 防图集洪水 | **`Light2D`(spot/freeform)+ Bloom** | 整套运行时纹理生成删掉;`packable` 坑在 Unity 无对应物,消失 |
| **拼片逐像素显色**(`fx_color-filter.effect` + 共享材质) | 手写 effect;曾因 a_position 世界坐标/共享 uniform 坑回退整片染色 | **Shader Graph**(Sprite Unlit + 世界坐标节点 + 束内 mask);逐片参数走 `MaterialPropertyBlock` | Shader Graph 编辑器内实时预览——Cocos"shader headless 验不了"的痛点消失 |
| **底光验证条**(`drawBottomLight` Graphics) | Graphics 画矩形渐变 | `Light2D` freeform 或 SpriteRenderer+发光材质 | 亮起瞬间可加 Bloom 脉冲(增益,但克制) |
| **提示灯泡辉光**(`addHintGlow`+`playHintFlash`) | 径向渐变 sprite + tween alpha | `Light2D` point + DOTween 强度 | |
| **绳渲染**(`drawRope` Graphics + 贴图条带精灵) | 麻花绳贴图竖切 11 条沿链铺 + Graphics 兜底 | **LineRenderer**(绳贴图作 material,沿 Verlet 链设点) | 数学层零改;条带切法可弃,LineRenderer 原生纹理沿线 |
| **地面线**(`M01PhysicsBoundary.renderGroundLine`) | Graphics + 贴图 | SpriteRenderer(现成地线 PNG) | 纯直译 |
| **盘面形状/槽位/证据**(`addShapeNode`/`applyTokenGraphicsState` Graphics) | Graphics 画多边形/描边 | 预烤 Sprite(形状有限且固定)或 SpriteShape | **别用运行时 Mesh 加戏**,预烤最省 |
| **M02 星/光晕/连线**(StarWebView/PrologueView Graphics,revision 跳帧优化) | Graphics 每帧重建(有 revision 门) | SpriteRenderer + **`Light2D`**(星光晕)+ LineRenderer(连线) | M2 是光效主战场,Phase 1 切片直接在这里做;revision 优化思路保留(光强/位置变才写) |
| **水彩漩涡/星光路径**(通关过场素材) | 已烤进 mp4 | 不迁(VideoPlayer 播) | — |

**两个 Cocos 顽疾在 Unity 侧的命运**:①"两片半透明叠加必有亮度缝"→ Light2D/additive 天然叠加,消失;②"运行时数据纹理进动态图集洪水崩"→ 无动态图集打包机制,消失。

## 细化收口判断

桶 A(31 文件转写顺序)/桶 B(9+8 簇拆解+移植顺序)/桶 C(旋钮全清单+PPU=32 换算律)/桶 D(光效点位全清单)——**四桶已全部细化到"可直接开工"粒度。开始 Unity 重写。**

执行方式(此环境无 Unity 编辑器,扬长避短):
1. **现在**:桶 A 纯逻辑 → 引擎无关 C#(不 `using UnityEngine`)+ xUnit 测试,本机 `dotnet test` 红→绿——测试即从 vitest 逐个翻译,规格不变。
2. **Unity 装好后**:这批 C# 文件原样进 `Assets/Scripts/Core`(补 asmdef),桶 B/C/D 在编辑器内做。

## 风险

- 已修的一长串 Cocos 期玩法 bug(吸附旋转语义 / 拾片门控 / 旋转账本 / 物理重座…)会以**等价形式在 C# 重现**,需重 debug——桶 A 有测试兜底能挡一部分,桶 B/C 的交互/物理靠人肉。
- **世界空间 vs UI Canvas** 若一开始定错,后面拿不到 2D 光照,返工代价大——**Phase 0 建工程时就锁定世界空间 2D URP**。
