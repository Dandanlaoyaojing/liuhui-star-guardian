# Lemmy Machinarium-Style Motion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Machinarium-style, precise, smooth-enough Lemmy motion system for M01 intro, using the approved Lemmy prototype as the only identity reference.

**Architecture:** Use code-driven 2D hand-drawn frame animation in Cocos, not Spine, physics-driven character motion, or editor-authored `.anim` files for the first pass. Add a reusable `LemmyActor` component with frame tables, frame events, `walkTo()`, `playAction()`, and callbacks; wire M01 intro through interaction anchors and contact-frame events. Keep the first implementation M01-scoped, but shape APIs so later scenes can add paths, Z sorting, and richer actions without rewriting the actor.

**Tech Stack:** Cocos Creator 3.8 TypeScript, `Sprite` / `SpriteFrame`, `resources.load`, `tween`, Vitest text/scaffold tests, Playwright preview probes.

---

## Product Direction

The target is not "smooth cartoon animation." The target is a small point-and-click performance system similar in spirit to Machinarium:

- Lemmy walks to an exact approach point.
- Lemmy faces the intended object.
- Lemmy plays an authored action.
- A specific contact frame triggers the world response.
- The action has anticipation, contact, recovery, and a return to idle.
- The character keeps the hand-drawn, slightly imperfect paper-world feel.

For this pass, use only the approved Lemmy prototype:

- `docs/design/style-references/2026-04-24-lemmy-rabbit-style-reference.png`
- `assets/art/style-references/lemmy-rabbit-style-reference.png`

Do not use these as Lemmy identity references:

- `temp/luma-intro/lemmy-*-raw.png`
- Desktop `bunny-turnaround-v5.png`
- Any Luma rabbit variants that look like a different rabbit

The current runtime stand-in sprites may remain temporary, but all future action frames must derive from the approved Lemmy prototype.

## Scope

### In Scope For M01

- `idle_right`: 6 to 8 frames, ping-pong loop.
- `walk_right`: 12 frames, loop.
- `reach_up_right`: 8 to 10 frames, non-looping, with one contact event.
- `exit_walk_right`: reuse `walk_right`.
- `LemmyActor` component with a code-driven frame table.
- `M01IntroSequence` refactor to call `LemmyActor`.
- M01 intro anchor data:
  - enter from left edge
  - walk to basket approach point
  - play reach
  - trigger basket wobble on contact frame
  - walk to right-side watching point
- Basic actor diagnostics for preview verification.

### Explicitly Out Of Scope For This Pass

- Full 10-level Lemmy behavior library.
- Left/right hand-drawn direction pairs.
- Walkable area masks.
- Multi-waypoint pathfinding.
- Complex front/back depth sorting across all objects.
- Final audio production.
- Final high-polish hand-drawn frame set.

These are not rejected. They are planned as follow-up layers once M01 proves the architecture.

## Design Decisions

### 1. Code-Driven Frame Player First

Do not start with Cocos `.anim` files. They are editor-friendly but agent-hostile and harder to test in this workflow.

Create a small TypeScript frame player:

```ts
export type LemmyActionId =
  | "idle_right"
  | "walk_right"
  | "reach_up_right";

export interface LemmyFrameSpec {
  resourceId: LemmyFrameResourceId;
  durationMs: number;
  event?: "reach_contact";
}

export interface LemmyActionClip {
  id: LemmyActionId;
  loop: boolean;
  pingPong?: boolean;
  frames: LemmyFrameSpec[];
}
```

This lets tests assert frame counts, timing, event placement, and M01 contact behavior without opening the Cocos editor.

### 2. Separate Actor From Scene Script

`M01IntroSequence` should remain the scene choreography:

- spawn ropes and basket
- stage puzzle pieces
- listen for basket tap
- call actor actions
- tip basket
- release physics pieces

`LemmyActor` should own character motion:

- sprite loading
- frame playback
- `walkTo(target, options)`
- `playAction(actionId, options)`
- event callback dispatch
- idle loop

The intro should not manually swap Lemmy sprite frames once this refactor is complete.

### 3. Frame Events Trigger World State

The basket must not wobble after an arbitrary timeout. It should wobble from the `reach_contact` frame in `reach_up_right`.

Example M01 flow:

```ts
await actor.walkTo({ x: 290, y: -190 }, { action: "walk_right", durationMs: 1800 });
await actor.playAction("reach_up_right", {
  onFrameEvent: (event) => {
    if (event === "reach_contact") {
      this.wobbleBasket();
    }
  }
});
```

If `wobbleBasket()` starts a tween, the actor action should continue through recovery frames while the basket motion begins.

### 4. Use Interaction Anchors

Add a small M01-local anchor object before generalizing:

```ts
const M01_INTRO_ANCHORS = {
  basketReach: {
    approachPoint: { x: 290, y: -190 },
    facing: "right",
    action: "reach_up_right",
    contactEvent: "reach_contact"
  },
  watchingPoint: {
    approachPoint: { x: 470, y: -190 },
    facing: "right",
    action: "walk_right"
  }
} as const;
```

This is the seed of a future adventure-game interaction system without forcing the whole architecture now.

### 5. Preserve A Path To Machinarium-Level Polish

M01 first pass uses right-facing frames only because the current intro moves left to right. Later, true Machinarium polish should add:

- left/right hand-drawn frame sets, not `scaleX = -1`
- per-action sounds
- Y sorting
- walkable areas and waypoints
- object-specific action variants

Do not claim those are done in M01. Only keep the APIs compatible with them.

## Asset Strategy

### Phase A: Generated Stand-In Frames

For the first implementation, generate temporary frames from the approved Lemmy prototype:

- Use the current approved Lemmy crop as frame identity.
- Add tiny code/process-generated offsets, squash, rotation, and ear bob only if the final PNG frames remain obviously the approved Lemmy.
- Name frames as if they are real production frames, so future replacement is a pure asset swap.

Suggested paths:

```text
assets/resources/art/stage1-m01/runtime-sprites/lemmy/idle-right/m01-lemmy-idle-right-00.png
assets/resources/art/stage1-m01/runtime-sprites/lemmy/idle-right/m01-lemmy-idle-right-01.png
assets/resources/art/stage1-m01/runtime-sprites/lemmy/walk-right/m01-lemmy-walk-right-00.png
assets/resources/art/stage1-m01/runtime-sprites/lemmy/reach-up-right/m01-lemmy-reach-up-right-00.png
```

Add matching `.meta` files through Cocos refresh, not hand-authored JSON unless necessary.

### Phase B: Real Hand-Drawn Frames

Once the actor system works, replace the temporary frames with hand-drawn/generated frames:

- `idle_right`: 6-8 frames
- `walk_right`: 12 frames
- `reach_up_right`: 8-10 frames

The test should continue to check frame count and resource presence, not pixel identity. A separate art review should judge visual identity.

## File Plan

### Create

- `assets/scripts/cocos/LemmyActor.ts`
- `tests/cocos/LemmyActor.test.ts`
- `docs/plans/2026-05-27-lemmy-machinarium-motion-plan.md`

### Modify

- `assets/scripts/cocos/M01IntroSequence.ts`
- `assets/scripts/cocos/M01GreyboxArt.ts`
- `assets/scripts/cocos/cc-shim.d.ts`
- `tests/cocosProjectScaffold.test.ts`
- `tests/cocos/M01GreyboxArt.test.ts`
- `production/active.md`

### Asset Directories

- `assets/resources/art/stage1-m01/runtime-sprites/lemmy/idle-right/`
- `assets/resources/art/stage1-m01/runtime-sprites/lemmy/walk-right/`
- `assets/resources/art/stage1-m01/runtime-sprites/lemmy/reach-up-right/`

## Implementation Tasks

### Task 1: Define Lemmy Action Manifest

**Files:**
- Modify: `assets/scripts/cocos/M01GreyboxArt.ts`
- Test: `tests/cocos/M01GreyboxArt.test.ts`

**Step 1: Write failing test**

Add a test that asserts:

- Lemmy action resources exist for `idle_right`, `walk_right`, `reach_up_right`.
- `idle_right` has at least 6 frames.
- `walk_right` has exactly 12 frames.
- `reach_up_right` has at least 8 frames.
- All resource load paths start with `art/stage1-m01/runtime-sprites/lemmy/`.

**Step 2: Run red test**

Run:

```bash
npm test -- tests/cocos/M01GreyboxArt.test.ts -t "Lemmy action"
```

Expected: fails because the manifest does not exist yet.

**Step 3: Implement manifest**

Add typed resource IDs and action frame definitions in `M01GreyboxArt.ts`.

Do not remove the existing intro resource entries yet. They can coexist until `M01IntroSequence` is migrated.

**Step 4: Run green test**

Run:

```bash
npm test -- tests/cocos/M01GreyboxArt.test.ts -t "Lemmy action"
```

Expected: passes once placeholder assets exist.

### Task 2: Generate Temporary Canonical Lemmy Frames

**Files:**
- Create PNG frames under `assets/resources/art/stage1-m01/runtime-sprites/lemmy/`
- Test: `tests/cocos/M01GreyboxArt.test.ts`

**Step 1: Write failing pixel/resource test**

Extend the manifest test to verify every frame:

- is a PNG
- has transparent corners
- has non-trivial opaque content
- has a tall Lemmy-like bounding box

**Step 2: Run red test**

Run:

```bash
npm test -- tests/cocos/M01GreyboxArt.test.ts -t "Lemmy action"
```

Expected: fails because frames are missing.

**Step 3: Generate frames**

Use the approved prototype as the only source:

```text
assets/art/style-references/lemmy-rabbit-style-reference.png
```

Generate temporary frames with subtle transform differences. Keep the prototype recognizable. No Luma rabbit source images.

**Step 4: Refresh Cocos assets**

Refresh the new asset directory in Cocos so `.meta` files are created.

**Step 5: Run green test**

Run:

```bash
npm test -- tests/cocos/M01GreyboxArt.test.ts -t "Lemmy action"
```

Expected: passes.

### Task 3: Add `LemmyActor`

**Files:**
- Create: `assets/scripts/cocos/LemmyActor.ts`
- Modify: `assets/scripts/cocos/cc-shim.d.ts`
- Test: `tests/cocos/LemmyActor.test.ts`

**Step 1: Write failing tests**

Test pure helpers exported from `LemmyActor.ts`:

- `getLemmyActionClip("walk_right")` returns 12 frames and loops.
- `getLemmyActionClip("reach_up_right")` contains exactly one `reach_contact` event.
- `estimateLemmyActionDurationMs("reach_up_right")` equals the sum of frame durations.
- invalid action IDs are rejected or return `undefined`, depending on chosen API.

**Step 2: Run red test**

Run:

```bash
npm test -- tests/cocos/LemmyActor.test.ts
```

Expected: fails because `LemmyActor.ts` does not exist.

**Step 3: Implement helpers and component skeleton**

`LemmyActor` should expose:

```ts
export class LemmyActor extends Component {
  init(options: LemmyActorOptions): void;
  walkTo(target: Vec3, options?: LemmyWalkOptions): Promise<void>;
  playAction(actionId: LemmyActionId, options?: LemmyPlayOptions): Promise<void>;
  playIdle(): void;
}
```

For the first pass, promises may be implemented with action completion callbacks and timers, but avoid untracked global state.

**Step 4: Run green test**

Run:

```bash
npm test -- tests/cocos/LemmyActor.test.ts
```

Expected: helper tests pass.

### Task 4: Implement Frame Playback And Events

**Files:**
- Modify: `assets/scripts/cocos/LemmyActor.ts`
- Test: `tests/cocos/LemmyActor.test.ts`

**Step 1: Write failing tests for event scheduling**

Add tests for pure planning helpers:

- `buildLemmyFrameTimeline("reach_up_right")` includes frame start times.
- `reach_contact` occurs after anticipation frames, not at frame 0.
- `walk_right` has no contact event.

**Step 2: Run red test**

Run:

```bash
npm test -- tests/cocos/LemmyActor.test.ts
```

Expected: fails until timeline helpers exist.

**Step 3: Implement playback**

In the Cocos component:

- load all frames for the requested action
- set `Sprite.spriteFrame` by timer
- dispatch `onFrameEvent(event, actionId, frameIndex)`
- resolve the promise at the end of non-looping actions
- loop or ping-pong for idle/walk

Use code timers for now. If later timing jitter becomes visible, move frame stepping into `update(deltaTime)` with an accumulator.

**Step 4: Run green test**

Run:

```bash
npm test -- tests/cocos/LemmyActor.test.ts
```

Expected: passes.

### Task 5: Refactor M01 Intro To Use `LemmyActor`

**Files:**
- Modify: `assets/scripts/cocos/M01IntroSequence.ts`
- Test: `tests/cocosProjectScaffold.test.ts`

**Step 1: Write failing scaffold test**

Assert that `M01IntroSequence.ts`:

- imports `LemmyActor`
- adds `LemmyActor` to `M01IntroLemmy`
- no longer manually swaps Lemmy sprite frames with `swapSprite(this.lemmySprite`
- no longer uses `setTimeout(... REACH_HOLD_DURATION ...)` to trigger the basket
- calls an actor frame event for `reach_contact`

**Step 2: Run red test**

Run:

```bash
npm test -- tests/cocosProjectScaffold.test.ts -t "LemmyActor"
```

Expected: fails against the current intro sequence.

**Step 3: Implement refactor**

Change flow:

```ts
private async beginWalk(): Promise<void> {
  this.phase = "walking";
  await this.lemmyActor.walkTo(new Vec3(LEMMY_UNDER_BASKET_X, LEMMY_Y, 0));
  await this.beginReach();
}

private async beginReach(): Promise<void> {
  this.phase = "reaching";
  await this.lemmyActor.playAction("reach_up_right", {
    onFrameEvent: (event) => {
      if (event === "reach_contact") this.wobbleBasket();
    }
  });
}
```

Guard against double taps by keeping the existing phase checks.

**Step 4: Run green test**

Run:

```bash
npm test -- tests/cocosProjectScaffold.test.ts -t "LemmyActor"
```

Expected: passes.

### Task 6: Add M01 Interaction Anchor Data

**Files:**
- Modify: `assets/scripts/cocos/M01IntroSequence.ts`
- Test: `tests/cocosProjectScaffold.test.ts`

**Step 1: Write failing scaffold test**

Assert that `M01IntroSequence.ts` contains `M01_INTRO_ANCHORS` with:

- `basketReach.approachPoint`
- `basketReach.action === "reach_up_right"`
- `basketReach.contactEvent === "reach_contact"`
- `watchingPoint.approachPoint`

**Step 2: Run red test**

Run:

```bash
npm test -- tests/cocosProjectScaffold.test.ts -t "M01 intro anchors"
```

Expected: fails until anchors exist.

**Step 3: Implement anchors**

Replace hardcoded Lemmy path constants in choreography with anchor lookups. Keep the old numeric constants only if they are used to define the anchor object.

**Step 4: Run green test**

Run:

```bash
npm test -- tests/cocosProjectScaffold.test.ts -t "M01 intro anchors"
```

Expected: passes.

### Task 7: Add Minimal Y-Sort Hook Without Overgeneralizing

**Files:**
- Modify: `assets/scripts/cocos/LemmyActor.ts`
- Test: `tests/cocos/LemmyActor.test.ts`

**Step 1: Write failing helper test**

Add a pure helper:

```ts
export function compareAdventureDepth(aY: number, bY: number): number;
```

For future layering, define stable behavior:

- lower screen Y draws in front
- equal Y keeps existing order

**Step 2: Run red test**

Run:

```bash
npm test -- tests/cocos/LemmyActor.test.ts -t "adventure depth"
```

Expected: fails.

**Step 3: Implement helper only**

Do not wire global scene sorting in M01 unless needed visually. Leave the hook ready for future scenes.

**Step 4: Run green test**

Run:

```bash
npm test -- tests/cocos/LemmyActor.test.ts -t "adventure depth"
```

Expected: passes.

### Task 8: Preview Verification

**Files:**
- No production edits unless a real bug appears.

**Step 1: Run targeted tests**

```bash
npm test -- tests/cocos/LemmyActor.test.ts tests/cocos/M01GreyboxArt.test.ts tests/cocosProjectScaffold.test.ts
npm run typecheck
git diff --check
```

Expected: all pass.

**Step 2: Refresh Cocos**

Refresh:

```text
db://assets/scripts
db://assets/resources/art/stage1-m01/runtime-sprites/lemmy
```

**Step 3: Run preview probe**

Use Playwright to open:

```text
http://127.0.0.1:7456/?scene=a2135734-fc11-4a0e-926d-40bc2301a752&m01ArtPreview=1&v=lemmy-actor-m01
```

Probe requirements:

- scene is `M01Greybox`
- `M01IntroLemmy` exists
- `LemmyActor` exists on the node
- before tap: actor is idle
- tap basket: actor walks to basket anchor
- `reach_contact` triggers basket wobble/tip
- 9 fragments release
- Lemmy walks to watching point
- `physicsSettled === true`
- console/page errors are empty

Do not rely on the old smoke script alone, because the current intro requires the basket tap before physics can settle.

### Task 9: Documentation Handoff

**Files:**
- Modify: `production/active.md`
- Optional modify: `docs/design/style-references/README.md`

Record:

- actor system scope
- which frames are temporary
- test evidence
- preview URL
- what remains for real Machinarium-level polish

## Acceptance Criteria

M01 is acceptable when:

- Lemmy identity remains the approved 2026-04-24 prototype.
- M01 intro no longer relies on direct sprite swaps and timeout-based reach triggers.
- `reach_contact` frame triggers basket response.
- Walk and reach actions are data-driven clips.
- The code path can replace temporary frames with production hand-drawn frames without changing choreography code.
- Targeted tests, typecheck, and preview probe pass.

M01 is not yet Machinarium-level final art until:

- real hand-drawn frames replace temporary generated frames
- left/right direction pairs exist
- action sounds are added
- broader Y sorting and pathing are applied where scenes need them

## Claude Review Checklist

Please review this plan for:

- whether the frame counts are enough for smoothness
- whether code-driven frame playback is acceptable before `.anim`
- whether `setTimeout` frame playback should be replaced with `update(deltaTime)` immediately
- whether M01 should include Y sorting now or only expose helper hooks
- whether the anchor abstraction is too narrow or appropriately scoped
- missing Cocos 3.8 constraints around `SpriteFrame`, resource loading, or component lifecycle
- risks around generated temporary frames giving a false sense of final art quality

---

## Claude Review Notes (2026-05-27)

Overall verdict: **Go**. Architecture is correct, scope is honest, TDD shape matches the project's existing pattern. Fold the 7 items below into the plan before execution. Items 1–3 are *must do at task time*, not deferrals. Items 4–7 are polish that can land during execution.

### Direct answers to the Claude Review Checklist

| Question | Answer |
|----------|--------|
| Frame counts enough? | **Yes.** 8/12/10 matches Machinarium's typical action lengths. `idle_right` ping-pong of 6 = 12 effective cycle frames — fine. |
| Code-driven before `.anim`? | **Yes.** `.anim` is agent-hostile for this workflow. TS frame tables are diff-able + Vitest-testable. |
| Replace `setTimeout` with `update(dt)` immediately? | **Yes — do it in Task 4, not later.** See Note 1. |
| Y-sort in M01? | **No.** Only expose helper (`compareAdventureDepth`). M01 layout has no front/back conflict. Plan already says this; keep. |
| Anchor abstraction too narrow? | **Appropriately scoped.** M01-local first, generalize after 2nd scene shows the real shape. |
| Cocos 3.8 constraints missed? | **Yes — preload + lifecycle.** See Notes 2 & 3. |
| Temporary-frame false-quality risk? | **Real.** Add explicit visual spot-check in Task 2. See Note 7. |

### Issues to fold into the plan

**1. Use `update(deltaTime)` from the start, not `setTimeout`. (Task 4)**

`setTimeout` drifts on inactive browser tabs, GC pauses, and frame stalls. The cost of doing it right initially is ~5 extra lines (frame-time accumulator); the cost of migrating later is rewriting the whole playback path + retesting timing-sensitive events like `reach_contact`. Decide once.

Pure helper signature is also more testable:

```ts
export function advanceLemmyTimeline(
  state: LemmyTimelineState,
  elapsedMs: number
): { frameIndex: number; emittedEvents: string[]; ended: boolean };
```

The Cocos component then becomes a thin wrapper that accumulates `deltaTime` and reads `frameIndex` to set `sprite.spriteFrame`.

**2. Preload all action frames at `init()`, not lazily on `playAction`. (Task 3)**

`idle_right` + `walk_right` + `reach_up_right` = ~26–30 PNGs. `resources.load` is async, so the first `playAction` after a click could land mid-load. The intro flow's first frame matters for player perception.

Recommendation:

- `LemmyActor.init()` accepts the full action manifest
- Internally calls `resources.load` for every frame referenced by every action
- Resolves an internal `ready` promise once all frames are in the cache
- `walkTo` / `playAction` await `ready` (or refuse to start if intro hasn't called `init`)

If `resources.loadDir` works on the `lemmy/` subfolders, prefer that — one call per action folder.

**3. Promise lifecycle + cancellation. (Task 3 / 4)**

`await actor.walkTo(...)` leaks if the actor's node is destroyed mid-walk, or if a new action is requested before the current one finishes. Plan says "avoid untracked global state" but doesn't spell out the contract.

Required contract:

- Each `walkTo` / `playAction` returns a Promise tagged with an internal token
- A new call cancels the previous token; the previous Promise rejects with a sentinel like `LemmyActionInterrupted`
- `onDestroy()` cancels everything pending; pending Promises reject with `LemmyActorDestroyed`
- `M01IntroSequence` catches `LemmyActionInterrupted` and silently aborts the choreography (don't propagate as a console error)

This is also testable: unit-test the cancellation token logic separately from Cocos.

**4. Lock the Lemmy identity source as a constant, not a README note. (Task 1 / 2)**

Plan says "use only the approved 2026-04-24 prototype" in prose. That can drift. Add to `M01GreyboxArt.ts`:

```ts
/** Lemmy identity reference. Any frame-generation script MUST pull from this path
 *  exclusively. No Luma rabbits. No alternate turnarounds. */
export const M01_LEMMY_IDENTITY_SOURCE =
  "assets/art/style-references/2026-04-24-lemmy-rabbit-style-reference.png";
```

Frame-generation script + tests both consume this constant. Single source of truth.

**5. Add a brief "settle in" between walk arrival and reach. (Task 5)**

When `walkTo` resolves, the very next frame plays `reach_up_right` — a hard jump from mid-walk to anticipation. Looks robotic. Insert a 2-frame `idle_right` pause as a settle buffer:

```ts
await actor.walkTo(...);
await actor.playAction("idle_right", { frames: 2, loop: false });  // settle
await actor.playAction("reach_up_right", { onFrameEvent: ... });
```

Or build this into the actor by having `walkTo` end on an automatic 2-frame settle. Either way: don't cut directly from walk to reach.

**6. Frame durations are the eventual audio-sync source — flag them as locked. (Task 1)**

Once `reach_up_right` defines `[80ms, 80ms, 100ms (contact), 60ms, 60ms, ...]`, any future SFX scaffold will key off these exact numbers (footstep tick, basket-contact hit, etc.). Changing a duration later silently breaks audio sync.

Recommendation: collect all frame durations into a single `LEMMY_ACTION_FRAME_DURATIONS` constant table, with a docblock saying "These values are the SFX sync truth. Any change requires reviewing tied audio."

**7. Add a visual spot-check step to Task 2 before continuing. (Task 2)**

Frame-count tests verify file existence and count, not identity. Generated temp frames can pass the test while looking like a different rabbit.

Add Task 2 Step 6:

> **Step 6: Visual spot-check.** Render frames 0, ceil(n/2), n-1 of each action into a 3-column contact sheet. Compare side by side with `M01_LEMMY_IDENTITY_SOURCE`. If silhouette/proportion/color drift is visible, regenerate before continuing to Task 3. Save the contact sheet to `temp/lemmy-frame-review/` for the record.

This catches Luma-style drift before it gets baked into 30+ committed PNGs.

### Items that are *correct as written*, do not change

- Scope boundary (right-facing only, no walkable mask, no global Y-sort) — right call, do not expand
- Anchor object as a const, not a class system yet — right call
- `LemmyActor` separated from `M01IntroSequence` — right call
- TDD shape per task (red → impl → green) — matches the project
- Phase A/B asset strategy with explicit "temporary" flag — right call
- Acceptance Criteria section — clear and honest about what's "done" vs "still rough"

### Execution gate

Before Task 1 starts, the plan should be edited to include items 1, 2, 3, 4 as explicit requirements (not "later if needed"). Items 5, 6, 7 can land as Task amendments during execution.

