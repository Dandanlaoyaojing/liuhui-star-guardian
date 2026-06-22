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

- **建** spec §3.5 规划 6 个 MVP shader 中的 `color-filter`(用途"颜色过滤/高亮", 首次出现 M01, 复用 ~15 关), 用作 M01 手电逐像素显色。命名按 `.claude/rules/shaders.md` 统一为 `fx_color-filter.effect`(并把 spec §3.5 该行从 `color-filter.effect` 对齐到带 `fx_` 前缀)。
- **不建**其余 5 个(star-glow / particle-flow / wave-propagation / hologram / fluid-sim) —— 按关卡推进到时再建(YAGNI)。
- **不改**显色**规则**(童话颜料混色、哪片显什么色): 只改"显色怎么画出来"(整片硬换 → 逐像素光照)。

## 3. 架构

```
9 个拼片 sprite ──挂──> 共享材质(fx_color-filter.effect 实例 ×1)
                          ├─ per-sprite: sprite.color = 该片混色(revealColor, 经顶点色 v_color 进 shader)
                          └─ 全局 uniform(每帧更新): 光束几何 + lightOn
拼片纹理 = 现有灰白 hidden_{shape} 贴图(不再运行时换成 light_mask)
```

### 3.1 着色器 `shaders/fx_color-filter.effect`(Cocos 3.8 sprite 片元着色器)

- 顶点阶段: 输出该片元的**世界坐标** `v_worldPos`(用于在世界空间和光束几何比对) + `v_uv0` + `v_color`。
- 片元阶段:
  1. 采样灰白原图: `base = texture(spriteTexture, v_uv0)`。
  2. 算光束强度 `intensity ∈ [0,1]`(见 3.3), 由全局 uniform 的光束几何 + `v_worldPos` 决定。
  3. `revealColor = v_color.rgb`(该片混色, 由 sprite.color 传入)。
  4. 输出 `rgb = mix(base.rgb, base.rgb * revealColor * REVEAL_GAIN, intensity)`, `a = base.a`(保持原图形状/边线 alpha)。
     - 用 `base.rgb * revealColor`(相乘)而非直接替换 → 保留灰白原图的明暗/边线纹理, 只把颜色"染"上去, 更自然且不被背景透色(显色是 sprite 自身输出, 不靠半透叠加)。
- `lightOn=0` 或 `intensity=0` → 全灰白原图。
- **无复杂分支**(spec shader 规则: 低端 ≥30fps); 强度用 `smoothstep` 连续函数, 不用 if 链。

### 3.2 应用 / 数据流(`M01GreyboxBootstrap`)

- 拼片 sprite 始终用灰白 `hidden_{shape}` 贴图 + 该共享材质(`customMaterial`)。**删掉**运行时换 `light_mask` 贴图那条路径(改由 shader 出色)。
- 每帧(`syncFlashlightCoverage` 已有): 把光束几何(中心/方向/长度/扇宽、复用 `computeBeamGeometry` 的量, 转世界空间)+ `lightOn` 写到共享材质的全局 uniform。
- 显色集合/灯色变化时(已有 `coverageStateKey` 节流): 给每个**在覆盖内**的拼片 `sprite.color = 该片混色`(revealColor, 经 `colorForObservedFragmentTint`/blend 逻辑算, 不变); 不在覆盖内的片 `sprite.color = 白`(shader 中 intensity 仍由光束几何决定, 双保险)。
- 选 **v_color 传 revealColor** 而非每片一个材质实例 → 一套材质 + 每片用现成 `sprite.color` 通道, 不做 N 份材质实例(省、简单)。

### 3.3 光束强度模型(纯函数, 可单测)

把"世界坐标 → 光束强度"的数学抽成纯 TS 函数 `flashlightBeamIntensity(worldPoint, beam)`(供单测), shader 里用 GLSL 复刻同一公式:

- 把点投到光束轴(muzzle→落地方向): 轴向参数 `t`、垂距 `d`。
- 轴向窗: `t ∈ [0, len]`, 两端 `smoothstep` 软收。
- 扇形半宽随 `t` 线性增(锥形); `across = smoothstep(halfWidth(t), 0, d)` 软边。
- `intensity = axial * across`(再可乘整体 `lightOn`)。
- 与现有锥光视觉(`fx_color-filter` 复用同一 `computeBeamGeometry` 量)对齐 → 显色区 = 看到的光锥区。

### 3.4 降级路径(spec shader 规则: 需 fallback)

- 检测材质/着色器不可用(编译失败或不支持) → 回退到**现状整片染色**(保留现有 `light_mask` 染色代码作为 fallback 分支, 不删干净)。判定点: 材质加载失败时置 `this.colorFilterShaderAvailable=false`, 走旧路径。

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
- **世界坐标取法**: sprite 内置顶点是局部/NDC, 需正确拿世界坐标和光束同空间; 取错则强度算错(显色区跑偏)。降级路径保证"最差也能退回现状"。

## 7. 验收

手电照过拼片时, **只有光锥扫到的局部像素**染上该片混色、边缘自然渐变; 灯灭/移开即恢复灰白; 显色色值与现有混色规则一致; 叠在大螺母平台前也不再被背景冲淡(显色为 shader 自身输出)。低端设备或着色器不可用时回退现状不崩。
