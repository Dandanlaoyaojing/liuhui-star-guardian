# Lemmy Transform-Animation Plan (Single Canonical Sprite, Zero New Art)

> **Author:** Claude (Opus 4.7, 1M context)
> **Date:** 2026-05-28
> **Status:** Active (final direction)
> **Supersedes:** `docs/plans/2026-05-28-lemmy-frame-table-plan.md` (and the slim plan before it)
> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans`. Follow `superpowers:test-driven-development` per task.

**Goal:** Animate Lemmy entirely by transforming the **single** canonical PNG (position / rotation / scale / squash-stretch) via `cc.tween`. No new art, no AI generation, no part-cutting, no pose swaps. Identity is guaranteed because every frame *is* the canonical at a different transform — drift is structurally impossible.

**Architecture:** `LemmyActor` mounts one `Sprite` showing `lemmy-canonical.png`. Idle / walk / reach / exit are whole-sprite transform schedules driven by `cc.tween` on the actor node. The **reach is conveyed by body language only** — an anticipation squash, then a tall tiptoe stretch (`scaleY↑`, `offsetY↑`) with a slight lean, hold, and recovery. `reach_contact` fires at the stretch apex to trigger the basket wobble. There is **no visible raised arm** (see decision history below). Cancellation reuses codex's `LemmyActorContract` verbatim.

**Tech Stack:** Cocos Creator 3.8 TS, `cc.tween` on `Node` transform, Vitest pure-schedule tests, M01 preview smoke. **One** PNG asset.

---

## Why This Plan Exists (decision history — do not re-litigate)

Four approaches were tried for Lemmy animation; all pixel-regenerating ones drifted his identity. Documented in `production/active.md` and `temp/lemmy-frame-spot-check/`:

1. **13-part DragonBones rig** — rejected: too heavy for MVP, clashes with hand-drawn aesthetic, no skeleton infra in repo.
2. **4-layer cut-out + `cc.tween`** — rejected: puppet feel; whisker/line-overlay can't follow rotation; codex's cut had double-ear/no-pivot bugs.
3. **Luma frame generation** (`--ref` and `--modify`) — rejected: AI regeneration drifts identity every time.
   - `--ref` drift-gate: user verdict "和原型差距挺大".
   - `--modify` (image_edit): a one-word "close the eye" edit repainted the whole rabbit. Proof it's global regen, not local inpaint. Evidence: `temp/lemmy-frame-spot-check/modify-test/canonical-vs-blink.png`.
   - arm-raise attempts (`--modify`+`--ref`, 5 candidates): colors faded ~9–30% (fixable by saturation correction) **but body proportions elongated/drifted** (not fixable by post-process), and Luma drew an extraneous basket. Evidence: `temp/lemmy-frame-spot-check/reach-up-candidates/`.
4. **Transform the single canonical sprite** — ACCEPTED. The only zero-drift path: never regenerate pixels, just move/scale/rotate the one approved image.

**Final user decision (2026-05-28):** "放弃举臂，回到纯踮脚" — no visible arm-raise; the reach is a pure tiptoe stretch on the canonical. This collapses the asset count to **one** and removes all pose-swap logic.

Lemmy's MVP role (companion who walks in, reacts, walks out across 10 puzzles) does not require literal limb articulation. Arrog — the project's aesthetic anchor — conveys action through minimal motion and staging, not detailed limbs (Mateo Alayza interview: hand-drawn + shaders, no rigging).

## Asset (Total: 1)

| Asset | Source | Status |
|---|---|---|
| `assets/resources/art/characters/lemmy/lemmy-canonical.png` | copy of `assets/art/style-references/lemmy-rabbit-canonical.png` | needs runtime copy (Task 1) |

No reach-up pose, no parts, no frame sequences, no hand-drawn deliverable. The Luma experiment outputs stay in `temp/lemmy-frame-spot-check/` as evidence only — never shipped.

## Reused From Codex (verbatim)

- `assets/scripts/cocos/LemmyActorContract.ts` — `createLemmyCancellationContext`, `LemmyActionInterrupted`, `LemmyActorDestroyed`, `isExpectedLemmyActionCancel`, `LemmyActionId`, `LemmyActorEvent`, `LEMMY_APPROVED_IDENTITY_SOURCE` (→ `lemmy-rabbit-canonical.png`). The schedule shape is reused but simplified to whole-sprite transforms — drop per-layer fields and any `pose` field.
- `assets/scripts/cocos/M01IntroSequence.ts` diff — `async beginWalk` / `await walkTo` / `await playAction("reach_up_right", { onEvent })` / `isExpectedLemmyActionCancel` catch. Public API unchanged.

## Acceptance Criteria

- `LemmyActor` mounts exactly one `Sprite` = `lemmy-canonical.png`.
- All four schedules (`idle_right`, `walk_right`, `reach_up_right`) contain **only** transform fields (`offsetX/Y`, `rotateDeg`, `scaleX/Y`) and optional `event`. No `pose` field anywhere.
- `reach_up_right` has exactly one keyframe with `event: "reach_contact"`, at the stretch apex (neither first nor last), with `scaleY > 1` (visible stretch).
- `playAction("reach_up_right")` resolves after the schedule duration and emits `reach_contact` once.
- New `playAction` mid-flight cancels the old token (`LemmyActionInterrupted`); `onDestroy()` → `LemmyActorDestroyed`; no orphaned tween keeps writing transforms after cancellation (token checked inside every `.call`).
- `M01IntroSequence.ts` has no `swapSprite(this.lemmySprite, …)` and no `setTimeout(REACH_HOLD_DURATION …)`.
- `npm test`, `npm run typecheck`, `git diff --check` clean; `npm run smoke:m01-preview -- --enable-art-preview` reaches completion with basket wobble on `reach_contact`.

---

## Task 0: Supersede The Frame-Table Plan

- [ ] Add a banner under the frame-table plan's title pointing here (note: AI frame generation abandoned, transform-only chosen). Commit.

## Task 1: Runtime Copy Of Canonical

- [ ] **Step 1:** Copy canonical into the runtime resources folder.

```bash
mkdir -p assets/resources/art/characters/lemmy
cp assets/art/style-references/lemmy-rabbit-canonical.png assets/resources/art/characters/lemmy/lemmy-canonical.png
```

- [ ] **Step 2:** Refresh `db://assets/resources/art/characters/lemmy` in Cocos for `.meta` generation. Commit.

## Task 2: Whole-Sprite Transform Schedules (LemmyActorContract)

**Files:** Modify `assets/scripts/cocos/LemmyActorContract.ts`, `tests/cocos/LemmyActor.test.ts`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import {
  LEMMY_APPROVED_IDENTITY_SOURCE, getLemmyTransformSchedule, estimateLemmyActionDurationMs,
  createLemmyCancellationContext, LemmyActionInterrupted, LemmyActorDestroyed, isExpectedLemmyActionCancel
} from "../../assets/scripts/cocos/LemmyActorContract.ts";

it("identity constant points at canonical", () => {
  expect(LEMMY_APPROVED_IDENTITY_SOURCE).toBe("assets/art/style-references/lemmy-rabbit-canonical.png");
});

it("idle_right loops, breathing offsetY, no events", () => {
  const s = getLemmyTransformSchedule("idle_right");
  expect(s.loop).toBe(true);
  expect(s.keyframes.some((k) => (k.offsetY ?? 0) !== 0)).toBe(true);
  expect(s.keyframes.some((k) => k.event)).toBe(false);
});

it("walk_right loops, rotate wobble + footstep events", () => {
  const s = getLemmyTransformSchedule("walk_right");
  expect(s.loop).toBe(true);
  expect(s.keyframes.map((k) => k.event).filter(Boolean)).toEqual(["footstep_left", "footstep_right"]);
});

it("reach_up_right: no loop; apex has reach_contact + scaleY>1; no pose field anywhere", () => {
  const s = getLemmyTransformSchedule("reach_up_right");
  expect(s.loop).toBe(false);
  const apex = s.keyframes.findIndex((k) => k.event === "reach_contact");
  expect(apex).toBeGreaterThan(0);
  expect(apex).toBeLessThan(s.keyframes.length - 1);
  expect((s.keyframes[apex].scaleY ?? 1)).toBeGreaterThan(1);
  expect(s.keyframes.every((k) => !("pose" in k))).toBe(true);
});

it("estimateLemmyActionDurationMs = last keyframe atMs", () => {
  const s = getLemmyTransformSchedule("reach_up_right");
  expect(estimateLemmyActionDurationMs("reach_up_right")).toBe(s.keyframes.at(-1)!.atMs);
});

// cancellation tests (kept from codex) …
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement.** In `LemmyActorContract.ts` keep all cancellation surface + identity constant. Replace any frame/clip/pose types with:

```ts
export interface LemmyTransformKeyframe {
  atMs: number;
  offsetX?: number;
  offsetY?: number;     // breath bob / tiptoe lift
  rotateDeg?: number;   // lean / wobble
  scaleX?: number;      // squash (default 1)
  scaleY?: number;      // stretch (default 1)
  event?: LemmyActorEvent;
}
export interface LemmyTransformSchedule { id: LemmyActionId; loop: boolean; keyframes: LemmyTransformKeyframe[]; }

export const LEMMY_TRANSFORM_SCHEDULES: Record<LemmyActionId, LemmyTransformSchedule> = {
  idle_right: { id: "idle_right", loop: true, keyframes: [
    { atMs: 0,    offsetY: 0, scaleY: 1.00 },
    { atMs: 700,  offsetY: 3, scaleY: 1.02 },
    { atMs: 1400, offsetY: 0, scaleY: 1.00 },
    { atMs: 2100, offsetY: 2, scaleY: 1.01 }
  ]},
  walk_right: { id: "walk_right", loop: true, keyframes: [
    { atMs: 0,   offsetY: 0, rotateDeg: -2, event: "footstep_left" },
    { atMs: 150, offsetY: 5, rotateDeg:  1 },
    { atMs: 300, offsetY: 0, rotateDeg:  2, event: "footstep_right" },
    { atMs: 450, offsetY: 5, rotateDeg: -1 },
    { atMs: 600, offsetY: 0, rotateDeg: -2 }
  ]},
  reach_up_right: { id: "reach_up_right", loop: false, keyframes: [
    { atMs: 0,   offsetY: 0,  scaleY: 1.00, scaleX: 1.00 },                   // neutral
    { atMs: 200, offsetY: -8, scaleY: 0.94, scaleX: 1.05 },                   // anticipation squash (crouch)
    { atMs: 420, offsetY: 22, scaleY: 1.12, scaleX: 0.95, event: "reach_contact" }, // APEX: tall tiptoe stretch + contact
    { atMs: 640, offsetY: 18, scaleY: 1.09, scaleX: 0.96 },                   // hold
    { atMs: 900, offsetY: 0,  scaleY: 1.00, scaleX: 1.00 }                    // recovery
  ]}
};

export function getLemmyTransformSchedule(id: LemmyActionId) { return LEMMY_TRANSFORM_SCHEDULES[id]; }
export function estimateLemmyActionDurationMs(id: LemmyActionId) {
  const k = LEMMY_TRANSFORM_SCHEDULES[id].keyframes; return k[k.length - 1].atMs;
}
```

- [ ] **Step 4: Green + typecheck. Commit.**

## Task 3: LemmyActor Single-Sprite Transform Playback

**Files:** Modify `assets/scripts/cocos/LemmyActor.ts`, `tests/cocos/LemmyActor.test.ts`.

- [ ] **Step 1:** Implement `LemmyActor` (public API unchanged: `init`/`walkTo`/`playAction`/`playIdle`/`onDestroy`):
  - `init()` loads `lemmy-canonical` (default path `art/characters/lemmy/lemmy-canonical`) into the one `Sprite`; records base position.
  - `playAction(id)` builds a `cc.tween(this.node)` chain from the schedule: each keyframe `.to(seg, { position: base+offset, scale: (sx,sy), angle: -rotate })`; in each `.call`, **guard `if (!token.isActive) return;`** then emit any event. Loop re-arms if `schedule.loop`; non-loop resets transform to identity and resolves.
  - `walkTo(target, { durationMs })` runs a position tween to `target` while `playAction("walk_right")` loops the bob/wobble; resolves when the position tween completes (cancel the walk loop then).
  - `onDestroy()` → `cancellation.destroy()`.
  - No sprite swapping, no pose map, no per-layer nodes.
- [ ] **Step 2:** Tests for any pure helper extracted (e.g. a `buildTweenSteps(schedule, base)` that returns the per-segment target list) so timing/events are unit-tested without Cocos. Green + typecheck. Commit.

## Task 4: M01 Manifest + Wiring Verify

- [ ] Update `M01GreyboxArt.ts` to expose a single `lemmy_canonical` resource (replace any 4-layer/19-frame/2-pose entries). Update its test to expect the one path under `art/characters/lemmy/`.
- [ ] Confirm `M01IntroSequence.spawnLemmy` adds `LemmyActor` and `init()`s it (codex's diff); `beginWalk`/`beginReach` keep the async actor-call shape. Scaffold + manifest tests green. Commit.

## Task 5: Preview Verification

- [ ] Refresh `db://assets/resources/art/characters/lemmy` + `db://assets/scripts`.
- [ ] `npm run smoke:m01-preview -- --enable-art-preview`. Expect: Lemmy slides in (canonical + bob/wobble), crouches then stretches tall on tiptoe at the basket, `reach_contact` → basket wobble, 9 fragments release, exit.
- [ ] Visual: Lemmy is unmistakably the canonical at every instant (it literally is); reach reads as a tiptoe stretch; motion feels hand-made not robotic.
- [ ] `npm test && npm run typecheck && git diff --check`. Append close-out note to `production/active.md`. Commit.

## Handoff Notes For Codex

- `LemmyActorContract` cancellation surface — **kept verbatim**. Schedule payload simplified to whole-sprite transform keyframes; **no `pose`, no per-layer fields, no frame paths.**
- `LemmyActor` = **one sprite + transform tween**. Cancellation-gate bug from the slim-plan review fixed by `if (!token.isActive) return;` inside every tween `.call`.
- Your `M01IntroSequence` diff applies as-is.
- Decision history (DragonBones → 4-layer → Luma frames → Luma arm-raise → transform-only) is closed. AI pixel generation is abandoned for Lemmy: every attempt drifted identity (evidence in `temp/lemmy-frame-spot-check/`). Do not re-propose AI frame generation without a verified zero-drift method.
