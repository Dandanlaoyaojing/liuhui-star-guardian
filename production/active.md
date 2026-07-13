# Active Work State

Last updated: 2026-07-12

> 这是**当前状态薄层**(CLAUDE.md 要求)。已完成的历史流水归档在 `production/archive/`,细节查那里或 `git log`。

## 当前活跃线:迁移到 Unity 引擎(2026-07-12 决策)

用户拍板**从 Cocos Creator 3.8 迁到 Unity**。驱动=**光效工具天花板**(要 URP 2D 光照+Bloom)+ 站主流引擎后续省心。完整执行计划见 `docs/design/unity-migration-plan.md`。

- **诚实留痕**:①"复杂物理"不是有效理由(两家 2D 物理都是 Box2D,Verlet 绳手写引擎无关);②迁移前那次 Cocos glow demo 没渲染是无头预览 RAF 暂停坑,非 Cocos 能力证据。用户知情后仍以"光效+主流引擎"为由决定迁移。
- **备份(退路焊死)**:origin tag `cocos-engine-final-2026-07-12` + 分支 `archive/cocos-engine`(=`e725ae4`)。
- **量级**:15,112 行生产 TS + 9,494 行测试 → C# 全重写;物理重调;工具链重搭;老 bug 重验。多月多会话。美术/音视频 802 文件 + 设计文档可复用。
- **目标环境**:Unity **6.3 LTS `6000.3.19f1`**(锁定,别跳版本)+ **2D URP**(URP 才有 2D 光照+Bloom,别选内置管线);iOS(IL2CPP)+ Steam(Win/Mac Standalone)。**桌面视频洞在 Unity 自动消失**(VideoPlayer 原生支持桌面)。
- **迁移顺序**:先验 payoff 再搬大头——Phase 1 先用 URP 2D Light+Bloom 重建 M2 一个光效当 **go/no-go 闸门**,人肉确认光质到位再搬 24k 行逻辑。
- **立即卡点**:本机**未装 Unity**。Phase 0 = 用户装 Unity Hub + 6 LTS + 建 2D URP 工程(需 Unity 账号+许可,我不静默替装)。装好即开 Phase 1 光效切片。

### 进度(2026-07-12)
- **工具链**:dotnet SDK 10.0.301 ✅ 装好;Unity Hub ✅ 装进 /Applications(编辑器待用户登录后装 6 LTS + 2D URP)。
- **C# 测试管线**:`unity-tests/Core.Tests`(xUnit,net10.0)直接 glob 编译 `unity/Assets/Scripts/{Core,Interaction}/**/*.cs`(单一真源,不 using UnityEngine)。
- **桶 A 转写 wave 1 ✅**:6 单元 opus 并行转写(Workflow)—— GoalEvaluator(+PuzzleConfigTypes 最小集)/ProgressStore/M01CutsceneTiming/DragHandler/FilterSystem/SnapZone。`dotnet test` **36/36 绿**(基线 16 → +20)。
- **fable 对抗审查 ✅ 已消费**:6 单元审语义保真。逮到 2 处真缺陷(测试没覆盖的分支,正是 green≠correct):
  1. **ProgressStore bug** — 单条超 long 范围时间戳 `(long)` 强转抛 OverflowException 被 catch-all 吞成**整档清空**(TS 是逐条打捞)。修:`TryGetLongMs` 只认在范围内的整数 token、永不抛,浮点也跳过(顺带消 float 静默舍入 risk)。
  2. **DragHandler risk** — PointerId 装箱后 int 7≠long 7≠7.0,拖拽跨数值类型静默卡死(TS 单一 number 恒相等)。修:SamePointer 数值归一到 double 比较(NaN 自动复刻 TS !==);附带修错挂到 Point2 的 XML 注释。
  - 补 5 个 C# 转写专属回归桩钉死;`dotnet test` **41/41 绿**。
  - 其余 nit 全部 defer 有据:GoalEvaluator/FilterSystem/M01CutsceneTiming/SnapZone 的偏离都是 JSON 类型外输入(C# 反而更安全)或未覆盖分支的测试硬化,非 bug。
- **⚠️ 待办(Unity 阶段)**:ProgressStore 默认存储恒 null → Unity 里无参 CreateProgressStore 不持久;做存储层时补 **PlayerPrefs 适配 IKeyValueStorage** 作默认 + 恢复 storage 三态(显式 null=内存)。
- **角色分工(用户定)**:fable 出计划 → opus 执行转写 → fable 审阅。审查已按全局 CLAUDE.md 要求消费到底(修/defer 逐条明确)。

- **桶 A wave 2 ✅ 转写完**:①**PuzzleConfig**(收编 wave1 最小 `PuzzleConfigTypes.cs` 并删之 + 定义 `ValidationResult<T>`)。②**StarWebConfig**(因后台 agent 屡被网络/重启掐死, 改**主会话 inline 手写**: 数据模型 + JToken 校验器逐字保 TS 文案 + `ToObject` 建强类型 + mechanic 隐式转 StarNetworkRules + 24 测试含配置×模型集成/位掩码配额下界)。**`dotnet test` 69/69 绿**(45→+24)。③**fable 审已消费**(它实编真 C#+node strip-types 跑真 TS 双侧实证)。**StarWebConfig(我 inline 写)faithful=false, 5 处系统性边界 bug 全修 + 补 5 钉死桩**: (a)`ToObject<ToolCardDraft>` 先转型把 stage=2.5→2/"1"→1/123→"123" 洗成合法放行烂数据→改对原始 JToken 跑严格校验; (b)RequireOptionalString 多排 Null → `description:null` 该拒→删该分支; (c)ValidatePrologue 多吞 null → `prologue:null` 该拒→只跳 undefined; (d)IsPositiveInteger 只认 Integer 拒整值浮点 1.0 → 改 Math.Floor 判整(Number.isInteger 等价); (e)多处裸 (long)/(string) 强转在对象/超大整数上抛→TryGetFiniteNumber+ToObject try/catch, 校验器永不抛。PuzzleConfig faithful=true, 加 ToObject 防抛; **GoalDef.Params 有损投影 defer 到 goal 类型波次**(real m01 overlap goal 只读 Type 不受影响)。**`dotnet test` 74/74 绿**。

**下一步**:StarWebConfig 落地 → dotnet test 验 → 派 fable 审 PuzzleConfig+StarWebConfig → 消费。再往后桶 A 剩余(M01/M02 session、物理数学 Rope/Rotation、layout、TargetPatternGenerator/StandardPieceBlend、IntroFlow)。桶 B/C/D 等 Unity(6000.3.19f1, 用户装中)。

**⚠️ 环境教训(session 重启清后台任务)**:本机网络 ECONNRESET 频发, 多 agent 长 workflow 易中途挂(且 verify 返 null 会连锁崩脚本)。稳妥法 = 转写/审用 subagent(写文件即使掉线也存活), **verify 一律主会话 `dotnet test`**(本地不吃 API 抖动);workflow 脚本务必守 null 返回;后台 shell PATH 被剥, 脚本头 `export PATH`;下载用续传 curl 循环。Unity 编辑器直链: changeset `7689f4515d75`, `download.unity3d.com/download_unity/<cs>/MacEditorInstallerArm64/Unity-6000.3.19f1.pkg`(+iOS/Mac IL2CPP TargetInstaller)。

### Unity 工程 + MCP(Phase 0→1, 2026-07-12)
- **编辑器已装**: `/Applications/Unity/Unity-6000.3.19f1/Unity.app`(pkg 装法, root 所有), 含 iOSSupport + MacStandaloneSupport 模块。
- **StarGuardian 2D URP 工程已建**: `<worktree>/StarGuardian/`。**不是让用户 GUI 建的, 我直接解压编辑器自带模板** `com.unity.template.2d-cross-platform-2d-6.1.2.tgz` 的 `ProjectData~` 而成(=Hub 干的事)。含 URP 17.0.3 + `Assets/Settings/{UniversalRP,Renderer2D}.asset`(2D 渲染器就位, Light2D 可用, Bloom 只差开后处理)。已加 Unity `.gitignore`。
- **Unity MCP 选 CoplayDev/unity-mcp**(vet 干净: 12.4k★/MIT/活跃 v10/无 phone-home/无 key/标准编辑器权限)。已把包 `com.coplaydev.unity-mcp`(git URL `?path=/MCPForUnity#main`)写进 `StarGuardian/Packages/manifest.json`。Python 服务走 `uvx mcpforunityserver`(uv 0.10.5 已装; 系统 py3.9 不碍事, uv 自带 py3.10+)。
- **待用户 + 重启**: ①用户在 Unity 打开 StarGuardian(首开导入 MCP 包 + 起编辑器桥)→ ②Window → MCP for Unity → Configure(选 Claude Code, 它自动写 MCP 配置)→ ③**重启 Claude Code** MCP 才连上。连上后我用 MCP 直接驱动编辑器搭 **Phase 1 M2 光效切片**(Light2D+Bloom+呼吸)→ 用户肉眼验 go/no-go。
- 注意: git-url 包首开要 Unity 联网 git fetch, 本机网络 ECONNRESET 频发可能失败 → 失败就改本地 clone + `file:` 引用。
- **MCP 连上了**(CoplayDev, `mcp__UnityMCP__*`);工程首开 git fetch 成功, 0 编译错。

### Phase 1 光效切片 ✅(2026-07-12, 全程 MCP 驱动编辑器)
- 场景 `Assets/Scenes/M2GlowProbe.unity` + 脚本 `Assets/GlowProbe/M2GlowProbe.cs`([ExecuteAlways] 程序化搭 M2 星网:3 节点 + 2 光带 + 呼吸)+ 加法 shader `Assets/GlowProbe/GlowAdditive.shader`(URP HLSL, Blend One One, `_Intensity` HDR)。
- 技法 = **分层加辉(additive)+ Light2D + URP Bloom(Volume)+ 呼吸律动**, 低饱和青/琥珀(Arrog 风)。**这套正是全量 M2 会用的**。
- 迭代 4 轮(截图自查): ①alpha 混合太闷 → ②加法混合(但低 alpha 仍暗)→ ③shader `_Intensity` HDR 让光晕过 Bloom 阈值 → ④光带 blob 加密(46 步)连成连续光带。结果: 发亮星节点 + 平滑呼吸光带 + 暗底, 意境到位。
- **待用户 go/no-go 审美判断**(截图已给)。过 → 正式迁移(把 74 测试的 C# 搬进工程 + 按桶 B 拆解重建 M01/M02);不过 → 调参或重议。
- **关键收获: MCP 能让我截图自查 + 迭代**, 不再"盲写引擎代码"——URP API 一遍编译过, 光效可视迭代。这改变了桶 B/D 的可行性(之前担心盲写 Light2D/Bloom 崩)。
- **2026-07-12 用户 GO**: "光效比 cocos 强太多", 拍板正式全量迁移, 光效留着后面微调, **先做 M01**。光效切片保留在 `Assets/GlowProbe/` 作全量 M2 的技法样板。

### 地基整合 ✅(2026-07-12): 纯逻辑 C# 进真工程 + Unity 编译通过
- 10 个已转写 C#(Core+Interaction, 74 测试)从暂存 `unity/Assets/Scripts` **搬进 `StarGuardian/Assets/Scripts`**;`unity-tests/Core.Tests` csproj glob 重指到 StarGuardian;**dotnet 仍 74 绿**。旧 `unity/` 暂存已空。
- manifest 加 `com.unity.nuget.newtonsoft-json 3.2.1`(纯逻辑用它);Unity 已把 manifest 重排/升级(URP→17.3, 含 `com.unity.modules.video` → 通关过场以后可用 VideoPlayer)。
- **Unity C#9/netstandard 兼容坑当场修**(console 在环提前暴露, 见记忆): ①`record struct`(C#10)→ 手写 `readonly struct`+值相等; ②`init` → 加 `Assets/Scripts/IsExternalInit.cs` polyfill(放 Scripts/ 根避开 dotnet net10 的 glob 不冲突)。Unity 侧 0 编译错。
- **后续转写必守 C#9**: 不用 record struct / 文件级 namespace / global using;record 类、init(有 polyfill)、模式匹配 OK。

### M01 全量重建路线(桶 B 顺序, 见 unity-migration-m01-adjustments.md)
1. 纯逻辑补齐(桶 A 剩余): M01GreyboxSession/Layout/TargetPatternGenerator/StandardPieceBlend → 物理数学 Rope/Rotation/Collider/Random → RepairSequence/PuzzleInputRouter/IntroFlow/IntroLayout/ManualTargetPersistence/ObservedResetScheduler/FlashlightBeam/Observation/MemoryGearController(逐波 transcribe+dotnet 验+fable 审, C#9 兼容)
2. M01Level + PuzzleBoardView + FragmentView(config→静态盘面)→ "看到关卡"(MCP 驱动 + 截图自验)
3. DragInputController + EvidenceValidator → "玩核心谜题"(调试开关跳过 intro)
4. FlashlightRig(Light2D + Shader Graph 显色, 接 Phase 1 光效)
5. CompletionDirector(VideoPlayer 播母版 mp4)+ ToolCardView + HintButton → 通关闭环
6. IntroDirector + BasketRig + LemmyController(开场小剧场, 最后搬)

### M01 纯逻辑 wave-1 ✅(2026-07-12): 11 无依赖叶子
StandardPieceBlend / RepairSequence / PuzzleInputRouter / IntroFlow / IntroLayout / ObservedResetScheduler / FlashlightBeam / FlashlightObservation / PhysicsRotation / PhysicsRandom / RopePhysics → `StarGuardian/Assets/Scripts/M01/`。**dotnet 134 绿(74→+60)+ Unity C#9 编译干净。** fable 审 11 个已消费:9 faithful(只 nit), **2 修真 bug**:
- **ObservedResetScheduler**: `new Timer(cb,0,..)` 竞态(回调可能在 timer 字段赋值前触发→NRE)→ 先建不启动再 `Change` 启动; 负 delayMs(`-1`=Timeout.Infinite 静默永不触发/其他负值抛)→ `Math.Max(0,delayMs)` 复刻 JS 钳 0。线程安全 risk 记为文档假设(Unity 注入主线程引擎计时器, 不走默认多线程路径)。
- **M01IntroLayout**: 负索引 `arr[i%len]` C# List 抛 vs TS undefined→非circle → 加 `ShapeAt`(i≥0 取模包裹, i<0 返 null)精确复刻(正模会错误 wrap, 不采纳 reviewer 那条)。
- **defer 的 nit(记约定)**: ①手写值 struct 的 `Equals` 用 `==` 比 double → NaN 不自反, 应改 `.Equals()`(潜伏面, 坐标无 NaN); ②record 类含 `IReadOnlyList` 字段的合成 `==` 是引用相等(别用 `==` 比这类 record); ③EmptyParams 静态共享 vs TS 每段 fresh {}; ④测试里数值 params 装箱 int(真 JSON 出 double)。均不在可达路径。
### M01 纯逻辑 wave-2 ✅(2026-07-12): 配置类型 + 层1
M01MemoryGearConfig(+ Controller 纯函数 M01MemoryGearColors)/ M01GreyboxText / M01PhysicsCollider / M01TargetPatternGenerator / M01ManualTargetPersistence / M01GreyboxLayout → `StarGuardian/Assets/Scripts/M01/`。**dotnet 155 绿(134→+21)+ Unity C#9 编译干净。** 越界: 为 `M01MemoryGearConfig extends PuzzleConfig` 把 Core/PuzzleConfig 从 sealed 解封(grep 确认无依赖 sealed, 语义不变)。复用 Core.Vec2Def/ToolCardDraft。
fable 审 5 单元消费: **修 1 真 bug** — `JToken.Parse` 默认 DateParseHandling 把日期样字符串静默转 Date→"是字符串"判定失败丢记录(ProgressStore + ManualTargetPersistence 两站点)→ 新增 `Core/JsonUtil.ParseStrict`(DateParseHandling.None)统一。其余对真实数据全 latent(fragmentId 非日期/坐标有限/config 字段齐), 记为 **⚠️ 建 M01 引擎层时消费的 to-do**:
1. **TargetPatternGenerator 只转了 3 条 vitest 的 1 条**(跳测理由"Layout 不存在"已过时)→ 补转第 3 条(钉 locked=true 从当前 pieces 派生、不用 stale config.evidence 的核心语义)。
2. **GreyboxLayout**: ①HiddenColor 回退链 `hiddenColor ?? color ?? "hidden"` 被删(real config 都有 hiddenColor 故 latent)→ HiddenColor 改可空 + 复原回退; ②BuildTargetSlots `fragmentIds[0/1]` 无守卫, <2 元素崩 → 加 Count 守卫(TS 产 "undefined" 键); ③FindEntityPosition 分不清"无 position"vs"(0,0)"。
3. **M01MemoryGearColors** 头注称"xUnit 钉死"但无 C# 测试 → 补 7 条颜色函数 [Fact](或改注释)。
4. **TargetPatternGenerator ResolveConfigWithCurrentTargetEvidence** 手写逐字段拷贝无守卫 → 加反射守护测试(新增 config 字段漏拷会炸红)。
5. **GoalDef.Params** 仍 AllSortedGoalParams(丢 overlap goal 键)→ GoalEvaluator 长出 overlap 支持时读 M01MemoryGearConfig.Goal(单数)。
6. **M01 config 载入边界校验器**(正式化波次 · 与 `PuzzleConfig.Validate<T>` 物化 + EvidenceValidator 同期设计)—— 三方审(code-review / codex / zcode, 2026-07-13)一致结论: **边界拦畸形数据是正解**, 一次性消化本清单潜伏风险(内部 falsy/越界差异随之不可达), 别散修内部。**必拒**(对齐 TS 运行时 falsy 守卫会拦的): ① `flashlight.color` 空串 → 否则漏过 `M01GreyboxSession.cs:446/939` 的 `== null`(比 TS `if(!color)` 窄)→ `BlendPigmentColors` 抛 ArgumentException; ② `evidence.fragmentIds` < 2 → 否则 `M01GreyboxLayout.cs:747` 的 `[0]/[1]` 越界(同文件 `:551` 已守, 消歧); (重复 node id 已由 `StarWebConfig.ValidateLayout:411` 拦, 不重复)。**别误改**: hiddenColor 回退**非** falsy bug —— TS 用 `??`(nullish)≠ `||`(falsy), C# `HiddenColor=""` 与之等价, `Layout:432-434` 注释正确, 拿它当 falsy 改反而错; StarNetworkModel `L46/56` 的 `ToDictionary` 重复键参考正解 = `GoalEvaluator:83-88`(last-wins 索引器 + 注释), 但它收 `BoardGraph`、上游 ValidateLayout 已拦 → **仅当**出现绕过 ValidateLayout 直建 BoardGraph 的路径(运行时改图/测试直造)才在 BoardGraph 构造去重, 否则不动。**报错文案**正式化时逐条对齐 TS。附带: JToken 宽松解析(NaN/Infinity/尾随)同属边界, 一并挡。
**Unity 导入教训**: 新增 .cs 要 `refresh scope=all`(assets 导入生成 .meta)才被 Unity 看到; scope=scripts 只重编已导入的、看不到新文件(dotnet 直接 glob 不受影响)。

### M01 纯逻辑收尾波 ✅ 转写(2026-07-12): Session + Drag + Controller 状态机
M01GreyboxSession(29 测试)+ M01GreyboxDrag(14 测试, 吸附旋转真理值表)+ **agent 合理扩权把有状态 M01MemoryGearController 状态机一并转了**(Session 硬前置; 自造 M01OrderedMap 复刻 JS Map 插入序语义)+ fixture M01LegacySortConfig。**dotnet 198/198 绿(155→+43)+ Unity C#9 编译干净。M01 纯逻辑 100% 搬完。**
- fable 审消费: **Drag ✅ faithful**(reviewer 用 console harness 实测 22/22; 唯一 risk=根目录 `tests/m01SnapRotation.test.ts` 那套血战语义没迁 C#)→ **已消费: 补迁 M01SnapRotationTests.cs(10 Fact), dotnet 208/208 绿**。**Session+Controller 审 ✅ faithful 零 bug**(reviewer 双侧差分探针 E1-E10 实测; M01OrderedMap 实证复刻 JS Map: 同键覆盖保原位/删除后迭代序/迭代中删除)。3 risk 全在**畸形 config 才可达**角落(hiddenColor 缺失→C# 抛 vs TS 优雅拒/空串穿透 null 判断/validationLightSeconds 缺席→TS NaN 永闪 vs C# 0 即灭), 正式 config+夹具不可达 → 归并进已有 to-do #6(M01 config 载入校验器, 挡畸形 config 是正解)。nit 记档(unlockedAt long 截断/空串 falsy 家族/异常类型映射已声明)。**真消费 = 覆盖债: controller 直测 23 条零转写**(OrderedMap 迭代删除序/ProgressStore 布线/GetToolCardUnlock 零钉子)→ 已派后台 opus 补转 M01MemoryGearControllerTests.cs。
- 血战语义补钉: M01SnapRotationTests.cs(10 Fact)已落, **dotnet 208/208 绿**。

### M01 盘面探针 ✅(2026-07-12): 真实配置在 Unity 渲出
`StarGuardian/Assets/GlowProbe/M01BoardProbe.cs` + 场景 `Assets/Scenes/M01BoardProbe.unity`: Resources 加载真实 `m01-memory-gear.json`(已拷 `Assets/Resources/Configs/`)→ JsonConvert → **已迁移的 M01GreyboxLayout.Build** → 世界空间 SpriteRenderer 渲出(纸底/齿轮背板/中心 6 目标槽虚影+6 证据簇/右侧 9 拼片托盘 3×3, 程序化形状贴图 圆/三角/六边 fill+outline, PPU=100 Cocos px→units, Cocos 顺时针角→Unity -Z)。console 打点: fragments=9 slots=6 evidence=6 + 中文状态文案原样。**"纯逻辑层→Unity 渲染"整条链路验通。**
下一步(桶 B 正式化, 让它可玩): DragInputController(Input System 指针→DragHandler/GreyboxDrag)→ 点击/拖拽/吸附 → FlashlightRig(Light2D 显色)→ EvidenceValidator → CompletionDirector。

### M01 拖拽交互探针 ✅(2026-07-12): 鼠标拖放+吸附在 Unity 跑通
`M01DragProbe.cs`(挂 M01BoardProbe 同节点, 场景已存): 左键按住拖拼片/拖中 R 键 90° 步进旋转/松手走 **ResolveM01GreyboxDrop** 按 action 处置(snap=落槽染灰绿/stick=贴槽染琥珀提示转角/weak_snap=吸证据淡紫/free=原地灰白)。逻辑层 token.Position 与渲染层 GameObject 同步(layout=单一真源)。注意 ProjectSettings `activeInputHandler=1`(仅新 Input System)→ 必须 `Mouse.current`, 旧 `Input.*` 会抛。
Play 冒烟(execute_code 程序化拖放+截图): 对角落槽→snap✓(绿三角进盘中心槽, 90°角对)/错角→stick✓(琥珀贴槽)/诱饵任意角→free✓。**输入→吸附判定(迁移逻辑)→渲染同步整链跑通。** 用户可自己 Play 鼠标拖。
探针级简化(正式 DragInputController 再升级): 距离拾取无 Collider/EventSystem。

### M01 通关闭环 ✅(2026-07-12): session 全链在 Unity 跑通
`M01BoardProbe` 建 `M01GreyboxSession.FromConfig`; `M01DragProbe` 接完整玩法: 拾起即 UnstageFragment+清记账(**拾起归零旋转账本 = Cocos stale-rotation-ledger 坑的正解**)→ 落下按 action 记账(snap→中央 target 槽 / weak_snap→session.WeakSnapFragmentToEvidence)→ **每证据两真解片齐即 SubmitEvidencePair** → AreAllEvidenceStaged → **ValidateCandidateStructure** → 底光染色(accepted=灰绿/fail=砖红)。加 `DebugDrop(fragmentId,x,y,rotation)` 冒烟入口(与鼠标同路径)。
Play 冒烟: 6 真解片按槽 pose DebugDrop → 6 配对提交 → allStaged=True → **VALIDATE accepted=True completed=True bottomLight=steady_on, status="底光保持亮起,结构成立。"**, 背板染绿, 托盘剩 3 诱饵。**拾→拖→旋→吸附→配对→验证→通关整链全走真实迁移逻辑。** controller 直测 23 条也已落(231/231 绿)。
### M01 FlashlightRig 探针 ✅(2026-07-12): Light2D 光池 + 混色显色跑通
`M01FlashlightProbe.cs`(挂同节点, 场景已存): **F 键循环 红→黄→蓝→灭**(session.SelectFlashlight/ClearFlashlight, 换灯自动清 observed 全恢复底色)+ **Light2D 点光池跟鼠标**(颜色随灯色, 视觉半径=覆盖 70px×1.6)+ 每帧覆盖判定(config radius 70)→ 进=session.RevealFragment→RevealedColor 染色 / 出=恢复 FragmentBaseColors(玩法反馈色账本, DragProbe 落子时同步写)。为 Light2D 可照: BoardProbe 全部 sprite 换 `Sprite-Lit-Default` 材质 + 场景加 Global Light2D(intensity 1 保基础亮度)。
Play 冒烟: 红灯压 hexagon_blue_1 → 覆盖内 3 片显色 **蓝→purple×2 / 黄→orange**(颜料混色语义原样), 覆盖外灰白, Light2D 光斑同框。**Cocos 里"代码生成 glow 贴图+packable 坑"整套 = Unity 一个 Light2D 组件。**
### M01 CompletionDirector 探针 ✅(2026-07-12): VideoPlayer 播母版 = FFmpeg 立项正式作废
`M01CompletionProbe.cs`: validate.Completed → **Unity VideoPlayer 全屏播 iOS 同款母版 mp4**(1920×1280/14.3s, `Assets/Resources/Videos/`, CameraNearPlane+FitInside)→ 点击跳过/播完 → 打出智慧结晶卡(session.GetLastToolCard, 完整卡面 log; 视觉卡面=下一波 UI)。
**坑(记)**: VideoPlayer `loopPointReached` 实测**不触发**(停 333/343 帧 isPlaying=false 回调不来)→ Update 看门狗兜底(time>0.5 且 !isPlaying 或逼近片尾)——**Cocos VideoPlayer"完成回调不可靠+看门狗"的教训跨引擎复现, 同款解法**。
Play 全流程冒烟(全自动): DebugDrop 6 片 → 通关 → ▶ 过场(截图=星光路径云海 finale 帧)→ 看门狗收尾 → 🎴 智慧结晶卡 [m01] 分类与归纳。**Steam 桌面视频洞至此闭合: 一个 VideoPlayer 组件 + 看门狗 ≈ 原 FFmpeg 立项的全部验收目标(流式/HD/省内存/跳过/出卡)。**
### M01 盘面美术上身 ✅(2026-07-13): 齿轮水彩盘 + 描边拼片
真水彩贴图拷入 `StarGuardian/Assets/Resources/Art/M01/`(hidden-fragments 3 + light-edge 3 + overlap-memory-gear + flashlights 3)。M01BoardProbe: 齿轮用 `m01-overlap-memory-gear`(750², 被半透明化的灰盒背板透出), 拼片=水彩底片(tint 白显本色)+ 描边子节点(不吃染色, 墨线恒色), 缺贴图回退程序化形状。显色/反馈染色乘法 tint 在水彩纹理上语义与 Cocos Sprite.color 一致(冒烟: 紫/橙水彩显色 + 绿 snap 反馈 + Light2D 光斑同框)。
### M01 完全体探针闭环 ✅(2026-07-13): 手电可视化 + 卡面 UI + 开场小剧场
①**手电本体**: 贴图随灯色换挂光池节点(灭态压暗)。②**智慧结晶卡面**: 暗罩+米白竖卡+分段中文(PingFang SC 动态字体 TextMesh 零资产; 材质首帧 null→RequestCharactersInTexture 预热+Update 自愈; 手动断行)。③**开场小剧场**(M01IntroProbe): 拼片藏篮(hanging 贴图含画好的满篮)→点篮→tipped→按 ResolveSpillFlingVelocity 散布逐片弧线倒出→空篮→手电掉地→点击拾取→解锁拖拽+手电(InputLocked/Acquired 门闩, 无 Intro 场景自动解锁)。钉子独立贴图(Cocos 老坑)。莱米帧动画=下一波。④**输入正式化(Collider/EventSystem)有据跳过**: 距离拾取与 Collider 命中在本玩法行为等价, 零增益(ponytail)。
**新坑三连(已入 unity_runtime_gotchas)**: DontSave 跨 Play 残留 16 具尸体致"新码不生效"假象; 动态字体材质首帧 null=品红; **Console Error Pause + MCP 截图的 assertion 每截一图就暂停 Play**(协程全冻, 查 isPaused/frameCount)+ 失焦不跑帧(runInBackground=true)。
**M01 探针级完全体**: 开场(篮/手电)→拖/转/照显色→吸附配对→验证底光→过场视频→结晶卡, 全链 Unity 落地可玩。剩正式化: 莱米 802 帧开场剧场/绳物理渲染/证据标记贴图/提示灯泡/正式组件化(探针拆正式类)。
### 合并前双审 ✅ 已消费(2026-07-13): codex 10 条 + /code-review max(10 finder+2 verifier+sweep, 15 findings)
**修掉(A 桶 13 件, 双编译+Play 冒烟复验)**: ①DragProbe 旋转账本拾起改【重基线到就近 90°+视觉贴齐】(硬归零致"视觉转错却判 snap", 4 角度交叉+CONFIRMED); ②渲染旋转取负改正向(Cocos 3.x euler Z 同为逆时针, 原注释事实错误, 绝对朝向曾镜像); ③同帧 press+release 丢 drop(release 独立于 else-if); ④weak_snap 落座证据吸附位(消 ResolveEvidenceFragmentSnapPosition 死代码); ⑤通关演出/卡面期间锁 Drag+Flashlight(SetGameplayInputLocked, 防跳过点击穿透拆盘)+PlayCompletion 幂等门补 cardGo+起播超时兜底(prepare 卡死实测偶发); ⑥手电 onTray/拖拽中排除(IsFragmentPlaced/HeldFragmentId)+半径与灯 id 改读 config; ⑦BoardProbe OnDisable 清引用+ResetLedgers(防旧账本对新 Session 假提交)+纹理材质回收; ⑧空篮 sortingOrder 后置(5/9 落点被贴图不透明区吞, 像素实测); ⑨M2GlowProbe 清 ~GlowVolume(残留 Bloom 污染对照); ⑩ToolCard stage 安全取整(BigInteger 溢出+整值浮点, 与 StarWebConfig 修法一致); ⑪CompletionProbe 自愈一次即停+Bold 预烘; ⑫runInBackground=1+EditorBuildSettings 加 M01 场景+MCP 依赖钉 commit hash; ⑬CLAUDE.md 引擎/语言/目录同步 Unity 现实+spec §5.2 过渡注。**231 测试仍绿, Unity 0 编译错, 全流程冒烟(锁定拒绝/过场锁输入/出卡/重入挡/收卡解锁)全过。**
**REFUTED(不修有据)**: JsonConvert 类型化到 string 属性不吃日期坑(双侧实测); 宽屏暗罩"露盘面"不成立(盘面本身 9.6 units, 露的是相机底色)。
**defer 到正式化波次(记档)**: DragProbe 提交语义整块按 TS bootstrap 重写(身份→槽占用者/弱吸 last-2 滑窗/槽占用互斥/stick 触发验证门/ReturnToOrigin·ActivateFilter·PlaceFragment 三分支)——这就是计划中的正式 EvidenceValidator/DragInputController, 探针不写两遍; M2 光效闸门证据标签更正(additive+Bloom 为当时所验, Light2D 由 M01 手电光池补验, 结论不变); 进度持久化 PlayerPrefs; 中文字体 Windows fallback; PuzzleConfig.Validate<T> 物化钉死基类(M02 动工前定); 校验原语/测试夹具/坐标层/调色板收敛; RouteTap 接线; 探针每帧 GetComponent 缓存。

**桶 B 剩余**: ToolCard UI 卡面(Canvas)→ 正式化输入(Collider/EventSystem)→ 美术资产导入(拼片/盘面/莱米 802 帧)→ 莱米开场小剧场(最后)。M01 可玩内核(拖/转/照/配对/验证/通关/过场/出卡)**已全部在 Unity 跑通**。
- 注意: 这波 agent 手写了 .cs.meta(违约定但 Unity 已吃下没报 GUID 冲突, 不动)。
- **下一步**: 消费审 → MCP 驱动搭 PuzzleBoardView(Unity 里渲出 M01 盘面给用户看)→ 桶 B 逐件(DragInputController/EvidenceValidator/FlashlightRig…)。

## 已搁置(被上面的 Unity 迁移取代):M01 通关过场 Steam FFmpeg 解码器(2026-07-11 立项)

用户拍板走**方案 B(自建 FFmpeg 原生解码器)** 取代 Steam 桌面现走的逐帧 Sprite 序列(344 帧 960×640 → RGBA 峰值 ~845MB)。选 B 而非更懒的「窗口化加载帧序列」,因为要 **HD 1920×1280 + 多段过场**:窗口化的内存跟分辨率死绑(HD 下 <50MB 只剩 ~5 帧窗口、缓冲薄易卡),FFmpeg 流式解码缓冲恒 1~2 帧、与分辨率无关;插件+JSB 的一次性投入被 M02-M10 过场摊薄。Bink(~$8500/平台/作品)/OS 原生媒体/libVLC/Theora 均评估后否掉。

**本会话只交付「计划 + 环境清单」,不碰代码**(用户选定)。权威方案 + 分阶段执行计划 + 环境准备清单 + 技术要点全落 `docs/design/m01-completion-ffmpeg-decoder-plan.md`(已升级)。要点:
- **唯一硬阻塞 = 阶段 0 环境**(本仓无桌面原生工程 + 无 FFmpeg 库 + 本机 Mac 无 Win MSVC)。阶段 2-5 原生代码在此环境编不了验不了,须留给有构建机的会话。
- **阶段 1(TS 契约 + 桌面分流降级)此环境可做可验**,且不是 B 的沉没成本(叠层/看门狗/跳过/收尾复用现有,原生只替换「帧加载+渲染」内循环);做了它 Steam 在 native 落地前继续走帧序列降级。
- **基座搬 [Xrysnow/cocos2d-x-video](https://github.com/Xrysnow/cocos2d-x-video)**(MIT, ffmpeg4.0+, FFDemuxer/FFCodec/**FFFrameQueue** 解码线程队列直接可用),砍移动端、贴图上传/JSB 为 CC 3.8 重写。
- **音频 v1 简化**:复用现成 `completion-audio.mp3` 独立 AudioClip 同起(帧序列路径已验证的做法),不在 C++ 解 PCM → 原生契约收窄为纯视频 open/decodeNextFrame/close。
- **已知坑**:解码帧 SpriteFrame 必 `packable=false`(否则动态图集 texSubImage2D 洪水);swscale→RGBA8888 注意 stride;验收必跑 codex(原生 headless 验不了)。

**下一步**:待用户备好阶段 0 环境(或决定先做阶段 1 的 TS 契约切片),再开工原生。当前无代码改动,仅文档。

## 当前活跃线:M02 开场序章「三颗余烬点棒」(2026-07-09, 分支 `feat/m02-prologue`, 隔离 worktree)

用户拍板给 M02 加前置小谜题(对标 M01 顶篮取电筒的配方:道具有来历+逐个教动词+预演本关道理)。设计:三颗流星余烬散落,单颗必灭、两颗仍灭、三颗成簇冻结长明→用火簇点燃星光棒→电量 UI diegetic 出场→进正式星网。规则与主谜题同律(复用 mechanic.lifeMax/freezeThreshold),差异只有实时拍制(beatSeconds)与距离邻接(adjacencyRadius);熄灭余烬隔 rekindleBeats 拍复燃(无死锁)。只教规则不泄答案(紧配额落点规划序章不涉及)。

已完成(TDD 红→绿):spec §5.3 新增「开场序章」小节;`m02-starweb-warmth.json` 新增 `prologue` 段;`StarWebConfig` 校验(含"开局不得预成簇"/"余烬数>=freezeThreshold+1 防软锁"/"initialLife<=lifeMax"交叉校验);纯逻辑 `M02PrologueSession`(实时拍累积含浮点 epsilon、快照结算、复燃、拔棒/点棒);greybox 胶水 `M02PrologueView`(拖余烬/点棒/点火簇,光晕随命数收缩与主谜题同语言);`M02StarWebView` 挂接(有 prologue → 先序章再开板);cc-shim 补 `EventTouch.propagationStopped`。验证:`npm test` ✅(40 files / 469 tests),`npm run typecheck` ✅。

codex 零框架对抗审(第 1 轮)发现 P1 已修:点火簇中心的点击被拖拽分支吞掉(onTouchStart 命中余烬 48px 即标记拖拽,onTouchEnd 见标记直接 return,永远走不到 dipWand;只有 48-120px 空白环带能点棒)。修法:按下只记"拖拽候选",位移超阈值才升级为拖拽,未升级的抬手按点击处理。codex 复核确认修复有效且无新问题。

/code-review 8 角度审(第 2 轮)10 项发现已消费(修 8 缓 2):
1. 修 — tap-vs-drag 手搓判定改用 interaction/DragHandler 状态机;轻点阈值下沉为 DragHandler 导出的 CLICK_DRAG_THRESHOLD=6(M01 同步改为 import,消灭 6px/12px 双魔数)。
2. 修 — M02PrologueView 静止帧跳过重绘:session 加 revision 版本号(走拍/拖动/拔棒/点棒 +1),update() 仅在 revision 变化时 render(低端机 30fps 目标下不再每帧重建 Graphics)。
3. 修 — session view/isFrozen/tickBeat 共用一次构建的 EmberSnapshot,消掉每次调用的快照重建+indexOf 反查。
4. 修 — EmberStatus 改为 StarNodeStatus 别名(呈现态词汇单一真源);renderWand 参数用导出的 WandState 类型。
5. 修 — 主视图 onTouchStart 加 !session 守卫(序章期间不锁触点,防配对 TOUCH_END 丢失后吞掉开板首击)。
6. 修 — 序章门禁注释纠偏(后被第 3 轮推翻,见下)。
7. 修(测试) — 新增跨模型契约测试:序章余烬(距离邻接)与 StarNetworkModel(固定边表)在三角簇/双星线上逐拍命数镜像对比,防两份衰减实现发散("同律"承诺被钉死)。
8. 缓 — 余烬三态调色板按值复制自 M02StarWebView(模块私有无法 import):待水彩背景 WIP 落地后抽共享调色板模块(现在动主视图常量区必撞冲突)。
9. 缓 — nearestEmberId 与 nearestNodeId 的最近命中算法重复:低优先,与调色板抽取一并处理。
判为不修:EmberView.lit/done 字段冗余(getter 内派生非第二真源,且与主谜题 StarNodeView 契约同形)。

修后 `npm test` ✅(40 files / 472 tests) / `npm run typecheck` ✅。

已合并 main(ea617bc, 前置提交 a49558e 先按现状收编了水彩背景 WIP;背景的 backup/clean 变体与 toolcards 素材仍未定稿未收编)。

第 3 轮(2026-07-10, 分支 `fix/m02-prologue-always-replay`):用户重启预览直进星网——探因是其老存档已通关 m02 命中跳过门(headless 空存档探针证序章代码正常)。决定**删除已通关跳过门,序章每次进关都播**(M01 开场从不设完成度门,全库唯一 isPuzzleCompleted 生产调用点是异类);spec §5.3 同步。codex 撞配额(12:48 恢复),由独立全新上下文 agent 代审:功能零问题,唯一发现 active.md 残留旧门描述已改。`isPuzzleCompleted` 现无生产调用点(存档 API 保留)。

未完成:Cocos 编辑器 Preview 肉眼验证(.ts 改动需手动重启预览);莱米走入/发抖/烤爪动画与余烬正式美术(greybox 先行,spec 已注明后补);调色板/最近命中去重两项缓办(见上)。

## 当前活跃线:ToolCardPreview 具名字段化清理(2026-07-06, 分支 `refactor/toolcard-preview-named-fields`, 接 `codex/m02-phase3b`)

审阅 M02 3B/3C 时发现:M01(`M01GreyboxBootstrap`)和 M02(`M02StarWebView`)两个 View 都硬编码 `preview.lines[0/1/2]` 取"智慧结晶/核心动作/何时使用",顺序绑死——一旦 `buildToolCardPreview` 调整 lines 顺序/数量,View 会静默显示错内容不报错。
修复:给 `ToolCardPreview` 加具名字段 `crystal/coreAction/whenToUse`(由构造保证非空,顺带去掉消费方的 `?? ""` 死代码),`lines` 数组保留(向后兼容,既有测试不破)。M01+M02 各改 3 行下标访问为具名字段。
验证:`npm run typecheck` ✅;`npm test` ✅(全绿,新增具名字段断言)。范围外不动(卡面布局/原生持久化/节点复用优化)。

## 当前活跃线:M02 终板难度调整(2026-07-06, 分支 `codex/m02-harder-final-board`)

用户最终决定保留第 2/5/6 版作为 M02 当前三板序列：`双环共枢纽` (`twin`, 9 星 / 3 电) → `双轨星门` (`orbital_gate`, 24 星 / 6 电) → `花冠星门` (`corona_gate`, 31 星 / 7 电)。`双轨星门` 保留顺轨扫、先清上轨/下轨、先点两端都会失败的跨轨配对陷阱；`花冠星门` 在双轨网上方加花冠，参考解 `A,M,I,U,E,Q,Y`，顺轨扫、先点中心、先清上/下轨、先点两端、漏掉花冠都会失败。

已更新 `assets/resources/configs/stage1/m02-starweb-warmth.json`、`docs/design/game-design-spec.md`、`docs/plans/2026-07-05-m02-phase3.md` 与对应 M02 配置/会话测试。验证：`npm test` ✅(39 files / 448 tests)，`npm run typecheck` ✅，`git diff --check` ✅；`双轨星门` / `花冠星门` 弧线采样均无非共享边交叉。已同步主工程并打开 fresh Cocos Preview。

已按用户提供的 M02 水彩星图参考生成首批非背景美术素材：`assets/resources/art/stage1-m02/m02-star-sprite-atlas.png`，以及配置引用路径 `assets/resources/stage1/m02/toolcards/starweb-thumbnail.png`。M02 背景图已在其他线程定稿，本线程不再提交背景资产。

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
