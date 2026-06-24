# M01 fx_color-filter 手电逐像素显色着色器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 M01 手电显色从"整片换染色贴图"改成"由 `fx_color-filter` 片元着色器按光束强度逐像素自然显色"。

**Architecture:** 一份共享 `Material`(由 `assets/resources/shaders/fx_color-filter.effect` 建)挂到 9 个拼片 sprite；每片用 `sprite.color` 携带该片混色(`v_color`)，全局 uniform 每帧传**世界空间**光束几何 + lightOn；shader 逐像素 `intensity`(轴向×扇形 smoothstep) 在 灰白↔混色 间 lerp。强度数学抽成纯 TS 函数 `flashlightBeamIntensity`(单测)，GLSL 复刻同一公式。保留旧整片染色路径 + 手动总开关 `USE_COLOR_FILTER_SHADER` 作降级。

**Tech Stack:** Cocos Creator 3.8.8, TypeScript(strict), vitest, GLSL(Cocos .effect YAML+chunk)。

**Spec:** `docs/superpowers/specs/2026-06-22-m01-color-filter-flashlight-reveal-shader-design.md`

> ⚠️ 着色器/材质渲染 **无法 headless 单测**。可单测的只有纯函数 `flashlightBeamIntensity` 和结构断言(grep 源码/资源存在)。每个改运行时渲染的 Task 末尾标注"**预览手验**"——交给人在 Cocos 预览确认，不在自动门里。

---

## File Structure

- `assets/scripts/cocos/M01FlashlightBeam.ts` — **新建**。纯函数 `flashlightBeamIntensity(point, beam)` + `BeamField` 类型 + `worldBeamFromGeometry(...)`(把 drawing 空间几何转世界空间结构)。无 `cc` 运行时依赖(可 vitest)。
- `tests/cocos/M01FlashlightBeam.test.ts` — **新建**。纯函数单测。
- `assets/resources/shaders/fx_color-filter.effect` — **新建**。Cocos 3.8 sprite 片元着色器。
- `assets/scripts/cocos/cc-shim.d.ts` — **改**。补 `EffectAsset` / `Material` / `Sprite.customMaterial`。
- `assets/scripts/cocos/M01GreyboxBootstrap.ts` — **改**。加载 effect→建 material→挂拼片；每帧写 uniform；显色改 shader 驱动；fallback + 总开关。
- `tests/cocosProjectScaffold.test.ts` — **改**。结构断言(effect 存在、材质接线、fallback 分支、TS↔GLSL 同名项)。
- `docs/design/game-design-spec.md` — **改**。§3.5 命名/位置对齐；§5.2 加一句"逐像素显色"。

---

## Task 1: 纯函数 `flashlightBeamIntensity` + 单测

**Files:**
- Create: `assets/scripts/cocos/M01FlashlightBeam.ts`
- Test: `tests/cocos/M01FlashlightBeam.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";
import { flashlightBeamIntensity, type BeamField } from "../../assets/scripts/cocos/M01FlashlightBeam.ts";

// 光束: 从 (0,0) 沿 +x, 长 100, 扇底半宽 40(锥顶半宽 4)
const beam: BeamField = { ox: 0, oy: 0, dx: 1, dy: 0, length: 100, nearHalf: 4, farHalf: 40, on: true };

describe("flashlightBeamIntensity", () => {
  it("轴心中段最强 ≈1", () => {
    expect(flashlightBeamIntensity({ x: 50, y: 0 }, beam)).toBeGreaterThan(0.9);
  });
  it("锥外(超长度)=0", () => {
    expect(flashlightBeamIntensity({ x: 130, y: 0 }, beam)).toBe(0);
  });
  it("muzzle 之后(负轴向)=0", () => {
    expect(flashlightBeamIntensity({ x: -10, y: 0 }, beam)).toBe(0);
  });
  it("扇形外(垂距 > farHalf)=0", () => {
    expect(flashlightBeamIntensity({ x: 50, y: 60 }, beam)).toBe(0);
  });
  it("边缘 smoothstep 单调: 轴心 > 半幅处 > 边缘", () => {
    const mid = flashlightBeamIntensity({ x: 50, y: 0 }, beam);
    const half = flashlightBeamIntensity({ x: 50, y: 11 }, beam); // farHalf@t=0.5 ≈ 22 → 半幅
    const edge = flashlightBeamIntensity({ x: 50, y: 21 }, beam);
    expect(mid).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(edge);
  });
  it("lightOn=false 全灭", () => {
    expect(flashlightBeamIntensity({ x: 50, y: 0 }, { ...beam, on: false })).toBe(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/cocos/M01FlashlightBeam.test.ts`
Expected: FAIL（模块/函数不存在）

- [ ] **Step 3: 写最小实现**

```ts
// 纯几何: 无 cc 依赖, vitest 可跑。GLSL(fx_color-filter.effect)必须复刻同一公式 —— 改这里要同步改 .effect(见 plan Task 4)。
export interface BeamField {
  ox: number; oy: number;   // 光锥顶(muzzle)世界坐标
  dx: number; dy: number;   // 光向单位向量(muzzle→落地)
  length: number;           // 轴向长度
  nearHalf: number;         // 锥顶半宽
  farHalf: number;          // 锥底半宽
  on: boolean;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const AXIAL_FEATHER = 0.12; // 轴向两端软收比例

export function flashlightBeamIntensity(p: { x: number; y: number }, b: BeamField): number {
  if (!b.on || b.length <= 0) return 0;
  const px = p.x - b.ox;
  const py = p.y - b.oy;
  const t = px * b.dx + py * b.dy;          // 轴向投影(沿光向距离)
  if (t < 0 || t > b.length) return 0;
  const u = t / b.length;                    // 0..1
  const d = Math.abs(px * -b.dy + py * b.dx); // 垂距(法向 = (-dy,dx))
  const halfAt = b.nearHalf + u * (b.farHalf - b.nearHalf);
  if (halfAt <= 0) return 0;
  const across = smoothstep(1, 0, d / halfAt);                 // 轴心1→边缘0
  const axial = smoothstep(0, AXIAL_FEATHER, u) * smoothstep(1, 1 - AXIAL_FEATHER, u);
  return Math.max(0, across * axial);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/cocos/M01FlashlightBeam.test.ts`
Expected: PASS

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: 无错

- [ ] **Step 6: 提交**

```bash
git add assets/scripts/cocos/M01FlashlightBeam.ts tests/cocos/M01FlashlightBeam.test.ts
git commit -m "feat(M01): flashlightBeamIntensity 纯函数(光束逐像素强度)+单测"
```

---

## Task 2: `worldBeamFromGeometry` — drawing 空间几何 → 世界空间 BeamField

**Files:**
- Modify: `assets/scripts/cocos/M01FlashlightBeam.ts`
- Test: `tests/cocos/M01FlashlightBeam.test.ts`

> 纯数据变换(给定 muzzle/center 的世界坐标 + 扇宽参数 → BeamField)。世界坐标的获取(node.worldPosition)在 bootstrap 里做(Task 5)，这里只做无 cc 的组装，便于单测。

- [ ] **Step 1: 加测试**

```ts
import { worldBeamFromGeometry } from "../../assets/scripts/cocos/M01FlashlightBeam.ts";
it("worldBeamFromGeometry: 由 muzzle/center 世界点算出单位光向与长度", () => {
  const f = worldBeamFromGeometry(
    { mx: 10, my: 10 }, { cx: 110, cy: 10 }, { nearHalf: 4, farHalf: 40, on: true }
  );
  expect(f.length).toBeCloseTo(100, 5);
  expect(f.dx).toBeCloseTo(1, 5);
  expect(f.dy).toBeCloseTo(0, 5);
  expect(f.ox).toBe(10);
  expect(f.on).toBe(true);
});
it("muzzle==center 退化为 on=false(零长不显色)", () => {
  const f = worldBeamFromGeometry({ mx: 5, my: 5 }, { cx: 5, cy: 5 }, { nearHalf: 4, farHalf: 40, on: true });
  expect(f.on).toBe(false);
});
```

- [ ] **Step 2: 跑确认失败** — Run: `npx vitest run tests/cocos/M01FlashlightBeam.test.ts` Expected: FAIL

- [ ] **Step 3: 实现**

```ts
export function worldBeamFromGeometry(
  muzzle: { mx: number; my: number },
  center: { cx: number; cy: number },
  opts: { nearHalf: number; farHalf: number; on: boolean }
): BeamField {
  const vx = center.cx - muzzle.mx;
  const vy = center.cy - muzzle.my;
  const length = Math.hypot(vx, vy);
  if (length < 1e-3) {
    return { ox: muzzle.mx, oy: muzzle.my, dx: 1, dy: 0, length: 0, nearHalf: opts.nearHalf, farHalf: opts.farHalf, on: false };
  }
  return { ox: muzzle.mx, oy: muzzle.my, dx: vx / length, dy: vy / length, length, nearHalf: opts.nearHalf, farHalf: opts.farHalf, on: opts.on };
}
```

- [ ] **Step 4: 跑确认通过** — Expected: PASS
- [ ] **Step 5: typecheck** — Run: `npm run typecheck`
- [ ] **Step 6: 提交**

```bash
git add assets/scripts/cocos/M01FlashlightBeam.ts tests/cocos/M01FlashlightBeam.test.ts
git commit -m "feat(M01): worldBeamFromGeometry 组装世界空间 BeamField+单测"
```

---

## Task 3: cc-shim 补材质类型

**Files:**
- Modify: `assets/scripts/cocos/cc-shim.d.ts`

> 只补**实际会用到**的成员(spec §2 评审#1)。无运行时行为，typecheck 验证。

- [ ] **Step 1: 在 `declare module "cc"` 内补类型**

```ts
  export class EffectAsset {}

  export class Material {
    initialize(info: { effectAsset: EffectAsset | null }): void;
    setProperty(name: string, value: unknown): void;
  }
```

并在 `export class Sprite` 内补一行：

```ts
    customMaterial: Material | null;
```

(`resources.load<EffectAsset>` 已被现有泛型 `load<T>(path, type, cb)` 覆盖，无需额外重载。)

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: 无错（新类型未被引用也不该报错）

- [ ] **Step 3: 提交**

```bash
git add assets/scripts/cocos/cc-shim.d.ts
git commit -m "chore(cc-shim): 补 EffectAsset/Material/Sprite.customMaterial 类型"
```

---

## Task 4: 建 `fx_color-filter.effect`

**Files:**
- Create: `assets/resources/shaders/fx_color-filter.effect`

> ⚠️ 无法 headless 验证；首版编译/取值很可能要在预览里调。GLSL 强度公式必须与 Task 1 的 `flashlightBeamIntensity` **一致**(轴向投影 + 垂距 + 同比例 smoothstep)。

- [ ] **Step 1: 写 effect**（Cocos 3.8 sprite effect；以内置 `builtin-sprite` 为骨架，加自定义 uniform）

```yaml
// fx_color-filter — 手电逐像素显色(颜色过滤/高亮)。视觉意图: 光束扫到的拼片像素被染上其混色、
// 边缘自然渐变; 没照到=灰白原图。强度公式须与 M01FlashlightBeam.ts::flashlightBeamIntensity 一致。
CCEffect %{
  techniques:
  - passes:
    - vert: sprite-vs:vert
      frag: color-filter-fs:frag
      depthStencilState: { depthTest: false, depthWrite: false }
      blendState:
        targets:
        - { blend: true, blendSrc: src_alpha, blendDst: one_minus_src_alpha, blendSrcAlpha: src_alpha, blendDstAlpha: one_minus_src_alpha }
      rasterizerState: { cullMode: none }
      properties:
        alphaThreshold: { value: 0.5 }
}%

CCProgram sprite-vs %{
  precision highp float;
  #include <builtin/uniforms/cc-global>
  #include <builtin/uniforms/cc-local>
  in vec3 a_position;
  in vec2 a_texCoord;
  in vec4 a_color;
  out vec2 v_uv0;
  out vec4 v_color;
  out vec2 v_world;
  vec4 vert () {
    vec4 world = cc_matWorld * vec4(a_position, 1.0);
    v_uv0 = a_texCoord;
    v_color = a_color;
    v_world = world.xy;
    return cc_matViewProj * world;
  }
}%

CCProgram color-filter-fs %{
  precision highp float;
  #include <builtin/internal/embedded-alpha>
  in vec2 v_uv0;
  in vec4 v_color;
  in vec2 v_world;
  #pragma builtin(local)
  layout(set = 2, binding = 0) uniform sampler2D cc_spriteTexture;
  // 光束 uniform(每帧由 bootstrap 写; 世界空间)
  uniform Beam {
    vec4 u_beamOrigin;   // xy = muzzle 世界坐标, z = length, w = on(>0.5)
    vec4 u_beamDir;      // xy = 单位光向, z = nearHalf, w = farHalf
  };
  float smoothstepf(float e0, float e1, float x){ return smoothstep(e0, e1, x); }
  float beamIntensity(vec2 p){
    if (u_beamOrigin.w < 0.5 || u_beamOrigin.z <= 0.0) return 0.0;
    vec2 rel = p - u_beamOrigin.xy;
    float t = dot(rel, u_beamDir.xy);
    if (t < 0.0 || t > u_beamOrigin.z) return 0.0;
    float u = t / u_beamOrigin.z;
    float d = abs(dot(rel, vec2(-u_beamDir.y, u_beamDir.x)));
    float halfAt = u_beamDir.z + u * (u_beamDir.w - u_beamDir.z);
    if (halfAt <= 0.0) return 0.0;
    float across = smoothstep(1.0, 0.0, d / halfAt);
    float axial = smoothstep(0.0, 0.12, u) * smoothstep(1.0, 0.88, u);
    return clamp(across * axial, 0.0, 1.0);
  }
  vec4 frag () {
    vec4 base = texture(cc_spriteTexture, v_uv0);
    float luma = dot(base.rgb, vec3(0.299, 0.587, 0.114));
    vec3 tinted = mix(vec3(luma), v_color.rgb, 0.85); // REVEAL_SATURATION=0.85
    float intensity = beamIntensity(v_world);
    vec3 outRgb = mix(base.rgb, tinted, intensity);
    return vec4(outRgb, base.a);
  }
}%
```

> 注: 上面 effect 是**初版骨架**。Cocos 3.8 内置 sprite chunk 名/uniform set-binding 细节(`cc_spriteTexture` 的 set/binding、`embedded-alpha`、`builtin-sprite` include 路径)可能需对照 `internal/effects/builtin-sprite.effect` 微调到能编译。这是预期内的预览迭代点。

- [ ] **Step 2: 刷新资源 + 预览手验(人)**

- 在 Cocos 编辑器导入/刷新 → 看 effect 是否编译通过(控制台无 shader error)。编译不过则对照内置 `builtin-sprite.effect` 修 include/uniform 声明，直到编译过。
- 此时还没接线，拼片不会变；只验"effect 能编译"。

- [ ] **Step 3: 提交**

```bash
git add assets/resources/shaders/fx_color-filter.effect
git commit -m "feat(M01): fx_color-filter.effect 手电逐像素显色着色器(初版)"
```

---

## Task 5: bootstrap 接线 — 加载材质 + 挂拼片 + 每帧 uniform + shader 驱动显色 + fallback

**Files:**
- Modify: `assets/scripts/cocos/M01GreyboxBootstrap.ts`
- (审计 ~2782 `syncArtSpriteState` / ~2796 `syncArtSpriteFrame`(light_mask 换图) / ~2865 `syncArtEdgeSpriteState` / ~3501 `colorForArtSprite` / ~3506 `colorForObservedFragmentTint`)

> 这是核心运行时改动，渲染部分**无法自动测**。拆成可独立提交的小步，每步 typecheck，整体末尾**预览手验**。

- [ ] **Step 1: 加总开关常量 + 材质字段 + 加载**

在常量区加 `const USE_COLOR_FILTER_SHADER = true;`；类加字段 `private colorFilterMat: Material | null = null; private colorFilterAvailable = false;`。
在初始化(layout 建好后)加载：

```ts
if (USE_COLOR_FILTER_SHADER) {
  resources.load("shaders/fx_color-filter", EffectAsset, (err, eff) => {
    if (this.destroyed) return;
    if (err || !eff) { this.colorFilterAvailable = false; return; }
    const mat = new Material();
    mat.initialize({ effectAsset: eff });
    this.colorFilterMat = mat;
    this.colorFilterAvailable = true;
    this.attachColorFilterToFragments();
  });
}
```

import 补 `EffectAsset, Material`。typecheck。

- [ ] **Step 2: `attachColorFilterToFragments()` — 给 9 个拼片 artSprite 挂 customMaterial**

```ts
private attachColorFilterToFragments(): void {
  if (!this.colorFilterMat) return;
  for (const entry of this.greyboxNodes.values()) {
    if (entry.token.kind === "fragment" && entry.artSprite) {
      entry.artSprite.customMaterial = this.colorFilterMat;
    }
  }
}
```

(若 artSprite 在加载回调时尚未建，attach 也在拼片建好处补调一次。)typecheck。

- [ ] **Step 3: 每帧写光束 uniform**

在 `redrawCoverageBeam`(已有 muzzle/center/角度/长度)末尾，把光束转**世界空间**后写 uniform：

```ts
if (this.colorFilterAvailable && this.colorFilterMat && this.lemmyAnchorNode) {
  // muzzle/center 是 drawing 空间 → 转世界: beamNode 与拼片同在 greyboxRoot, 用 greyboxRoot 世界变换
  const root = this.greyboxRoot!;
  const wm = root.worldPosition; // greyboxRoot 世界原点(假设无缩放/旋转; 若有需用 UITransform 换算)
  const muzzleW = { mx: wm.x + muzzle.x, my: wm.y + muzzle.y };
  const centerW = { cx: wm.x + contactX, cy: wm.y + floorY };
  const field = worldBeamFromGeometry(muzzleW, centerW, {
    nearHalf: COVERAGE_HEAD_GLOW_PX * 0.5, farHalf: (len * COVERAGE_CONE_FAN) * 0.5, on: true
  });
  this.colorFilterMat.setProperty("u_beamOrigin", new Vec4(field.ox, field.oy, field.length, field.on ? 1 : 0));
  this.colorFilterMat.setProperty("u_beamDir", new Vec4(field.dx, field.dy, field.nearHalf, field.farHalf));
}
```

灯灭/隐藏时写 `on=0`(在 hideCoverageBeam 里 `colorFilterMat?.setProperty("u_beamOrigin", new Vec4(0,0,0,0))`)。import 补 `Vec4`，shim 若无 Vec4 则补。typecheck。

> ⚠️ greyboxRoot 若有非单位变换，`wm.x + muzzle.x` 不准——实现时确认 greyboxRoot 的 worldPosition/scale；有缩放则改用 `UITransform.convertToWorldSpaceAR`。这是 spec §3.3 钉的首要前提。

- [ ] **Step 4: 显色改 shader 驱动 + 保留 fallback**

在 `syncArtSpriteState`/`syncArtSpriteFrame`(拼片显色处)：当 `this.colorFilterAvailable` 时——拼片 artSprite **不换 light_mask 贴图**(始终 hidden 灰白图)，`sprite.color = 该片混色(revealColor)`(覆盖内)或白(覆盖外)；shader 用 v_color + 光束 uniform 出像素显色。
当 `!this.colorFilterAvailable`(加载失败/总开关 off)→ 走**现有 light_mask 整片染色路径不变**(fallback)。
用一个分支包住：`if (this.colorFilterAvailable) { ...新路径... } else { ...旧路径... }`。typecheck。

- [ ] **Step 5: typecheck + 现有测试**

Run: `npm run typecheck && npm test`
Expected: typecheck 净；现有 364 测试仍过(显色规则没改；若 scaffold 因接线断言失败，Task 6 同步)。

- [ ] **Step 6: 提交**

```bash
git add assets/scripts/cocos/M01GreyboxBootstrap.ts assets/scripts/cocos/cc-shim.d.ts
git commit -m "feat(M01): 拼片显色改 fx_color-filter shader 驱动(世界空间uniform+fallback+总开关)"
```

- [ ] **Step 7: 预览手验(人)** — 重启 Cocos 预览。手电照拼片：只有光锥扫到的局部像素染该片混色、边缘渐变；灯灭/移开恢复灰白；叠平台前不被冲淡；显色色值≈旧观感(不行则调 effect 里 `REVEAL_SATURATION` / 光束半宽映射)。把总开关置 false 确认能干净回退旧整片染色。

---

## Task 6: scaffold 结构断言

**Files:**
- Modify: `tests/cocosProjectScaffold.test.ts`

- [ ] **Step 1: 加断言**

- effect 资源存在: `existsSync(... "assets/resources/shaders/fx_color-filter.effect")`。
- bootstrap 含 `resources.load("shaders/fx_color-filter", EffectAsset`、`new Material()`、`customMaterial =`、`setProperty("u_beamOrigin"`、`USE_COLOR_FILTER_SHADER`、`colorFilterAvailable`(fallback 分支)。
- TS↔GLSL 漂移哨兵: effect 文本含 `smoothstep` 且含轴向项 `0.12`/`0.88`(与 `M01FlashlightBeam.ts` 的 `AXIAL_FEATHER` 对应)；M01FlashlightBeam.ts 含 `0.12`。

- [ ] **Step 2: 跑测试**

Run: `npm test`
Expected: PASS（含新断言）

- [ ] **Step 3: 提交**

```bash
git add tests/cocosProjectScaffold.test.ts
git commit -m "test(M01): fx_color-filter 接线 + TS↔GLSL 漂移 scaffold 断言"
```

---

## Task 7: spec 对齐

**Files:**
- Modify: `docs/design/game-design-spec.md`

- [ ] **Step 1: §3.5** 把 `color-filter.effect` 行改为 `fx_color-filter`，补"effect 落 `assets/resources/shaders/`"。
- [ ] **Step 2: §5.2** 覆盖面显色那句后加："覆盖面显色由 `fx_color-filter` 着色器**逐像素自然照亮**(光束扫到处渐变显色)，非整片切换。"
- [ ] **Step 3: 提交**

```bash
git add docs/design/game-design-spec.md
git commit -m "docs(spec): §3.5/§5.2 对齐 fx_color-filter 逐像素显色"
```

---

## 验收清单

- [ ] `flashlightBeamIntensity`/`worldBeamFromGeometry` 单测过。
- [ ] `npm run typecheck` 净、`npm test` 全过。
- [ ] effect 在 Cocos 编译通过(预览无 shader error)。
- [ ] 预览手验: 局部逐像素显色 + 自然渐变 + 灯灭恢复 + 平台前不冲淡 + 色值接近旧观感。
- [ ] 总开关置 false 能干净回退旧整片染色、不崩。
- [ ] 显色**规则**(童话颜料混色/onTray/覆盖集合)未变。
