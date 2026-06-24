# M01 手电显色重做为 `fx_color-filter` 逐像素光照着色器

日期: 2026-06-22
状态: 设计待评审
关联: spec §3.5 Shader 库 / §5.2 M01

## 1. 目标 / 问题

当前 M01 手电显色: 拼片中心进入 radius-150 覆盖圆 → **整片** sprite 换成 `light_mask_{shape}` 纹理、染上混色。问题:

- **整片硬换**: 显色是全有/全无, 和光束实际落在哪儿无关(覆盖圈是判定圆, 不是光束 footprint)。
- **不自然**: 没有"光扫到哪儿、哪儿才亮"的渐变。
- **半透叠加副作用**: 显色靠半透"玻璃"贴片叠加 → 叠在亮背景(大螺母平台)上被透色冲淡。

期望: **只有被光束实际照到的像素显色, 且边缘自然渐变**(像真手电扫过)。本质是逐像素、按光束强度的光照 —— Cocos `Graphics`/sprite 贴图做不到, 需自定义片元着色器。

## 2. 范围

- **建** spec §3.5 规划 6 个 MVP shader 中的 `color-filter`(用途"颜色过滤/高亮", 首次出现 M01, 复用 ~15 关), 用作 M01 手电逐像素显色。命名按 `.claude/rules/shaders.md` 统一为 `fx_color-filter`。
- **文件位置(评审#4)**: `.effect` 必须在 `assets/` 下才能被 Cocos 编译/加载; 放 `assets/resources/shaders/fx_color-filter.effect`(可 `resources.load(..., EffectAsset)`)。`.claude/rules/shaders.md` 里写的 `shaders/` 是命名约定, 实际落盘到 `assets/resources/shaders/`; spec §3.5 该行对齐为 `fx_color-filter`, 并补一句"effect 落 assets/resources/shaders/"。
- **cc-shim 扩展(评审#1, 必做 scope 项)**: `assets/scripts/cocos/cc-shim.d.ts` 目前**完全没有**材质相关类型。需补: `EffectAsset`(class)、`Material`(class, 构造 `new Material()` + `initialize({ effectAsset })` + `setProperty(name, value)`)、`Sprite.customMaterial: Material | null`、`resources.load` 的 `EffectAsset` 重载已被泛型覆盖。只补代码**实际用到**的成员。
- **不建**其余 5 个(star-glow / particle-flow / wave-propagation / hologram / fluid-sim) —— 按关卡推进到时再建(YAGNI)。
- **不改**显色**规则**(童话颜料混色、哪片显什么色): 只改"显色怎么画出来"(整片硬换 → 逐像素光照)。

## 3. 架构

```
9 个拼片 sprite ──挂──> 共享材质(fx_color-filter.effect 实例 ×1)
                          ├─ per-sprite: sprite.color = 该片混色(revealColor, 经顶点色 v_color 进 shader)
                          └─ 全局 uniform(每帧更新): 光束几何 + lightOn
拼片纹理 = 现有灰白 hidden_{shape} 贴图(不再运行时换成 light_mask)
```

### 3.1 着色器 `assets/resources/shaders/fx_color-filter.effect`(Cocos 3.8 sprite 片元着色器)

- 顶点阶段: 由内置 `cc_matWorld * a_position` 算**世界坐标** `v_worldPos`(评审#2: 必须和传入的世界空间光束几何同一空间) + `v_uv0` + `v_color`。
- 片元阶段:
  1. 采样灰白原图: `base = texture(spriteTexture, v_uv0)`。
  2. 算光束强度 `intensity ∈ [0,1]`(见 3.3), 由全局 uniform 的世界空间光束几何 + `v_worldPos` 决定。
  3. `revealColor = v_color.rgb`(该片混色, 由 sprite.color 传入)。
  4. **混色用 lerp-toward-color, 不是纯相乘**(评审#3: 纯 `base*revealColor` 只会变暗、出不来饱和的颜料色):
     `tinted = mix(vec3(luma(base.rgb)), revealColor, REVEAL_SATURATION)`(把灰度按目标色重新着色, 保留明暗); `out.rgb = mix(base.rgb, tinted, intensity)`; `out.a = base.a`。
     - `REVEAL_SATURATION`(默认~0.85)与目标观感在预览里标定, 使显色≈现有 `colorForObservedFragmentTint` 的混色; 不承诺数值严格相等(见 §7)。
     - 显色是 sprite 自身输出(非半透叠加)→ 顺带解决"叠平台被背景透色冲淡"。
- `lightOn=0` 或 `intensity=0` → 全灰白原图。
- **无复杂分支**(spec shader 规则: 低端 ≥30fps); 强度用 `smoothstep` 连续函数, 不用 if 链。
- ⚠️ 评审#3: 验收"色值一致"降级为"预览标定到接近", 非保证相等。

### 3.2 应用 / 数据流(`M01GreyboxBootstrap`)

- **加载/建材质(评审#4)**: 启动时 `resources.load("shaders/fx_color-filter", EffectAsset, cb)` → `const mat = new Material(); mat.initialize({ effectAsset })`; 9 个拼片 sprite 的 `customMaterial = mat`(共享一份)。
- 拼片 sprite 始终用灰白 `hidden_{shape}` 贴图 + 该共享材质。**删掉**运行时换 `light_mask` 贴图那条路径(改由 shader 出色); 旧路径保留为 fallback(见 3.4)。
- 每帧(`syncFlashlightCoverage` 已有): 把光束几何**转世界空间后**(评审#2)+ `lightOn` 经 `mat.setProperty(...)` 写到共享材质全局 uniform。
- 显色集合/灯色变化时(已有 `coverageStateKey` 节流): 给每个**在覆盖内**的拼片 `sprite.color = 该片混色`(revealColor, 经 `colorForObservedFragmentTint`/blend 逻辑算, 不变); 不在覆盖内的片 `sprite.color = 白`(shader 中 intensity 仍由光束几何决定, 双保险)。
- 选 **v_color 传 revealColor** 而非每片一个材质实例 → 一套材质 + 每片用现成 `sprite.color` 通道, 不做 N 份材质实例(省、简单)。
- ⚠️ **评审#7: `sprite.color` 在这 9 个拼片上被征用为 revealColor 通道** —— 实现前先审计现有对拼片 sprite.color 的写入(约 1247/1276/2782/2865 行), 确认改用 shader 后那些路径不冲突(多半是旧 light_mask 染色路径, 随之删/改)。

### 3.3 光束强度模型(纯函数, 可单测) — 坐标空间(评审#2)

⚠️ **统一世界空间**: 现有 `computeBeamGeometry` 的量在节点"drawing 空间"(anchor.position 等父相对坐标), **不是世界坐标**。本特性必须把光束几何转世界空间(`node.getWorldPosition()` / `UITransform` 世界换算)再传 uniform, 且 shader 用 `cc_matWorld * a_position` 出 `v_worldPos` —— 两边同在世界空间, 否则显色区漂移。这条是首要落地前提。

把"世界坐标 → 光束强度"的数学抽成纯 TS 函数 `flashlightBeamIntensity(worldPoint, beamWorld)`(供单测), shader 里用 GLSL 复刻同一公式:

- 把点投到光束轴(muzzle→落地方向): 轴向参数 `t`、垂距 `d`。
- 轴向窗: `t ∈ [0, len]`, 两端 `smoothstep` 软收。
- 扇形半宽随 `t` 线性增(锥形); `across = smoothstep(halfWidth(t), 0, d)` 软边。
- `intensity = axial * across`(再可乘整体 `lightOn`)。
- 与现有锥光视觉(复用同一 `computeBeamGeometry` 量)对齐 → 显色区 = 看到的光锥区。

### 3.4 降级路径(spec shader 规则: 需 fallback) — 评审#5

- **判定信号(具体)**: EffectAsset/Material **加载后为 null** 或 load 回调报错 → `this.colorFilterShaderAvailable=false`, 走旧整片染色路径。
- **GPU 静默误编译兜不住**: `.effect` 能 load 却在 GPU 编译失败时通常**不抛错**(渲染黑/乱), 自动检测兜不住。故另给一个**手动总开关**常量 `USE_COLOR_FILTER_SHADER`(默认 true; 真机发现 shader 崩则置 false 强制回退现状), 不指望全自动。
- 现有 `light_mask` 整片染色路径**保留为 fallback 分支**, 不删净。

## 4. 测试

- **纯函数单测**: `flashlightBeamIntensity` —— 轴上=1、轴外=0、边缘 smoothstep 单调、超出长度=0、lightOn=0 全灭。
- **scaffold 结构断言**: `fx_color-filter.effect` 存在; bootstrap 引用材质 + 每帧写光束 uniform + 拼片挂 customMaterial; fallback 分支存在。
- **显色逻辑回归**: 现有 blend/observed 测试不变(规则没改)。
- **运行时观感**: shader 无法 headless 验证 → 必须 Cocos 预览手验(本设计明确承认这点)。

## 5. spec / 玩法

- spec §5.2 加一句: "覆盖面显色由 `fx_color-filter` 着色器**逐像素自然照亮**(光束扫到处渐变显色), 非整片切换。"
- spec §3.5: `color-filter.effect` → `fx_color-filter.effect`(命名对齐 `.claude/rules`)。
- 显色判定规则(童话颜料混色、onTray 不照盘、覆盖集合)**全部不变**。

## 6. 风险

- **着色器 headless 验不了** → 几乎必然多轮预览迭代(已与用户确认接受)。
- **Cocos 3.8 `.effect` API 挑剔**(YAML+GLSL 结构、内置 uniform 名、sprite v_color/world-pos 获取方式) → 首版很可能编译/取值不对, 靠预览+日志调。
- **世界坐标取法(评审#2)**: sprite 内置顶点是局部/NDC, 需正确拿世界坐标和光束同空间; 取错则强度算错(显色区跑偏)。降级路径保证"最差也能退回现状"。
- **TS↔GLSL 公式漂移(评审#6)**: `flashlightBeamIntensity` 的强度数学在 TS(单测)和 GLSL(玩家看到的)**各写一份**, 单测不证明 GLSL 正确, 且日后微调易两边走样。缓解: ①TS 与 GLSL 两段公式**并排放、互相注释引用**(同一文件/同一 commit 改); ②scaffold 断言 grep `.effect` 含与 TS 同名的 smoothstep/轴向项; ③明确"GLSL 唯一真相只能靠预览"。这是接受并监控的风险, 非消除。
- **着色器不可控失败** → 见 §3.4 手动总开关 `USE_COLOR_FILTER_SHADER` 兜底。

## 7. 验收

手电照过拼片时, **只有光锥扫到的局部像素**染上该片混色、边缘自然渐变; 灯灭/移开即恢复灰白; 显色色值与现有混色规则一致; 叠在大螺母平台前也不再被背景冲淡(显色为 shader 自身输出)。低端设备或着色器不可用时回退现状不崩。
