# M01 Physics Pile Implementation Plan

> 2026-05-26 收口说明：本文件是 2026-05-21 的执行计划记录，不再代表当前实现细节。最终实现以 `docs/design/game-design-spec.md` §5.2、`assets/scripts/cocos/M01PhysicsPile.ts`、`assets/scripts/cocos/M01PhysicsBoundary.ts`、`assets/scripts/cocos/M01GreyboxBootstrap.ts` 和对应测试为准。关键差异：当前版本不再 sequential drop，也不再保留 `interPieceDelayMs` / `dropOnePiece`；9 个拼片从顶部以 4-3-2 小堆布局同时自由落体，拖拽时临时脱离物理碰撞，放下后再交还物理或弱磁吸逻辑。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace M01's tidy 3×3 floating fragment grid with a Cocos box2d-driven small pile that visibly falls from above at level open, re-settles when the player drops a free piece, and treats snapped-to-target pieces as Kinematic-parked (still pickable) rather than consumed.

**Architecture:**
- **Physics layer:** Cocos Creator 3.8 built-in box2d 2D physics (already enabled in `settings/v2/packages/engine.json`). Per-fragment `RigidBody2D` + shape-correct collider; static `BoxCollider2D` walls on `FRAGMENT_FLOOR` boundary; Dynamic ↔ Kinematic state transitions drive drag/snap interactions.
- **Pure helpers (TDD):** seeded PRNG (`mulberry32`), stable rotation chooser, collider polygon builder. These live in their own files and are unit-tested.
- **Runtime wiring (non-TDD, verified via Cocos preview smoke):** `M01PhysicsBoundary` component, `M01PhysicsPile` controller (simultaneous sky-pile release + settle detection), `M01GreyboxBootstrap` modifications for the drag/snap state transitions.
- **Spec source of truth:** `docs/plans/2026-05-21-m01-physics-pile-design.md`.

**Tech Stack:** Cocos Creator 3.8 (TypeScript strict), box2d 2D physics, Vitest for unit tests, existing M01 preview smoke (`scripts/m01-preview-smoke.mjs`) for runtime verification.

---

## File Structure

| File | Purpose | Status |
|------|---------|--------|
| `assets/scripts/cocos/M01PhysicsRandom.ts` | `mulberry32` PRNG seeded from `Date.now()` (per-session) | NEW |
| `assets/scripts/cocos/M01PhysicsRotation.ts` | Stable-rest rotation chooser per shape (circle/triangle/hexagon) | NEW |
| `assets/scripts/cocos/M01PhysicsCollider.ts` | Build polygon points for each fragment shape | NEW |
| `assets/scripts/cocos/M01PhysicsBoundary.ts` | Full-width ground + screen-edge walls | NEW |
| `assets/scripts/cocos/M01PhysicsPile.ts` | Simultaneous sky-pile release + settle detection | NEW |
| `assets/scripts/cocos/M01GreyboxBootstrap.ts` | Wire physics into `start()`, modify drag handlers, modify snap path | MODIFY |
| `assets/scripts/cocos/M01GreyboxText.ts` | Add `"碎片正在落下..."` status string | MODIFY |
| `tests/cocos/M01PhysicsRandom.test.ts` | Verify PRNG determinism + distribution | NEW |
| `tests/cocos/M01PhysicsRotation.test.ts` | Verify stable rotation rules per shape | NEW |
| `tests/cocos/M01PhysicsCollider.test.ts` | Verify collider polygon geometry | NEW |
| `production/active.md` | Update current state | MODIFY |

**Pure files (TDD via Vitest):** Random, Rotation, Collider. These have no Cocos runtime dependency.

**Runtime files (verified via preview smoke):** Boundary, Pile, Bootstrap mods. These touch Cocos node/component APIs and are not feasible to unit-test without a Cocos headless runtime (which the project doesn't have).

---

## Task 1: Seeded PRNG

**Files:**
- Create: `assets/scripts/cocos/M01PhysicsRandom.ts`
- Test: `tests/cocos/M01PhysicsRandom.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/cocos/M01PhysicsRandom.test.ts
import { describe, expect, it } from "vitest";
import { createM01PhysicsRng } from "../../assets/scripts/cocos/M01PhysicsRandom.ts";

describe("createM01PhysicsRng", () => {
  it("produces values in [0, 1) for any seed", () => {
    const rng = createM01PhysicsRng(42);
    for (let i = 0; i < 100; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is deterministic for a given seed", () => {
    const a = createM01PhysicsRng(12345);
    const b = createM01PhysicsRng(12345);
    for (let i = 0; i < 10; i += 1) {
      expect(a()).toBe(b());
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = createM01PhysicsRng(1);
    const b = createM01PhysicsRng(2);
    expect(a()).not.toBe(b());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/danmac/liuhui-star-guardian && npm test -- tests/cocos/M01PhysicsRandom.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement minimal**

```typescript
// assets/scripts/cocos/M01PhysicsRandom.ts
/**
 * Mulberry32 PRNG. Deterministic and fast.
 * Use Date.now() as seed for per-session randomness, fixed integers for tests.
 */
export function createM01PhysicsRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/cocos/M01PhysicsRandom.test.ts`
Expected: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add assets/scripts/cocos/M01PhysicsRandom.ts tests/cocos/M01PhysicsRandom.test.ts
git commit -m "feat(m01): add seeded PRNG for physics pile randomness"
```

---

## Task 2: Stable rotation chooser

**Files:**
- Create: `assets/scripts/cocos/M01PhysicsRotation.ts`
- Test: `tests/cocos/M01PhysicsRotation.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/cocos/M01PhysicsRotation.test.ts
import { describe, expect, it } from "vitest";
import { pickStableRotation } from "../../assets/scripts/cocos/M01PhysicsRotation.ts";

describe("pickStableRotation", () => {
  it("returns a value in [0, 360) for circle (any rotation stable)", () => {
    for (let i = 0; i < 20; i += 1) {
      const r = pickStableRotation("circle", () => i / 20);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(360);
    }
  });

  it("returns one of {0, 120, 240} for triangle", () => {
    const allowed = new Set([0, 120, 240]);
    for (let i = 0; i < 30; i += 1) {
      const r = pickStableRotation("triangle", () => i / 30);
      expect(allowed.has(r)).toBe(true);
    }
  });

  it("returns one of {0, 60, 120, 180, 240, 300} for hexagon", () => {
    const allowed = new Set([0, 60, 120, 180, 240, 300]);
    for (let i = 0; i < 30; i += 1) {
      const r = pickStableRotation("hexagon", () => i / 30);
      expect(allowed.has(r)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cocos/M01PhysicsRotation.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement minimal**

```typescript
// assets/scripts/cocos/M01PhysicsRotation.ts
export type M01PhysicsShape = "circle" | "triangle" | "hexagon";

/**
 * Pick a physically stable rest rotation in degrees for a given shape.
 * - Circle: any angle (rotationally symmetric)
 * - Triangle: one of 3 stable bases (each puts a flat edge down)
 * - Hexagon: one of 6 stable bases (each puts a flat edge down)
 * rng(): supplies a value in [0,1).
 */
export function pickStableRotation(shape: M01PhysicsShape, rng: () => number): number {
  if (shape === "circle") {
    return Math.floor(rng() * 360);
  }
  if (shape === "triangle") {
    const choices = [0, 120, 240];
    return choices[Math.floor(rng() * choices.length)];
  }
  // hexagon
  const choices = [0, 60, 120, 180, 240, 300];
  return choices[Math.floor(rng() * choices.length)];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/cocos/M01PhysicsRotation.test.ts`
Expected: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add assets/scripts/cocos/M01PhysicsRotation.ts tests/cocos/M01PhysicsRotation.test.ts
git commit -m "feat(m01): add stable rest-rotation chooser per shape"
```

---

## Task 3: Collider polygon builder

**Files:**
- Create: `assets/scripts/cocos/M01PhysicsCollider.ts`
- Test: `tests/cocos/M01PhysicsCollider.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/cocos/M01PhysicsCollider.test.ts
import { describe, expect, it } from "vitest";
import { buildM01PhysicsCollider } from "../../assets/scripts/cocos/M01PhysicsCollider.ts";

describe("buildM01PhysicsCollider", () => {
  it("returns 3 points for triangle, apex up, flat bottom", () => {
    const result = buildM01PhysicsCollider("triangle", 36);
    expect(result.kind).toBe("polygon");
    expect(result.points).toHaveLength(3);
    // apex
    expect(result.points[0].y).toBeGreaterThan(0);
    // base corners at same y
    expect(result.points[1].y).toBe(result.points[2].y);
    expect(result.points[1].y).toBeLessThan(0);
  });

  it("returns 6 points for hexagon", () => {
    const result = buildM01PhysicsCollider("hexagon", 36);
    expect(result.kind).toBe("polygon");
    expect(result.points).toHaveLength(6);
  });

  it("returns radius for circle", () => {
    const result = buildM01PhysicsCollider("circle", 36);
    expect(result.kind).toBe("circle");
    expect(result.radius).toBe(18);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/cocos/M01PhysicsCollider.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement minimal**

```typescript
// assets/scripts/cocos/M01PhysicsCollider.ts
import type { M01PhysicsShape } from "./M01PhysicsRotation.ts";

export interface M01PhysicsPoint {
  x: number;
  y: number;
}

export type M01PhysicsColliderSpec =
  | { kind: "circle"; radius: number }
  | { kind: "polygon"; points: M01PhysicsPoint[] };

/**
 * Build the collider geometry for a fragment shape, centered at origin.
 * Size is the bounding diameter (the larger of width/height).
 */
export function buildM01PhysicsCollider(
  shape: M01PhysicsShape,
  size: number
): M01PhysicsColliderSpec {
  const r = size / 2;
  if (shape === "circle") {
    return { kind: "circle", radius: r };
  }
  if (shape === "triangle") {
    // Equilateral triangle inscribed in circle of radius r, apex up
    const points: M01PhysicsPoint[] = [
      { x: 0, y: r },
      { x: -r * Math.sin(Math.PI / 3), y: -r / 2 },
      { x: r * Math.sin(Math.PI / 3), y: -r / 2 }
    ];
    return { kind: "polygon", points };
  }
  // hexagon, flat-top orientation (horizontal edges at top and bottom)
  // Vertices at 0°, 60°, 120°, 180°, 240°, 300° — i.e. angle = (π/3)·i, no offset.
  // This places a flat edge against the ground at rotation=0, matching the
  // stable-rotation chooser which returns multiples of 60°.
  const points: M01PhysicsPoint[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i;
    points.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
  }
  return { kind: "polygon", points };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- tests/cocos/M01PhysicsCollider.test.ts`
Expected: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add assets/scripts/cocos/M01PhysicsCollider.ts tests/cocos/M01PhysicsCollider.test.ts
git commit -m "feat(m01): add collider polygon builder for fragment shapes"
```

---

## Task 4: Physics boundary component

**Files:**
- Create: `assets/scripts/cocos/M01PhysicsBoundary.ts`

No unit test — pure runtime component (Cocos node creation, requires editor or live preview).

- [ ] **Step 1: Implement**

```typescript
// assets/scripts/cocos/M01PhysicsBoundary.ts
import {
  _decorator,
  BoxCollider2D,
  Component,
  Node,
  RigidBody2D,
  ERigidBody2DType,
  Vec2
} from "cc";

const { ccclass } = _decorator;

const GROUND_DISPLAY_WIDTH = 960;
const PHYSICS_GROUND_Y = -270;
const PHYSICS_SCREEN_LEFT_X = -GROUND_DISPLAY_WIDTH / 2;
const PHYSICS_SCREEN_RIGHT_X = GROUND_DISPLAY_WIDTH / 2;
const PHYSICS_WALL_MAX_Y = 360;
const WALL_THICKNESS = 40;

@ccclass("M01PhysicsBoundary")
export class M01PhysicsBoundary extends Component {
  spawnWalls(): void {
    this.spawnEdge("M01PhysicsGround", 0, PHYSICS_GROUND_Y - WALL_THICKNESS / 2, GROUND_DISPLAY_WIDTH, WALL_THICKNESS);
    this.spawnEdge("M01PhysicsLeftWall", PHYSICS_SCREEN_LEFT_X - WALL_THICKNESS / 2, (PHYSICS_GROUND_Y + PHYSICS_WALL_MAX_Y) / 2, WALL_THICKNESS, PHYSICS_WALL_MAX_Y - PHYSICS_GROUND_Y);
    this.spawnEdge("M01PhysicsRightWall", PHYSICS_SCREEN_RIGHT_X + WALL_THICKNESS / 2, (PHYSICS_GROUND_Y + PHYSICS_WALL_MAX_Y) / 2, WALL_THICKNESS, PHYSICS_WALL_MAX_Y - PHYSICS_GROUND_Y);
  }

  private spawnEdge(name: string, cx: number, cy: number, w: number, h: number): void {
    const node = new Node(name);
    node.setPosition(cx, cy, 0);
    this.node.addChild(node);

    const body = node.addComponent(RigidBody2D);
    body.type = ERigidBody2DType.Static;
    body.gravityScale = 0;

    const collider = node.addComponent(BoxCollider2D);
    collider.size = new Vec2(w, h);
    collider.friction = 0.6;
    collider.restitution = 0;
    collider.apply();
  }
}
```

- [ ] **Step 2: Visual check planned via preview**

Run later in Task 8 after physics is wired up. The walls are invisible (no rendering); their presence is verified by pieces not falling out of bounds.

- [ ] **Step 3: Commit**

```bash
git add assets/scripts/cocos/M01PhysicsBoundary.ts
git commit -m "feat(m01): add physics boundary (ground + left/right walls)"
```

---

## Task 5: Physics pile controller

> Method name note: Cocos `Component` already has a reserved `start()` lifecycle method. We use `startDrop()` (not `start_pile`) to avoid collision and improve readability.


**Files:**
- Create: `assets/scripts/cocos/M01PhysicsPile.ts`

This is the controller that:
1. Initializes per-fragment `RigidBody2D` + collider
2. Releases all fragments from top-edge pile offsets in one natural free-fall
3. Detects settle by velocity thresholds, circle separation, or timeout
4. Emits an `onSettled` callback

No unit test — full Cocos runtime component.

- [ ] **Step 1: Implement**

```typescript
// assets/scripts/cocos/M01PhysicsPile.ts
import {
  _decorator,
  CircleCollider2D,
  Component,
  Node,
  PhysicsSystem2D,
  PolygonCollider2D,
  RigidBody2D,
  ERigidBody2DType,
  Vec2
} from "cc";

import { createM01PhysicsRng } from "./M01PhysicsRandom.ts";
import { pickStableRotation, type M01PhysicsShape } from "./M01PhysicsRotation.ts";
import { buildM01PhysicsCollider } from "./M01PhysicsCollider.ts";

const { ccclass } = _decorator;

export interface M01PhysicsPileFragment {
  node: Node;
  shape: M01PhysicsShape;
  size: number;
}

export interface M01PhysicsPileOptions {
  fragments: M01PhysicsPileFragment[];
  seed: number;                       // Date.now() in prod, fixed in tests/snapshots
  dropOriginX: number;                 // 320 (FRAGMENT_FLOOR center X)
  dropOriginY: number;                 // 350 (top-edge sky pile)
  jitterX: number;                     // 82 (scales the compact pile offsets)
  settleTimeoutMs: number;             // max settle window
  onSettled: () => void;
}

@ccclass("M01PhysicsPile")
export class M01PhysicsPile extends Component {
  private options: M01PhysicsPileOptions | null = null;
  private settleDeadlineMs = 0;
  private settleCheckArmed = false;
  private stableSettleFrames = 0;

  startDrop(options: M01PhysicsPileOptions): void {
    this.options = options;
    PhysicsSystem2D.instance.enable = true;
    PhysicsSystem2D.instance.gravity = new Vec2(0, -640);
    PhysicsSystem2D.instance.fixedTimeStep = 1 / 60;

    const rng = createM01PhysicsRng(options.seed);
    const order = this.shuffleIndices(options.fragments.length, rng);
    this.releaseAllPiecesFromSky(order, rng);

    this.settleDeadlineMs = Date.now() + options.settleTimeoutMs;
    this.settleCheckArmed = true;
  }

  private shuffleIndices(n: number, rng: () => number): number[] {
    const arr = Array.from({ length: n }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private releaseAllPiecesFromSky(order: number[], rng: () => number): void {
    if (!this.options) return;
    order.forEach((fragIndex, skyIndex) => {
      // Current implementation maps the shuffled pieces onto a fixed 4-3-2
      // sky-pile template, then lets gravity create the final pile.
      const pileOffset = this.resolveSkyPileOffset(skyIndex);
      const driftX = (rng() * 2 - 1) * 5;
      const driftY = (rng() * 2 - 1) * 4;
      this.releaseOnePieceFromSky(
        this.options!.fragments[fragIndex],
        this.options!.dropOriginX + pileOffset.x * this.options!.jitterX + driftX,
        this.options!.dropOriginY + pileOffset.y + driftY,
        rng
      );
    });
  }

  private ensureCollider(frag: M01PhysicsPileFragment): void {
    const existing = frag.node.getComponent(PolygonCollider2D) ?? frag.node.getComponent(CircleCollider2D);
    if (existing) return;

    const spec = buildM01PhysicsCollider(frag.shape, frag.size);
    if (spec.kind === "circle") {
      const c = frag.node.addComponent(CircleCollider2D);
      c.radius = spec.radius;
      c.friction = 0.6;
      c.restitution = 0.02;
      c.density = 1;
      c.apply();
    } else {
      const c = frag.node.addComponent(PolygonCollider2D);
      c.points = spec.points.map((p) => new Vec2(p.x, p.y));
      c.friction = 0.6;
      c.restitution = 0.02;
      c.density = 1;
      c.apply();
    }
  }

  onDestroy(): void {
    this.dropTimeouts.forEach(clearTimeout);
    if (this.settleTimeout) clearTimeout(this.settleTimeout);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes (or only errors unrelated to new files)

- [ ] **Step 3: Commit**

```bash
git add assets/scripts/cocos/M01PhysicsPile.ts
git commit -m "feat(m01): add physics pile controller with sky-pile release"
```

---

## Task 6: Add settle status string

**Files:**
- Modify: `assets/scripts/cocos/M01GreyboxText.ts`

- [ ] **Step 1: Add the new string key**

Open `M01GreyboxText.ts`, locate the text-key block (near top, line ~9). Add `physicsSettling: "碎片正在落下..."` to both the default literal map and the `M01GreyboxTextOverrides` interface.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes

- [ ] **Step 3: Commit**

```bash
git add assets/scripts/cocos/M01GreyboxText.ts
git commit -m "feat(m01): add physics settling status text"
```

---

## Task 7: Wire physics into bootstrap start()

**Files:**
- Modify: `assets/scripts/cocos/M01GreyboxBootstrap.ts` (the `start()` method at line 229, plus add private fields + helper methods)

- [ ] **Step 1: Add private state and helpers**

Near the other private fields (around line 224), add:
```typescript
private physicsBoundary: M01PhysicsBoundary | null = null;
private physicsPile: M01PhysicsPile | null = null;
private physicsSettled = false;
```

Add imports at top:
```typescript
import { M01PhysicsBoundary } from "./M01PhysicsBoundary.ts";
import { M01PhysicsPile } from "./M01PhysicsPile.ts";
import type { M01PhysicsShape } from "./M01PhysicsRotation.ts";
```

- [ ] **Step 2: Modify `start()` to spawn physics**

After the existing layout/render setup (after line ~245 where `renderGreybox` finishes), add:

```typescript
// Attach physics boundary to greybox root
this.physicsBoundary = this.greyboxRoot!.addComponent(M01PhysicsBoundary);

// Attach physics pile
this.physicsPile = this.greyboxRoot!.addComponent(M01PhysicsPile);

const physicsFragments: { node: Node; shape: M01PhysicsShape; size: number }[] = [];
for (const fragmentToken of this.layout!.fragments) {
  const entry = this.greyboxNodes.get(fragmentToken.controllerId);
  if (!entry) continue;
  physicsFragments.push({
    node: entry.node,
    shape: fragmentToken.shapeToken as M01PhysicsShape,
    size: Math.max(fragmentToken.size.width, fragmentToken.size.height)
  });
}

// Attach physics components while fragment nodes are active
this.physicsPile.preparePhysicsWorld(physicsFragments, this.physicsBoundary);
this.physicsBoundary.renderGroundLine();

// Lock input + show status
this.physicsSettled = false;
this.setStatus(this.formatText("physicsSettling", {}));

// Start the drop
this.physicsPile.startDrop({
  fragments: physicsFragments,
  seed: Date.now(),
  dropOriginX: 320,
  dropOriginY: 350,
  jitterX: 82,
  settleTimeoutMs: 3600,
  onSettled: () => {
    this.physicsSettled = true;
    this.setStatus(this.layout!.statusText);
  }
});
```

- [ ] **Step 3: Reject drag when not settled**

In `beginTokenDrag` (line 1447), at the start, add:

```typescript
if (token.kind === "fragment" && !this.physicsSettled) {
  return;
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: passes

- [ ] **Step 5: Cocos preview smoke**

```bash
cd /Users/danmac/liuhui-star-guardian
npm run smoke:m01-preview-refresh
```

Then open Cocos preview in browser, check:
- Pieces fall from above
- Pile settles in the middle-bottom area
- Status text shows "碎片正在落下..." then reverts
- Dragging is locked until settled (~2.5 seconds)

If pieces don't fall: check console for physics-system-not-enabled errors, verify `engine.json` has `physics-2d-box2d` in modules (it does).

- [ ] **Step 6: Commit**

```bash
git add assets/scripts/cocos/M01GreyboxBootstrap.ts
git commit -m "feat(m01): wire physics pile into M01 bootstrap start()"
```

---

## Task 8: Drag becomes Kinematic

**Files:**
- Modify: `assets/scripts/cocos/M01GreyboxBootstrap.ts` (`beginTokenDrag`, `moveTokenDrag`, `endTokenDrag` methods)

- [ ] **Step 1: On drag begin, switch fragment body to Kinematic**

In `beginTokenDrag` (after the gates), for `token.kind === "fragment"`, before `node.setPosition(...)`:

```typescript
if (token.kind === "fragment") {
  const body = node.getComponent(RigidBody2D);
  if (body) {
    body.type = ERigidBody2DType.Kinematic;
    body.linearVelocity = new Vec2(0, 0);
    body.angularVelocity = 0;
  }
}
```

Imports needed at top:
```typescript
import { CircleCollider2D, PolygonCollider2D, RigidBody2D, ERigidBody2DType, Vec2 } from "cc";
```

- [ ] **Step 2: On drag move, temporarily remove the held piece from physics collisions**

In `moveTokenDrag` (line 1579), the existing logic writes `node.setPosition(...)`. For fragments, change to:

```typescript
const target = this.eventToLocalPoint(event);
this.setFragmentPointerControl(node, true);
node.setPosition(target.x + grabOffset.x, target.y + grabOffset.y, 0);
```

- [ ] **Step 3: On drag-end fallback (no snap), switch back to Dynamic**

The "snap failed → return to origin" path is centralized in `resetTokenNode` (line 2331). All action handlers (`weak_snap_fragment`, `snap_fragment_to_target_piece`, `place_fragment_freely`, cancel path at line 1645, etc.) call `resetTokenNode` when their snap check fails. So the cleanest place to switch back to Dynamic is inside `resetTokenNode` itself:

```typescript
private resetTokenNode(node: Node, token: M01GreyboxTokenNode): void {
  node.setPosition(token.position.x, token.position.y, 0);
  node.setRotationFromEuler(0, 0, this.tokenRotations.get(token.controllerId) ?? 0);
  this.tokenPositions.set(token.controllerId, token.position);
  this.redrawAndPersistManualTargetDraft();

  // NEW: if this is a fragment with a physics body, switch back to Dynamic
  // so it falls under gravity instead of teleporting to its JSON-config grid position.
  if (token.kind === "fragment") {
    const body = node.getComponent(RigidBody2D);
    if (body) {
      body.type = ERigidBody2DType.Dynamic;
      body.linearVelocity = new Vec2(0, 0);
      body.angularVelocity = 0;
    }
  }
}
```

**Important nuance:** `resetTokenNode` writes `token.position` (the static JSON-config grid position) as the node position. Under physics, this is wrong — the fragment should fall from where the player released it, not teleport to a grid coordinate.

Fix: when the token is a fragment with an active physics body, **skip the `node.setPosition` call** and let physics keep the current position, then switch to Dynamic. Revised:

```typescript
private resetTokenNode(node: Node, token: M01GreyboxTokenNode): void {
  if (token.kind === "fragment") {
    const body = node.getComponent(RigidBody2D);
    if (body) {
      // Physics-controlled fragment: leave it where it is, let gravity take over.
      body.type = ERigidBody2DType.Dynamic;
      body.linearVelocity = new Vec2(0, 0);
      body.angularVelocity = 0;
      return;
    }
  }

  // Non-physics path (filters, flashlights, slots, or fragment before physics enabled)
  node.setPosition(token.position.x, token.position.y, 0);
  node.setRotationFromEuler(0, 0, this.tokenRotations.get(token.controllerId) ?? 0);
  this.tokenPositions.set(token.controllerId, token.position);
  this.redrawAndPersistManualTargetDraft();
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: passes

- [ ] **Step 5: Cocos preview smoke**

Open preview, try:
- Drag a piece from the pile — surrounding pieces should re-settle naturally
- Release outside any target — piece falls back to pile
- Release on a valid target — handled in Task 9 (just don't crash here)

- [ ] **Step 6: Commit**

```bash
git add assets/scripts/cocos/M01GreyboxBootstrap.ts
git commit -m "feat(m01): switch fragment body to Kinematic during drag"
```

---

## Task 9: Snap success path keeps body Kinematic

**Files:**
- Modify: `assets/scripts/cocos/M01GreyboxBootstrap.ts`

**Background:** The drag-end dispatch (around line 1813 onward) hands off to four action types from `resolveM01GreyboxDrop`:

1. `weak_snap_fragment` (line 1861) — fragment lightly snapped to an evidence; calls `trackWeakSnappedFragment(evidenceId, fragmentId)` (line 1871) + `snapNodeToEvidence(node, token, evidenceId, dropPosition)` (line 1872)
2. `snap_fragment_to_target_piece` (line 1882) — fragment positioned at a target-piece slot; calls `removeWeakSnappedFragment(fragmentId)` (line 1892) + writes `node.setPosition(action.position...)` (line 1900)
3. `place_fragment_freely` (line 1910) — fragment placed at an arbitrary point in the floor area
4. Fallback (line 1935) — `resetTokenNode` (handled by Task 8 Step 3)

Snap state is tracked **on the Bootstrap**, not the session, in `weakSnappedFragmentsByEvidence: Map<string, string[]>` (declared near line 224), via the private methods `trackWeakSnappedFragment` (line 2066) and `removeWeakSnappedFragment` (line 2073). Do **not** add new methods on `M01GreyboxSession` — work with what's there.

- [ ] **Step 1: Add a helper for the snap-success body transition**

In `M01GreyboxBootstrap.ts`, near the other physics-related private methods, add:

```typescript
private parkFragmentBodyAtSnap(fragmentNode: Node): void {
  const body = fragmentNode.getComponent(RigidBody2D);
  if (!body) return;
  body.type = ERigidBody2DType.Kinematic;
  body.linearVelocity = new Vec2(0, 0);
  body.angularVelocity = 0;
}
```

- [ ] **Step 2: Call it from `weak_snap_fragment` success branch**

In the `weak_snap_fragment` handler (around line 1872), after `this.snapNodeToEvidence(...)`:

```typescript
this.trackWeakSnappedFragment(action.evidenceId, action.fragmentId);
this.snapNodeToEvidence(node, token, action.evidenceId, dropPosition);
this.parkFragmentBodyAtSnap(node);   // NEW
```

- [ ] **Step 3: Call it from `snap_fragment_to_target_piece` success branch**

In the `snap_fragment_to_target_piece` handler (around line 1900), after `node.setPosition(action.position.x, action.position.y, 0)`:

```typescript
node.setPosition(action.position.x, action.position.y, 0);
node.setRotationFromEuler(0, 0, action.rotation);
this.parkFragmentBodyAtSnap(node);   // NEW
```

- [ ] **Step 4: Re-pickable behavior is automatic**

When a snapped piece is touched again, `beginTokenDrag` (Task 8 Step 1) flips its body back to Kinematic with zero velocities (already Kinematic from snap, so this is effectively a velocity reset — fine). The existing handlers `trackWeakSnappedFragment` / `removeWeakSnappedFragment` are already invoked by `weak_snap_fragment` / `snap_fragment_to_target_piece` / `place_fragment_freely` action paths, so the snap state is correctly cleared when the piece is moved away. **No new session methods needed.**

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`

- [ ] **Step 6: Cocos preview smoke**

- Drop piece onto correct evidence target — piece sticks (Kinematic), evidence fires
- Drop piece onto wrong target — `resetTokenNode` returns Dynamic + falls back to pile (Task 8 Step 3)
- Drop piece onto correct target, then pick it back up — body transitions Kinematic→Kinematic (no-op effectively); on release elsewhere, returns to Dynamic
- Evidence should "un-fire" when piece is dragged away (existing logic via `removeWeakSnappedFragment` handles this)

- [ ] **Step 7: Commit**

```bash
git add assets/scripts/cocos/M01GreyboxBootstrap.ts
git commit -m "feat(m01): park snapped fragments as Kinematic so they remain pickable"
```

---

## Task 10: Run full test suite and fix regressions

- [ ] **Step 1: Run all tests**

```bash
cd /Users/danmac/liuhui-star-guardian
npm test
```

Expected: most pass. Any failures are likely tests that assume fragments are at the JSON-defined grid positions. Investigate each failure:

- If the test inspects `layout.fragments[i].position` (the layout-builder output), it should still pass — `M01GreyboxLayout` doesn't go through physics.
- If the test simulates a drop via `resolveM01GreyboxDrop(...)`, those are pure-function tests on the layout snapshot — unaffected.
- If the test inspects post-drag runtime positions in a way that depended on the old grid, that's a real test to update (likely 0-2 tests).

- [ ] **Step 2: Fix any genuine regressions**

For each failing test:
1. Read the failure
2. Decide: is the test still meaningful under physics? If yes, adapt the test. If it depended on tidy-grid assumptions, document the change in the commit message.

- [ ] **Step 3: Re-run**

```bash
npm test
```
Expected: green

- [ ] **Step 4: Commit (if fixes were needed)**

```bash
git add tests/...
git commit -m "test(m01): adapt fragment-position tests for physics pile"
```

---

## Task 11: Run M01 preview smoke

- [ ] **Step 1: Refresh + smoke**

```bash
cd /Users/danmac/liuhui-star-guardian
npm run smoke:m01-preview-refresh
npm run smoke:m01-preview -- --enable-art-preview
```

Expected:
- `completed = true` (puzzle still solvable end-to-end)
- No console errors
- `usedFallback = false`

The smoke script doesn't know about physics, but it should still drive the puzzle to completion via the same drag interactions. If the script's hardcoded drag targets miss because pieces are now in different (physics-determined) positions, update the script to find pieces by `controllerId` and read their current `node.position` at runtime rather than assuming JSON coords.

- [ ] **Step 2: Capture screenshot**

The smoke script writes `temp/m01-art-preview-clean-qa.png`. Open it and confirm the pile looks natural (pieces stacked, no overlap, sane positions).

- [ ] **Step 3: Commit any smoke-script updates**

```bash
git add scripts/m01-preview-smoke.mjs
git commit -m "test(m01): update preview smoke to read fragment positions at runtime"
```

---

## Task 12: Manual Cocos preview verification

- [ ] **Step 1: Open Cocos preview**

In the Cocos editor, run preview on `assets/scenes/M01Greybox.scene`. Watch:
1. Empty floor at start
2. 9 pieces fall from top one by one
3. Status text reads "碎片正在落下..."
4. Pile settles in ~2.5 seconds
5. Status reverts to normal
6. Drag is enabled
7. Picking a piece causes pile to re-settle
8. Releasing on a target keeps the piece there
9. Picking the snapped piece back is possible

- [ ] **Step 2: Edge cases to spot-check**

- Drop a piece off-target → it falls back into the pile cleanly (no spinning forever)
- Pick the bottom-most piece in the pile → the upper pieces collapse and re-settle
- Pick and place multiple pieces in a row → no piece gets lost or stuck

If any edge case is broken, log the symptom and either fix in-line (small) or add a follow-up task.

- [ ] **Step 3: Take notes for production/active.md**

---

## Task 13: Update production/active.md

**Files:**
- Modify: `production/active.md`

- [ ] **Step 1: Append a new dated entry**

Append a new section dated 2026-05-21 describing what shipped:
- M01 fragments now use Cocos box2d 2D physics
- Pieces fall from above at level open as a visible animation
- Snap-to-target keeps pieces Kinematic (still pickable)
- Verification: `npm test`, `npm run smoke:m01-preview-refresh`, `npm run smoke:m01-preview:input -- --enable-art-preview --capture-clean-qa`, manual Cocos preview
- Reference: `docs/plans/2026-05-21-m01-physics-pile-design.md`, `docs/plans/2026-05-21-m01-physics-pile-plan.md`

- [ ] **Step 2: Commit**

```bash
git add production/active.md
git commit -m "docs: log m01 physics pile implementation in active.md"
```

---

## Final Verification Checklist

- [ ] `npm test` green
- [ ] `npm run typecheck` green
- [ ] `npm run smoke:m01-preview-refresh` 5/5 steps OK
- [ ] Smoke script reports `completed=true, usedFallback=false, no console errors`
- [ ] Manual Cocos preview: pieces fall, settle, drag works, snap keeps Kinematic, can be re-picked
- [ ] `git diff --check` clean
- [ ] All commits land on `main` (work happens in main repo, not worktree, since Cocos editor opens main)

## Spec Deviation Note: `static` Test Mode

The spec (`docs/plans/2026-05-21-m01-physics-pile-design.md`) proposes a `M01PhysicsMode = "physics" | "static"` config switch and a `physics: { mode, gravity, seed }` block in `m01-memory-gear.json`, with `static` mode skipping physics entirely and using hardcoded positions for tests.

**This plan defers `static` mode** because:

- Existing tests are pure-functional (they test `M01GreyboxLayout`, `resolveM01GreyboxDrop`, `M01GreyboxSession` — none of which load Cocos runtime physics)
- The runtime physics code lives in `M01GreyboxBootstrap` and the new physics files, none of which are exercised by Vitest tests
- So most tests should pass unchanged (Task 10 verifies this)

**If Task 10 surfaces more than ~3 test failures that genuinely depend on physics behavior**, stop and add Task 10.5: implement the spec's `static` mode as a build/test escape hatch. Otherwise, the simpler path of "fix failing tests case-by-case" is preferred. Update the spec post-implementation to reflect what actually shipped.

## Sanity Checks Before Implementation

- [ ] Verify `settings/v2/packages/engine.json` `_option` is `"physics-2d-box2d"` (already confirmed during planning, but re-check before starting Task 4)
- [ ] Verify drop origin Y=200 lands pieces visually inside the flashlight cone — the cone narrows toward the floor, so a higher drop origin = narrower landing X range. If the pile lands outside the cone, lower the drop origin or widen `jitterX`. This is a Task 7 Step 5 visual check.

## Out of Scope (Follow-up Plans)

- Snapped-piece visual fade animation at completion (currently piece just stays where it was snapped)
- Tuning physics constants (gravity, friction, drop delay) — done by feel during Task 12 if needed
- Performance profiling on low-end mobile (target ≥30fps per `.claude/rules/shaders.md`)
- Migrating other M-stage levels to physics-piled fragments (M02+ not in scope here)
- Implementing spec's `static` test mode (deferred — see "Spec Deviation Note")

## Risks

1. **Cocos box2d on WeChat Mini Game** — needs platform-specific build verification, not done in this plan
2. **Smoke script drag coordinates** — if `scripts/m01-preview-smoke.mjs` hardcodes drag start positions matching the old grid, Task 11 Step 1 will surface this
3. **Test brittleness around fragment positions** — Task 10 covers; if more than ~3 tests break, consider adding a `static` test-mode escape hatch as originally designed in the spec
