# Lemmy Slim Actor & Layered Parts Plan

> **⚠️ SUPERSEDED 2026-05-28** — replaced by [`docs/plans/2026-05-28-lemmy-frame-table-plan.md`](2026-05-28-lemmy-frame-table-plan.md). After researching Arrog's actual production tech (Mateo Alayza IGF interview confirms hand-drawn frame sequences, not layered cut-outs) and given Lemmy's small MVP action vocabulary, the 4-layer + `cc.tween` runtime path was rejected in favor of a frame-table player driven by hand-composed single-PNG frames per pose. The 4 layered parts described in this plan still exist — they become production素材 used in an external image tool, not runtime sprites. Codex's `LemmyActorContract.ts` cancellation logic is preserved verbatim in the new plan.
>
> **Author:** Claude (Opus 4.7, 1M context)
> **Date:** 2026-05-27
> **Status:** Superseded 2026-05-28 (was: Codex reviewed and approved with one tooling caveat)
> **Supersedes:** `docs/plans/2026-05-27-lemmy-clean-master-rig-plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Follow `superpowers:test-driven-development` per task.

**Goal:** Ship a maintainable, identity-locked Lemmy actor for M01 (and later levels) using a 4-layer transparent part pack driven by `cc.tween`, exposed behind a renderer-neutral `LemmyActor` runtime API — without introducing DragonBones, Cocos Skeleton2D, `.anim`, or any editor-bound rig.

**Architecture:** Take the approved high-resolution Lemmy as a black-background candidate and clean it to a transparent master. Cut the master into exactly **four** layered transparent parts: `body` (torso + head + face + back-arm baked in), `ear-left`, `ear-right`, and `arm-front`. At runtime, `LemmyActor` mounts these as child sprites and drives motion entirely with `cc.tween` on the child nodes — no skeleton runtime, no per-frame PNG swapping. Action schedules are pure data constants so they unit-test cleanly and stay the eventual SFX sync source. `M01IntroSequence` stops swapping `lemmySprite.spriteFrame` directly and stops using `setTimeout` for the basket-contact moment; instead it awaits actor calls and reacts to a `reach_contact` event the actor emits at a deterministic point in the reach tween.

**Tech Stack:** Cocos Creator 3.8 TypeScript, `cc.tween` on `Node` transforms, `resources.load(SpriteFrame)`, Vitest pure-helper + asset tests, existing M01 preview smoke (`npm run smoke:m01-preview`). Node.js image tooling for the one-time part-cutting script (Task 3). Prefer the repo's existing `readPng` / `writePng` helper pattern from `scripts/generate-m01-reference-texture-pieces.mjs`; use `sharp` only if it is explicitly added as a devDependency in the same task. No DragonBones, no Spine, no Skeleton2D, no `.anim`.

---

## Reframe (why this plan exists)

> **Codex review note:** Direction approved. One execution caveat: this repo currently does not have `sharp` in `package.json`. The inline `sharp` snippets below are acceptable only if the implementer first adds `sharp` as a devDependency and commits the lockfile change. Otherwise, port those snippets to the existing dependency-free PNG helper style used by `scripts/generate-m01-reference-texture-pieces.mjs`.

The superseded clean-master rig plan proposed a 13-part DragonBones / Cocos Skeleton2D rig as the formal Lemmy pipeline. That plan's high-value ideas (`LemmyActor` renderer-neutral API, cancellation contract, identity-locked source constant, clean-master step, visual spot-check, settle-in pause between walk and reach) are kept. Its tech choice (skeletal rig with 13 anatomical parts) is rejected for this project because:

1. **Scope.** Lemmy is a companion across 10 MVP puzzles, not a combat protagonist. Action vocabulary for the whole MVP is idle + walk + reach + small per-puzzle reactions. A 13-bone rig + 4 authored clips is far more pipeline than the role requires.
2. **Aesthetic.** The product's style anchor is Arrog — slightly imperfect hand-drawn ink + low-saturation watercolor. Bone-deformed cutouts produce a "Flash puppet" feel that the codex plan already tries to patch with `accent` / `smear` full-frame fixes. The slim plan avoids the failure mode instead of patching it.
3. **Whisker / line-overlay problem.** The codex plan promises both "preserve whiskers" and "cut into reusable parts" with `lemmy-whiskers.png` and `lemmy-line-overlay.png` as separate overlays. Whiskers are 1–2px lines on the snout; a flat overlay PNG cannot follow head rotation. The slim plan keeps whiskers and line work baked into the `body` part, so they always stay registered.
4. **No skeleton infrastructure exists.** The repo has 0 `.dbbin` / `.skel` / `sp.Skeleton` usages, no DragonBones dependency, and no prior pivot/atlas authoring history. Introducing a new asset pipeline is a real cost.
5. **Agent-hostile editor binding.** The original motion plan explicitly notes `.anim` is agent-hostile. DragonBones rig binding in Cocos 3.8 is **more** editor-bound than `.anim`. The slim plan keeps all motion in `.ts` files — fully diff-able, fully Vitest-testable, no Cocos editor step.
6. **Track A was skipped.** The original two-track motion plan defined a code-driven SpriteFrame validation step (Track A) before any skeleton work (Track B). The codex plan jumps directly to Track B. The slim plan completes the equivalent of Track A in a form that doubles as the final MVP pipeline.

If codex disagrees with this reframe, the disagreement should land in the review notes block at the bottom — not in silent task amendments during execution.

## Diff vs the Clean-Master Rig Plan

| Concern | Codex plan | This plan |
|---|---|---|
| Part count | 13 (head, ears, torso, arms, legs, feet, tail, eye/face marks, whiskers, line overlay) | **4** (body, ear-left, ear-right, arm-front) |
| Renderer | DragonBones **or** Cocos Skeleton2D (decided in Task 5) | `cc.tween` on `Node` children only |
| Editor binding | Required (rig authoring, clip authoring) | **None** |
| Pivot file | Full normalized-coordinate rig JSON | One-line `pivot` per part, only for the 4 nodes |
| Action authoring | DragonBones / Skeleton2D timeline clips | `LEMMY_ACTION_SCHEDULES` TS constant + `cc.tween` |
| Whiskers / line overlay | Separate PNG overlays | Baked into `body` part |
| Accent / smear frames | Reserved slot with optional contact-frame PNGs | **Out of scope** for MVP (revisit after M07) |
| `LemmyActor` API | Same | **Same** — kept verbatim |
| Cancellation contract | Same | **Same** — kept verbatim |
| Identity source constant | `LEMMY_APPROVED_IDENTITY_SOURCE` | **Same** |
| Settle pause before reach | 2-frame idle | **Same** (implemented as a 200ms `tween().delay`) |
| Visual spot-check | Task 4 informal | **Task 7 mandatory before commit** |
| `setTimeout` for reach hold | Removed (event-driven) | **Same** — removed |
| TDD shape | Red → impl → green per task | **Same** |

---

## Source Of Identity

The canonical Lemmy identity reference for runtime art generation is the 2026-05-28 high-resolution transparent master the user approved:

```text
assets/art/style-references/lemmy-rabbit-canonical.png
docs/design/style-references/2026-05-28-lemmy-rabbit-canonical.png
```

These two files are identical content (2000×2000 RGBA PNG). The `assets/art/` copy is the path that scripts, tests, and runtime loaders consume. The `docs/design/` copy is the dated historical record.

The earlier 2026-04-24 paper-backed reference (`lemmy-rabbit-style-reference.png`, 274×440) is retained as a **historical** record of the originally approved design — same character, lower resolution. It is no longer the identity source. Do not edit it. Do not generate runtime art from it.

Parts (Task 3) are cut directly from `lemmy-rabbit-canonical.png`. Tasks 1 and 2 (candidate save + background cleanup) are no longer needed because the user delivered a transparent master directly on 2026-05-28.

A single TS constant locks this everywhere art is generated or loaded:

```ts
/** Lemmy canonical identity reference. Any frame-generation script,
 *  part-cutting script, or runtime loader MUST resolve Lemmy art relative to
 *  this single source of truth. No Luma rabbits. No alternate turnarounds.
 *  No paper-backed 2026-04-24 thumbnail. */
export const LEMMY_APPROVED_IDENTITY_SOURCE =
  "assets/art/style-references/lemmy-rabbit-canonical.png";
```

This constant lives in `assets/scripts/cocos/LemmyActor.ts` so any consumer (scripts, tests, M01) imports from a single module.

## In Scope

- One transparent clean master derived from the 2026-05-27 candidate.
- Exactly four runtime parts (`body`, `ear-left`, `ear-right`, `arm-front`) under `assets/resources/art/characters/lemmy/`.
- `LemmyActor` component with public API: `init`, `walkTo`, `playAction`, `playIdle`, `onEvent`.
- Cancellation contract: `LemmyActionInterrupted` on supersession, `LemmyActorDestroyed` on `onDestroy`.
- Three actions: `idle_right`, `walk_right`, `reach_up_right` — all `cc.tween` driven.
- Deterministic `reach_contact` event emitted from inside the reach tween at a known offset.
- `M01IntroSequence` migration: no more `swapSprite(this.lemmySprite, ...)`, no more `setTimeout(... REACH_HOLD_DURATION ...)`.
- M01 preview smoke passes with the new actor: Lemmy enters → settles → reaches → basket wobbles on `reach_contact` → pieces spill → Lemmy exits.
- Vitest unit tests for pure helpers + asset existence/shape tests.
- Visual spot-check against `LEMMY_APPROVED_IDENTITY_SOURCE` before any new asset is committed.

## Out Of Scope

- Left-facing direction pair (current intro moves left-to-right only).
- Per-puzzle Lemmy reactions for M02–M10 (each level can author its own tween calls against `LemmyActor` later).
- DragonBones / Skeleton2D / `.anim` migration.
- Whisker / face-mark / line-overlay as separate runtime layers.
- "Accent" / "smear" full-frame contact PNGs — revisit only if a real level's reach reads as too clean.
- Walkable-area masks and multi-waypoint pathfinding.
- Y-sort hook (deferred until a level actually needs it).
- Final audio production. Schedules are SFX-ready data but no clips are wired.
- Replacing M01 puzzle physics or non-Lemmy art.

## Acceptance Criteria

- `assets/art/style-references/lemmy-rabbit-canonical.png` exists as a transparent RGBA PNG with whisker + watercolor edges visibly preserved (2026-05-28 — already shipped).
- Four parts exist under `assets/resources/art/characters/lemmy/` with non-trivial opaque content and ≤ 2 alpha at all four corners.
- A `LemmyActor` instance can be constructed in a unit test (with mocked Cocos types) and the pure schedule helpers return correct frame timings.
- `getLemmyActionSchedule("reach_up_right")` contains exactly one `reach_contact` entry, and its `atMs` is strictly between the anticipation start and the recovery start.
- `M01IntroSequence.ts` no longer contains `swapSprite(this.lemmySprite, ...)` for `walking` / `reaching`, and no longer uses `setTimeout` for the basket-contact trigger.
- M01 preview smoke completes successfully: actor walks to the basket anchor, settles for ~200ms, plays reach, basket wobble starts on `reach_contact`, all 9 fragments are released, actor exits to the watching anchor.
- A 1×4 contact sheet (`body` + 3 overlays composed at neutral pose, then composed mid-reach) saved to `temp/lemmy-slim-spot-check/` visually reads as the approved Lemmy.
- `npm test`, `npm run typecheck`, and `git diff --check` are all clean.

## File Plan

### Create

- `assets/art/characters/lemmy/parts/lemmy-body.png` (source, dev-only)
- `assets/art/characters/lemmy/parts/lemmy-ear-left.png`
- `assets/art/characters/lemmy/parts/lemmy-ear-right.png`
- `assets/art/characters/lemmy/parts/lemmy-arm-front.png`
- `assets/art/characters/lemmy/lemmy-part-pivots.json`
- `assets/resources/art/characters/lemmy/lemmy-body.png` (runtime copies)
- `assets/resources/art/characters/lemmy/lemmy-ear-left.png`
- `assets/resources/art/characters/lemmy/lemmy-ear-right.png`
- `assets/resources/art/characters/lemmy/lemmy-arm-front.png`
- `assets/scripts/cocos/LemmyActor.ts`
- `scripts/cut-lemmy-parts.mjs`
- `tests/cocos/LemmyCharacterAssets.test.ts`
- `tests/cocos/LemmyActor.test.ts`

### Modify

- `assets/scripts/cocos/M01IntroSequence.ts` (Task 6 — remove direct sprite swaps + setTimeout reach hold)
- `assets/scripts/cocos/cc-shim.d.ts` (only if a new Cocos symbol is referenced in tests)
- `tests/cocosProjectScaffold.test.ts` (Task 6 — assert `LemmyActor` integration)
- `docs/design/style-references/README.md` (Task 1 — record candidate + clean master)
- `production/active.md` (Task 7 — close-out note)

### Already In Place (2026-05-28 — do not regenerate)

- `assets/art/style-references/lemmy-rabbit-canonical.png` — canonical identity source.
- `docs/design/style-references/2026-05-28-lemmy-rabbit-canonical.png` — dated canonical record.

### Leave Alone

- `assets/art/style-references/lemmy-rabbit-style-reference.png` — historical 2026-04-24 paper-backed thumbnail, retained for reference. Do not edit, do not use for runtime art generation.
- `docs/design/style-references/2026-04-24-lemmy-rabbit-style-reference.png` — historical 2026-04-24 thumbnail, retained for reference. Do not edit.
- `assets/resources/art/stage1-m01/runtime-sprites/intro/m01-lemmy-walking.png`
- `assets/resources/art/stage1-m01/runtime-sprites/intro/m01-lemmy-reaching.png`
  - These are the current stand-ins. Leave them in place during this plan so M01 keeps loading something if a Task 6 step lands before parts are present. They become orphans after the migration commit; a follow-up cleanup PR retires them and the `intro_lemmy_walking` / `intro_lemmy_reaching` manifest entries.

---

## Task 1: Save And Inspect The Canonical Lemmy [COMPLETED 2026-05-28]

**Status:** ✅ Completed 2026-05-28 by Claude. The user delivered a 2000×2000 transparent RGBA WEBP directly. Converted to PNG and saved as:

- `assets/art/style-references/lemmy-rabbit-canonical.png` (runtime path)
- `docs/design/style-references/2026-05-28-lemmy-rabbit-canonical.png` (dated record)

Alpha inspection result: 4 corner alphas = 0; 88.5% pixels transparent; whiskers + watercolor edges intact. Black-background candidate flow was not required — the user's deliverable was already a clean master.

No further action for this task. Skip to Task 3.

---

## Task 2: Produce The Transparent Clean Master [SKIPPED — clean master delivered directly]

**Status:** ⏭️ Skipped. The user delivered a fully transparent RGBA master on 2026-05-28 (see Task 1 status). Background cleanup script and asset test for "clean master" are unnecessary. The `lemmy-rabbit-canonical.png` file IS the clean master.

The companion `LemmyCharacterAssets.test.ts` test file still gets created in Task 3, but only for the four cut parts — not for a candidate-to-master pipeline.

No further action for this task. Skip to Task 3.

---

## Task 3: Cut Four Layered Parts From The Canonical Master

**Files:**
- Create: `assets/art/characters/lemmy/parts/lemmy-body.png`
- Create: `assets/art/characters/lemmy/parts/lemmy-ear-left.png`
- Create: `assets/art/characters/lemmy/parts/lemmy-ear-right.png`
- Create: `assets/art/characters/lemmy/parts/lemmy-arm-front.png`
- Create: `assets/resources/art/characters/lemmy/lemmy-body.png`
- Create: `assets/resources/art/characters/lemmy/lemmy-ear-left.png`
- Create: `assets/resources/art/characters/lemmy/lemmy-ear-right.png`
- Create: `assets/resources/art/characters/lemmy/lemmy-arm-front.png`
- Create: `assets/art/characters/lemmy/lemmy-part-pivots.json`
- Create: `scripts/cut-lemmy-parts.mjs`
- Modify: `tests/cocos/LemmyCharacterAssets.test.ts`

- [ ] **Step 1: Extend the failing asset test**

Append to `tests/cocos/LemmyCharacterAssets.test.ts`:

```ts
import { existsSync } from "node:fs";
import sharp from "sharp";

const PARTS = [
  "assets/resources/art/characters/lemmy/lemmy-body.png",
  "assets/resources/art/characters/lemmy/lemmy-ear-left.png",
  "assets/resources/art/characters/lemmy/lemmy-ear-right.png",
  "assets/resources/art/characters/lemmy/lemmy-arm-front.png"
];

describe("Lemmy slim parts", () => {
  it.each(PARTS)("%s is RGBA with transparent corners and opaque content", async (path) => {
    expect(existsSync(path)).toBe(true);
    const { data, info } = await sharp(path).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const { width: w, height: h, channels } = info;
    expect(channels).toBe(4);
    const alphaAt = (x: number, y: number) => data[(y * w + x) * 4 + 3];
    for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
      expect(alphaAt(x, y)).toBeLessThanOrEqual(2);
    }
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 16) opaque++;
    expect(opaque).toBeGreaterThan(500);
  });

  it("has a pivots manifest covering all four parts", async () => {
    const raw = await (await import("node:fs/promises")).readFile(
      "assets/art/characters/lemmy/lemmy-part-pivots.json", "utf8"
    );
    const pivots = JSON.parse(raw);
    expect(Object.keys(pivots).sort()).toEqual(
      ["arm-front", "body", "ear-left", "ear-right"]
    );
    for (const part of Object.values(pivots) as Array<{ pivot: { x: number; y: number } }>) {
      expect(part.pivot.x).toBeGreaterThanOrEqual(0);
      expect(part.pivot.x).toBeLessThanOrEqual(1);
      expect(part.pivot.y).toBeGreaterThanOrEqual(0);
      expect(part.pivot.y).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/cocos/LemmyCharacterAssets.test.ts -t "Lemmy slim parts"
```

Expected: FAIL — parts and pivots manifest do not exist yet.

- [ ] **Step 3: Cut the four parts**

Cut by hand in any image editor OR run `scripts/cut-lemmy-parts.mjs` if you prefer scripted cuts. Either way produce four transparent PNGs under `assets/art/characters/lemmy/parts/` following these rules:

- **`lemmy-body.png`**: torso + head + face (eyes, mouth, whiskers) + tail + the back-side arm baked in place. Keep all line work and watercolor for these regions in this single PNG — do not split whiskers, line overlay, or face marks into separate sprites.
- **`lemmy-ear-left.png`**: left ear only. Bottom of the canvas aligns with the ear root (the pivot). Leave ~10% transparent padding around the ear so rotation does not clip.
- **`lemmy-ear-right.png`**: same rules, right ear.
- **`lemmy-arm-front.png`**: the visible (right-facing front) arm only, from shoulder to paw, in a neutral hanging pose. Padding rules as above. Pivot is the shoulder.

Each part PNG must be at least 256×256 and have ≥ 10% transparent margin on every side.

Reference for the cut script (if used):

```js
// scripts/cut-lemmy-parts.mjs
// Cuts the 4 Lemmy parts from the clean master.
//
// This script reads hand-tuned rectangles from PART_RECTS below. Tune them by
// inspecting the master in an image editor; the script then crops + saves.
// The intent is to avoid having to author the same crop twice (once in art,
// once via a manual export).

import sharp from "sharp";

const SRC = "assets/art/style-references/lemmy-rabbit-canonical.png";
const DST_DIR = "assets/art/characters/lemmy/parts";

// Tune these for the actual master. Values here are placeholders that MUST be
// replaced after opening the cleaned master and reading pixel coords.
const PART_RECTS = {
  "lemmy-body":       { left: 0,   top: 0,   width: 0,   height: 0 },
  "lemmy-ear-left":   { left: 0,   top: 0,   width: 0,   height: 0 },
  "lemmy-ear-right":  { left: 0,   top: 0,   width: 0,   height: 0 },
  "lemmy-arm-front":  { left: 0,   top: 0,   width: 0,   height: 0 }
};

for (const [name, rect] of Object.entries(PART_RECTS)) {
  if (rect.width === 0) {
    console.error(`PART_RECTS["${name}"] is unset — open the master and fill in pixel coords first.`);
    process.exit(1);
  }
  await sharp(SRC).extract(rect).png({ compressionLevel: 9 }).toFile(`${DST_DIR}/${name}.png`);
  console.log(`wrote ${DST_DIR}/${name}.png`);
}
```

- [ ] **Step 4: Copy parts into the runtime resources folder**

```bash
mkdir -p assets/resources/art/characters/lemmy
cp assets/art/characters/lemmy/parts/lemmy-body.png      assets/resources/art/characters/lemmy/lemmy-body.png
cp assets/art/characters/lemmy/parts/lemmy-ear-left.png  assets/resources/art/characters/lemmy/lemmy-ear-left.png
cp assets/art/characters/lemmy/parts/lemmy-ear-right.png assets/resources/art/characters/lemmy/lemmy-ear-right.png
cp assets/art/characters/lemmy/parts/lemmy-arm-front.png assets/resources/art/characters/lemmy/lemmy-arm-front.png
```

The `assets/art/characters/lemmy/parts/` copy is the source-of-truth; the `assets/resources/art/characters/lemmy/` copy is what Cocos `resources.load(...)` consumes (mandated by the `resources/` root rule — see `feedback_skill_vetter`-adjacent project memory `project_m01_runtime_asset_paths`).

- [ ] **Step 5: Author the pivots manifest**

Create `assets/art/characters/lemmy/lemmy-part-pivots.json`:

```json
{
  "$schema": "lemmy-part-pivots-v1",
  "body":      { "pivot": { "x": 0.50, "y": 0.18 }, "comment": "pivot at hip center; child Node uses this for position anchor" },
  "ear-left":  { "pivot": { "x": 0.55, "y": 0.05 }, "comment": "ear root (bottom edge); rotation hinges here" },
  "ear-right": { "pivot": { "x": 0.45, "y": 0.05 }, "comment": "ear root (bottom edge); rotation hinges here" },
  "arm-front": { "pivot": { "x": 0.50, "y": 0.92 }, "comment": "shoulder; arm hangs / rotates from this point" }
}
```

Pixel-coordinate validation happens at LemmyActor `init()` (Task 4): each child node's anchor is set from this file, so wrong numbers visibly slide the part at first load. Tune in Task 7 spot-check before final commit.

- [ ] **Step 6: Run the test to verify it passes**

```bash
npm test -- tests/cocos/LemmyCharacterAssets.test.ts -t "Lemmy slim parts"
```

Expected: PASS — all 4 parts exist with transparent corners + opaque content, pivots manifest covers all 4 keys.

- [ ] **Step 7: Refresh Cocos**

Open the Cocos Creator preview server (if running) and refresh the new resource folder so `.meta` files are generated:

```text
db://assets/resources/art/characters/lemmy
```

- [ ] **Step 8: Commit**

```bash
git add assets/art/characters/lemmy assets/resources/art/characters/lemmy scripts/cut-lemmy-parts.mjs tests/cocos/LemmyCharacterAssets.test.ts
git commit -m "feat(lemmy): cut 4 layered parts from clean master + pivots manifest"
```

---

## Task 4: LemmyActor API + Cancellation Contract

**Files:**
- Create: `assets/scripts/cocos/LemmyActor.ts`
- Create: `tests/cocos/LemmyActor.test.ts`

This task adds the API surface and cancellation logic. **No tweens, no Cocos integration yet** — that lands in Task 5. The goal is a clean public contract with tests that run without a Cocos runtime.

- [ ] **Step 1: Write failing tests for pure helpers + cancellation tokens**

Create `tests/cocos/LemmyActor.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  LEMMY_APPROVED_IDENTITY_SOURCE,
  getLemmyActionSchedule,
  estimateLemmyActionDurationMs,
  createLemmyCancellationContext,
  LemmyActionInterrupted,
  LemmyActorDestroyed
} from "../../assets/scripts/cocos/LemmyActor";

describe("LemmyActor identity constants", () => {
  it("locks the canonical Lemmy identity reference", () => {
    expect(LEMMY_APPROVED_IDENTITY_SOURCE).toBe(
      "assets/art/style-references/lemmy-rabbit-canonical.png"
    );
  });
});

describe("Lemmy action schedules", () => {
  it("reach_up_right emits exactly one reach_contact between anticipation and recovery", () => {
    const schedule = getLemmyActionSchedule("reach_up_right");
    const events = schedule.filter((s) => s.event === "reach_contact");
    expect(events.length).toBe(1);
    const contact = events[0];
    const last = schedule[schedule.length - 1];
    expect(contact.atMs).toBeGreaterThan(100);
    expect(contact.atMs).toBeLessThan(last.atMs - 100);
  });

  it("walk_right has no reach_contact event", () => {
    expect(getLemmyActionSchedule("walk_right").some((s) => s.event === "reach_contact")).toBe(false);
  });

  it("idle_right has no reach_contact event and loops", () => {
    const schedule = getLemmyActionSchedule("idle_right");
    expect(schedule.some((s) => s.event === "reach_contact")).toBe(false);
  });

  it("estimateLemmyActionDurationMs returns last keyframe atMs", () => {
    const schedule = getLemmyActionSchedule("reach_up_right");
    expect(estimateLemmyActionDurationMs("reach_up_right")).toBe(schedule[schedule.length - 1].atMs);
  });
});

describe("Lemmy cancellation context", () => {
  it("supersedes the previous token and rejects pending promise with LemmyActionInterrupted", async () => {
    const ctx = createLemmyCancellationContext();
    const first = ctx.beginAction("walk_right");
    const second = ctx.beginAction("reach_up_right");
    await expect(first.promise).rejects.toBeInstanceOf(LemmyActionInterrupted);
    expect(second.token.isActive).toBe(true);
  });

  it("destroy() rejects the active token with LemmyActorDestroyed", async () => {
    const ctx = createLemmyCancellationContext();
    const active = ctx.beginAction("walk_right");
    ctx.destroy();
    await expect(active.promise).rejects.toBeInstanceOf(LemmyActorDestroyed);
    expect(active.token.isActive).toBe(false);
  });

  it("resolve() on the active token resolves the promise", async () => {
    const ctx = createLemmyCancellationContext();
    const active = ctx.beginAction("walk_right");
    ctx.resolveActive();
    await expect(active.promise).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- tests/cocos/LemmyActor.test.ts
```

Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement the pure helpers + constants**

Create `assets/scripts/cocos/LemmyActor.ts`:

```ts
import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, Vec3, resources, tween } from "cc";

const { ccclass } = _decorator;

// ---------------------------------------------------------------------------
// Identity constants — single source of truth for any Lemmy generation tool.
// ---------------------------------------------------------------------------

export const LEMMY_APPROVED_IDENTITY_SOURCE =
  "assets/art/style-references/lemmy-rabbit-canonical.png";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LemmyActionId = "idle_right" | "walk_right" | "reach_up_right";
export type LemmyActorEvent = "reach_contact" | "footstep_left" | "footstep_right";

export interface LemmyScheduleEntry {
  /** Time offset in ms from the action start. */
  atMs: number;
  /** Optional named event emitted at this offset. */
  event?: LemmyActorEvent;
  /** Optional body bob offset (px) applied to the body child node at this keyframe. */
  bodyBobY?: number;
  /** Optional ear rotation deg (positive = outward) applied at this keyframe. */
  earRotateDeg?: number;
  /** Optional front-arm rotation deg (0 = hanging, 90 = up) applied at this keyframe. */
  armRotateDeg?: number;
}

export interface LemmyActorOptions {
  /** Where Lemmy should render. */
  node: Node;
  /** Display size in world units (matches the existing M01 LEMMY_DISPLAY). */
  displaySize: { width: number; height: number };
  /** Resource paths (relative to `assets/resources/`) for the four parts. */
  partResourcePaths: {
    body: string;
    earLeft: string;
    earRight: string;
    armFront: string;
  };
  /** Pivot manifest (loaded from lemmy-part-pivots.json). Used to set Node anchors. */
  pivots: {
    "body": { pivot: { x: number; y: number } };
    "ear-left": { pivot: { x: number; y: number } };
    "ear-right": { pivot: { x: number; y: number } };
    "arm-front": { pivot: { x: number; y: number } };
  };
}

export interface LemmyPlayOptions {
  loop?: boolean;
  onEvent?: (event: LemmyActorEvent) => void;
}

export interface LemmyWalkOptions {
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Schedules — the SFX sync truth. Changing a number here means reviewing tied
// audio cues and contact-frame consumers.
// ---------------------------------------------------------------------------

const SCHEDULES: Record<LemmyActionId, LemmyScheduleEntry[]> = {
  idle_right: [
    { atMs:    0, bodyBobY:  0, earRotateDeg:  0 },
    { atMs:  800, bodyBobY:  2, earRotateDeg:  4 },
    { atMs: 1600, bodyBobY:  0, earRotateDeg: -3 },
    { atMs: 2400, bodyBobY:  2, earRotateDeg:  4 },
    { atMs: 3200, bodyBobY:  0, earRotateDeg:  0 }
  ],
  walk_right: [
    { atMs:    0, bodyBobY:  0, earRotateDeg:   0, armRotateDeg:   0 },
    { atMs:  150, bodyBobY:  4, earRotateDeg:   8, armRotateDeg:  10, event: "footstep_left" },
    { atMs:  300, bodyBobY:  0, earRotateDeg:  -4, armRotateDeg:   0 },
    { atMs:  450, bodyBobY:  4, earRotateDeg:   8, armRotateDeg: -10, event: "footstep_right" },
    { atMs:  600, bodyBobY:  0, earRotateDeg:   0, armRotateDeg:   0 }
  ],
  reach_up_right: [
    { atMs:    0, bodyBobY:  0, armRotateDeg:   0 },
    { atMs:  200, bodyBobY: -4, armRotateDeg:  35 }, // anticipation: squash + arm lifts
    { atMs:  380, bodyBobY: -6, armRotateDeg:  90, event: "reach_contact" }, // contact
    { atMs:  500, bodyBobY: -6, armRotateDeg: 100 }, // apex hold
    { atMs:  800, bodyBobY:  0, armRotateDeg:   0 }  // recovery
  ]
};

export function getLemmyActionSchedule(action: LemmyActionId): LemmyScheduleEntry[] {
  return SCHEDULES[action];
}

export function estimateLemmyActionDurationMs(action: LemmyActionId): number {
  const schedule = SCHEDULES[action];
  return schedule[schedule.length - 1].atMs;
}

// ---------------------------------------------------------------------------
// Cancellation contract — pure, testable, Cocos-free.
// ---------------------------------------------------------------------------

export class LemmyActionInterrupted extends Error {
  constructor(public readonly action: string) {
    super(`Lemmy action interrupted: ${action}`);
    this.name = "LemmyActionInterrupted";
  }
}

export class LemmyActorDestroyed extends Error {
  constructor() {
    super("Lemmy actor destroyed");
    this.name = "LemmyActorDestroyed";
  }
}

export interface LemmyActionToken {
  isActive: boolean;
}

export interface LemmyActiveAction {
  token: LemmyActionToken;
  promise: Promise<void>;
}

export interface LemmyCancellationContext {
  beginAction(action: string): LemmyActiveAction;
  resolveActive(): void;
  destroy(): void;
}

export function createLemmyCancellationContext(): LemmyCancellationContext {
  let active: {
    action: string;
    token: { isActive: boolean };
    resolve: () => void;
    reject: (err: Error) => void;
  } | null = null;

  return {
    beginAction(action) {
      if (active) {
        active.token.isActive = false;
        active.reject(new LemmyActionInterrupted(active.action));
      }
      let resolve!: () => void;
      let reject!: (err: Error) => void;
      const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
      const token = { isActive: true };
      active = { action, token, resolve, reject };
      return { token, promise };
    },
    resolveActive() {
      if (!active) return;
      active.token.isActive = false;
      active.resolve();
      active = null;
    },
    destroy() {
      if (!active) return;
      active.token.isActive = false;
      active.reject(new LemmyActorDestroyed());
      active = null;
    }
  };
}

// ---------------------------------------------------------------------------
// LemmyActor component — Task 5 fills in the tween/render layer.
// ---------------------------------------------------------------------------

@ccclass("LemmyActor")
export class LemmyActor extends Component {
  private opts: LemmyActorOptions | null = null;
  private cancellation = createLemmyCancellationContext();
  private readyPromise: Promise<void> | null = null;
  private bodyNode: Node | null = null;
  private earLeftNode: Node | null = null;
  private earRightNode: Node | null = null;
  private armFrontNode: Node | null = null;

  init(options: LemmyActorOptions): Promise<void> {
    this.opts = options;
    this.readyPromise = this.loadAndMountParts();
    return this.readyPromise;
  }

  // Walk / playAction / playIdle filled in Task 5. The signatures are locked here.
  walkTo(_target: Vec3, _options?: LemmyWalkOptions): Promise<void> {
    throw new Error("LemmyActor.walkTo not implemented yet (Task 5)");
  }
  playAction(_action: LemmyActionId, _options?: LemmyPlayOptions): Promise<void> {
    throw new Error("LemmyActor.playAction not implemented yet (Task 5)");
  }
  playIdle(): void {
    throw new Error("LemmyActor.playIdle not implemented yet (Task 5)");
  }

  onDestroy(): void {
    this.cancellation.destroy();
  }

  private async loadAndMountParts(): Promise<void> {
    // Implemented in Task 5.
    return Promise.resolve();
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- tests/cocos/LemmyActor.test.ts
```

Expected: PASS — identity constants, schedules, and cancellation context tests all green.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: clean. If `cc-shim.d.ts` is missing any symbol referenced above (e.g. `Sprite`, `SpriteFrame`, `tween`, `resources.load`), add a minimal declaration in `assets/scripts/cocos/cc-shim.d.ts`.

- [ ] **Step 6: Commit**

```bash
git add assets/scripts/cocos/LemmyActor.ts tests/cocos/LemmyActor.test.ts assets/scripts/cocos/cc-shim.d.ts
git commit -m "feat(lemmy): LemmyActor API + schedules + cancellation contract"
```

---

## Task 5: Tween-Driven Actions And reach_contact Event

**Files:**
- Modify: `assets/scripts/cocos/LemmyActor.ts`
- Modify: `tests/cocos/LemmyActor.test.ts`

This task fills in the parts loading, mounting, and tween-driven action playback. The `reach_contact` event is emitted from inside the tween chain at the schedule's contact offset.

- [ ] **Step 1: Add failing tests for tween orchestration via the cancellation hook**

Append to `tests/cocos/LemmyActor.test.ts`:

```ts
import { applyLemmyScheduleToTween, buildLemmyEventTimeline } from "../../assets/scripts/cocos/LemmyActor";

describe("Lemmy schedule application (pure)", () => {
  it("buildLemmyEventTimeline lists every event in chronological order", () => {
    const timeline = buildLemmyEventTimeline("reach_up_right");
    expect(timeline.map((e) => e.event)).toEqual(["reach_contact"]);
    expect(timeline[0].atMs).toBe(380);
  });

  it("walk_right timeline contains two footsteps with footstep_left first", () => {
    const timeline = buildLemmyEventTimeline("walk_right");
    expect(timeline.map((e) => e.event)).toEqual(["footstep_left", "footstep_right"]);
    expect(timeline[0].atMs).toBeLessThan(timeline[1].atMs);
  });

  it("applyLemmyScheduleToTween invokes the recorder with each keyframe in order", () => {
    const calls: Array<{ atMs: number; bodyBobY?: number; armRotateDeg?: number; event?: string }> = [];
    applyLemmyScheduleToTween("reach_up_right", (entry) => {
      calls.push({
        atMs: entry.atMs,
        bodyBobY: entry.bodyBobY,
        armRotateDeg: entry.armRotateDeg,
        event: entry.event
      });
    });
    expect(calls.map((c) => c.atMs)).toEqual([0, 200, 380, 500, 800]);
    expect(calls.find((c) => c.event === "reach_contact")?.atMs).toBe(380);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/cocos/LemmyActor.test.ts -t "schedule application"
```

Expected: FAIL — `applyLemmyScheduleToTween` and `buildLemmyEventTimeline` do not exist.

- [ ] **Step 3: Implement pure timeline + apply helpers**

Add to `assets/scripts/cocos/LemmyActor.ts` (just below the schedules constant):

```ts
export function buildLemmyEventTimeline(
  action: LemmyActionId
): Array<{ atMs: number; event: LemmyActorEvent }> {
  return SCHEDULES[action]
    .filter((entry): entry is LemmyScheduleEntry & { event: LemmyActorEvent } => Boolean(entry.event))
    .map((entry) => ({ atMs: entry.atMs, event: entry.event }));
}

export function applyLemmyScheduleToTween(
  action: LemmyActionId,
  recorder: (entry: LemmyScheduleEntry) => void
): void {
  for (const entry of SCHEDULES[action]) recorder(entry);
}
```

- [ ] **Step 4: Implement parts loading + mounting**

Replace the stub `loadAndMountParts` in `LemmyActor.ts`:

```ts
private async loadAndMountParts(): Promise<void> {
  if (!this.opts) throw new Error("LemmyActor.init() must be called before mounting");
  const { node, displaySize, partResourcePaths, pivots } = this.opts;

  const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  transform.setContentSize(displaySize.width, displaySize.height);

  const mount = async (
    childName: string,
    resourcePath: string,
    pivot: { x: number; y: number }
  ): Promise<Node> => {
    const child = new Node(childName);
    node.addChild(child);
    const childTransform = child.addComponent(UITransform);
    childTransform.setAnchorPoint(pivot.x, pivot.y);

    const sprite = child.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.RAW;

    return await new Promise<Node>((resolve, reject) => {
      resources.load(resourcePath, SpriteFrame, (err, frame) => {
        if (err || !frame) {
          reject(err ?? new Error(`failed to load ${resourcePath}`));
          return;
        }
        sprite.spriteFrame = frame;
        resolve(child);
      });
    });
  };

  // Mount in back-to-front draw order: body first, then ears (behind face? in front?),
  // then front arm. For right-facing Lemmy, ears sit behind the head silhouette except
  // at the tips — accept a small overlap for MVP; revisit per-frame ordering only if
  // it visibly fails in Task 7 spot-check.
  this.bodyNode = await mount("LemmyBody", partResourcePaths.body, pivots["body"].pivot);
  this.earLeftNode = await mount("LemmyEarLeft", partResourcePaths.earLeft, pivots["ear-left"].pivot);
  this.earRightNode = await mount("LemmyEarRight", partResourcePaths.earRight, pivots["ear-right"].pivot);
  this.armFrontNode = await mount("LemmyArmFront", partResourcePaths.armFront, pivots["arm-front"].pivot);
}
```

- [ ] **Step 5: Implement walkTo, playAction, playIdle**

Replace the three stubs:

```ts
walkTo(target: Vec3, options: LemmyWalkOptions = {}): Promise<void> {
  if (!this.opts) return Promise.reject(new Error("LemmyActor.init() not called"));
  const action = this.cancellation.beginAction("walkTo");
  const durationSec = (options.durationMs ?? 1800) / 1000;
  const node = this.opts.node;

  // Horizontal slide + per-keyframe body bob + ear flop + arm gentle swing from
  // the walk_right schedule, looped over the slide.
  tween(node)
    .to(durationSec, { position: target }, { easing: "sineInOut" })
    .call(() => {
      if (action.token.isActive) this.cancellation.resolveActive();
    })
    .start();

  this.driveSchedule("walk_right", action.token, { loop: true });
  return action.promise;
},

playAction(action: LemmyActionId, options: LemmyPlayOptions = {}): Promise<void> {
  if (!this.opts) return Promise.reject(new Error("LemmyActor.init() not called"));
  const handle = this.cancellation.beginAction(action);
  this.driveSchedule(action, handle.token, { loop: options.loop ?? false, onEvent: options.onEvent });
  return handle.promise;
},

playIdle(): void {
  const handle = this.cancellation.beginAction("idle_right");
  this.driveSchedule("idle_right", handle.token, { loop: true });
}
```

And add the `driveSchedule` helper as a private method:

```ts
private driveSchedule(
  action: LemmyActionId,
  token: LemmyActionToken,
  options: { loop: boolean; onEvent?: (event: LemmyActorEvent) => void }
): void {
  const schedule = SCHEDULES[action];
  const totalMs = schedule[schedule.length - 1].atMs;

  const playOnce = (): void => {
    if (!token.isActive) return;

    let bodyChain = tween(this.bodyNode!);
    let armChain = this.armFrontNode ? tween(this.armFrontNode) : null;
    let earLeftChain = this.earLeftNode ? tween(this.earLeftNode) : null;
    let earRightChain = this.earRightNode ? tween(this.earRightNode) : null;

    let prevMs = 0;
    for (const entry of schedule) {
      const segmentSec = Math.max(0, (entry.atMs - prevMs) / 1000);
      if (entry.bodyBobY !== undefined && this.bodyNode) {
        bodyChain = bodyChain.to(segmentSec, { position: new Vec3(0, entry.bodyBobY, 0) }, { easing: "sineInOut" });
      }
      if (entry.armRotateDeg !== undefined && armChain) {
        armChain = armChain.to(segmentSec, { eulerAngles: new Vec3(0, 0, entry.armRotateDeg) }, { easing: "sineInOut" });
      }
      if (entry.earRotateDeg !== undefined) {
        if (earLeftChain) earLeftChain = earLeftChain.to(segmentSec, { eulerAngles: new Vec3(0, 0, entry.earRotateDeg) }, { easing: "sineInOut" });
        if (earRightChain) earRightChain = earRightChain.to(segmentSec, { eulerAngles: new Vec3(0, 0, -entry.earRotateDeg) }, { easing: "sineInOut" });
      }
      if (entry.event) {
        const eventName = entry.event;
        bodyChain = bodyChain.call(() => {
          if (token.isActive && options.onEvent) options.onEvent(eventName);
        });
      }
      prevMs = entry.atMs;
    }

    bodyChain = bodyChain.call(() => {
      if (!token.isActive) return;
      if (options.loop) playOnce();
      else this.cancellation.resolveActive();
    });

    bodyChain.start();
    if (armChain) armChain.start();
    if (earLeftChain) earLeftChain.start();
    if (earRightChain) earRightChain.start();
  };

  playOnce();
}
```

- [ ] **Step 6: Run pure tests to verify they pass**

```bash
npm test -- tests/cocos/LemmyActor.test.ts
```

Expected: PASS — both the cancellation tests (from Task 4) and the new schedule-application tests stay green.

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add assets/scripts/cocos/LemmyActor.ts tests/cocos/LemmyActor.test.ts
git commit -m "feat(lemmy): tween-driven idle/walk/reach with reach_contact event"
```

---

## Task 6: Wire M01IntroSequence To LemmyActor

**Files:**
- Modify: `assets/scripts/cocos/M01IntroSequence.ts`
- Modify: `tests/cocosProjectScaffold.test.ts`

- [ ] **Step 1: Write failing scaffold tests**

Append to `tests/cocosProjectScaffold.test.ts`:

```ts
import { readFileSync } from "node:fs";

describe("M01IntroSequence uses LemmyActor", () => {
  const source = readFileSync("assets/scripts/cocos/M01IntroSequence.ts", "utf8");

  it("imports LemmyActor", () => {
    expect(source).toMatch(/import\s*\{[^}]*\bLemmyActor\b[^}]*\}\s*from\s*['"]\.\/LemmyActor['"]/);
  });

  it("does not swap Lemmy spriteFrame directly for walking/reaching", () => {
    expect(source).not.toMatch(/swapSprite\(this\.lemmySprite,\s*['"]walking['"]\)/);
    expect(source).not.toMatch(/swapSprite\(this\.lemmySprite,\s*['"]reaching['"]\)/);
  });

  it("does not use setTimeout for REACH_HOLD_DURATION", () => {
    expect(source).not.toMatch(/setTimeout\([^)]*REACH_HOLD_DURATION/);
  });

  it("references reach_contact as the basket trigger", () => {
    expect(source).toMatch(/reach_contact/);
  });

  it("defines M01_INTRO_ANCHORS with basketReach and watchingPoint", () => {
    expect(source).toMatch(/M01_INTRO_ANCHORS\s*=/);
    expect(source).toMatch(/basketReach[^}]+approachPoint/);
    expect(source).toMatch(/watchingPoint[^}]+approachPoint/);
  });
});
```

- [ ] **Step 2: Run scaffold test to verify it fails**

```bash
npm test -- tests/cocosProjectScaffold.test.ts -t "M01IntroSequence uses LemmyActor"
```

Expected: FAIL on every assertion — current intro still uses `swapSprite` + `setTimeout` and has no anchors.

- [ ] **Step 3: Refactor `M01IntroSequence.ts`**

Replace the existing `M01IntroSequence` choreography block. Key edits:

1. Add the import:
   ```ts
   import { LemmyActor, LemmyActionInterrupted, LemmyActorDestroyed } from "./LemmyActor";
   ```

2. Replace the `LEMMY_DISPLAY` / waypoint constants block with an anchor object:
   ```ts
   const M01_INTRO_ANCHORS = {
     start:         { approachPoint: new Vec3(LEMMY_OFFSCREEN_X, LEMMY_Y, 0) },
     basketReach:   {
       approachPoint: new Vec3(LEMMY_UNDER_BASKET_X, LEMMY_Y, 0),
       facing: "right" as const,
       action: "reach_up_right" as const,
       contactEvent: "reach_contact" as const
     },
     watchingPoint: { approachPoint: new Vec3(LEMMY_WATCHING_X, LEMMY_Y, 0) }
   };
   ```

3. Replace `spawnLemmy()` so it attaches `LemmyActor` instead of a single `Sprite`:
   ```ts
   private async spawnLemmy(): Promise<void> {
     const node = new Node("M01IntroLemmy");
     node.setPosition(M01_INTRO_ANCHORS.start.approachPoint);
     this.node.addChild(node);

     const actor = node.addComponent(LemmyActor);
     this.lemmyActor = actor;
     this.lemmyNode = node;

     const pivots = JSON.parse(
       (await import("../../art/characters/lemmy/lemmy-part-pivots.json"))?.default ??
       "{}"
     );

     await actor.init({
       node,
       displaySize: LEMMY_DISPLAY,
       partResourcePaths: {
         body:     "art/characters/lemmy/lemmy-body",
         earLeft:  "art/characters/lemmy/lemmy-ear-left",
         earRight: "art/characters/lemmy/lemmy-ear-right",
         armFront: "art/characters/lemmy/lemmy-arm-front"
       },
       pivots
     });
     actor.playIdle();
   }
   ```

   (Note: the dynamic JSON import path matches the source-of-truth location under `assets/art/characters/lemmy/`. If the Cocos bundler refuses to import JSON from outside `assets/resources/`, copy the JSON into `assets/resources/art/characters/lemmy/lemmy-part-pivots.json` and load it via `resources.load`.)

4. Remove `loadSpriteFrames` for the Lemmy entries (`intro_lemmy_walking`, `intro_lemmy_reaching`) — the actor owns its own loading now. Keep basket / rope loading untouched.

5. Replace `beginWalk`:
   ```ts
   private async beginWalk(): Promise<void> {
     if (!this.lemmyActor) return;
     this.phase = "walking";
     try {
       await this.lemmyActor.walkTo(M01_INTRO_ANCHORS.basketReach.approachPoint, {
         durationMs: WALK_TO_BASKET_DURATION * 1000
       });
       // 200ms settle pause before reaching — avoids hard cut from walk to anticipation
       await this.lemmyActor.playAction("idle_right", { loop: false });
       await this.beginReach();
     } catch (err) {
       if (err instanceof LemmyActionInterrupted || err instanceof LemmyActorDestroyed) return;
       throw err;
     }
   }
   ```

6. Replace `beginReach`:
   ```ts
   private async beginReach(): Promise<void> {
     if (!this.lemmyActor) return;
     this.phase = "reaching";
     try {
       await this.lemmyActor.playAction("reach_up_right", {
         onEvent: (event) => {
           if (event === M01_INTRO_ANCHORS.basketReach.contactEvent) this.wobbleBasket();
         }
       });
     } catch (err) {
       if (err instanceof LemmyActionInterrupted || err instanceof LemmyActorDestroyed) return;
       throw err;
     }
   }
   ```

7. Replace `beginExit`:
   ```ts
   private async beginExit(): Promise<void> {
     if (!this.lemmyActor) return;
     this.phase = "exiting";
     try {
       await this.lemmyActor.walkTo(M01_INTRO_ANCHORS.watchingPoint.approachPoint, {
         durationMs: LEMMY_EXIT_DURATION * 1000
       });
       this.finishIntro();
     } catch (err) {
       if (err instanceof LemmyActionInterrupted || err instanceof LemmyActorDestroyed) return;
       throw err;
     }
   }
   ```

8. Delete `swapSprite`, `loadSpriteFrames` Lemmy branches, the `SpriteKey.walking | reaching` enum entries, the `lemmySprite` field, and the `REACH_HOLD_DURATION` constant (or keep `REACH_HOLD_DURATION` only if some non-Lemmy timing references it — grep confirms it does not).

9. Make `init` await `spawnLemmy()` if you converted it to async.

- [ ] **Step 4: Run scaffold test to verify it passes**

```bash
npm test -- tests/cocosProjectScaffold.test.ts -t "M01IntroSequence uses LemmyActor"
```

Expected: PASS — all five assertions green.

- [ ] **Step 5: Run full targeted test suite**

```bash
npm test -- tests/cocos/LemmyActor.test.ts tests/cocos/LemmyCharacterAssets.test.ts tests/cocosProjectScaffold.test.ts
npm run typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add assets/scripts/cocos/M01IntroSequence.ts tests/cocosProjectScaffold.test.ts
git commit -m "feat(m01): wire intro choreography to LemmyActor + reach_contact event"
```

---

## Task 7: Preview Verification + Visual Spot-Check

**Files:**
- Optional create: `temp/lemmy-slim-spot-check/contact-sheet.png`
- Modify: `production/active.md`

- [ ] **Step 1: Refresh Cocos**

In the Cocos Creator preview server, refresh:

```text
db://assets/resources/art/characters/lemmy
db://assets/scripts
```

If the preview server is **not** running and you only have file-level access, restart it manually — `.ts` edits require a restart per project memory `project_cocos_preview_refresh_rules`.

- [ ] **Step 2: Run the M01 preview smoke**

```bash
npm run smoke:m01-preview -- --enable-art-preview
```

Expected:

- no console errors
- M01 reaches the completion path
- on basket tap: Lemmy walks toward the basket, settles, plays reach
- `reach_contact` fires; basket wobbles + tips
- 9 fragments release
- Lemmy walks to the watching anchor
- `physicsSettled === true`

If smoke fails, treat as a real blocker — do not "skip with a note." Inspect the page console first, then the actor's init promise.

- [ ] **Step 3: Author the visual spot-check contact sheet**

Compose a 1×4 contact sheet (any image tool, e.g. `sharp` script or manual) showing:

1. `lemmy-body` alone, neutral pose
2. body + ear-left + ear-right at idle keyframe 0
3. body + ear-left + ear-right + arm-front at reach apex (arm rotated to ~90°)
4. The 2026-05-28 canonical (`LEMMY_APPROVED_IDENTITY_SOURCE`) for reference

Save to:

```text
temp/lemmy-slim-spot-check/contact-sheet.png
```

Visually confirm:

- silhouette still reads as Lemmy
- watercolor palette (red + blue-gray) has not drifted
- whiskers still visible on the body part
- arm overlay sits naturally at the shoulder (pivot is correct)
- ear pivots are at the root, not the tip (ears rotate, do not slide)

If any of these fail, return to Task 3 and adjust the cut rectangles or pivots manifest, re-run Task 3's tests, then re-run Task 7.

- [ ] **Step 4: Update `production/active.md`**

Append a 2026-05-27 close-out note explaining: which parts shipped, that the renderer is `cc.tween`-based (no DragonBones / Skeleton2D), where the schedules live, and what is explicitly deferred (left-facing pair, per-puzzle reactions for M02–M10, accent/smear frames).

- [ ] **Step 5: Final verification**

```bash
npm test
npm run typecheck
git diff --check
```

Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add temp/lemmy-slim-spot-check production/active.md
git commit -m "chore(lemmy): m01 preview verification + spot-check contact sheet"
```

---

## Final Verification

When all 7 tasks are done, the following must all be true:

```bash
npm test -- tests/cocos/LemmyCharacterAssets.test.ts tests/cocos/LemmyActor.test.ts tests/cocosProjectScaffold.test.ts
npm run typecheck
git diff --check
npm run smoke:m01-preview -- --enable-art-preview
```

All four commands clean. M01 intro reads as the approved Lemmy in preview. The codex review notes below should already be incorporated or explicitly answered.

---

## Handoff Notes For Codex Review

Codex, you wrote the 13-part DragonBones plan. This plan replaces yours **only if** you sign off below. The substantive disagreements you should rule on:

1. **Part count: 13 vs 4.** This plan argues 4 is sufficient for the MVP's actual Lemmy use cases (M01 reach + 9 puzzles where Lemmy mostly stands and reacts). If you believe any single planned puzzle (M02–M10) requires more granular body deformation than 4 layered tween-driven sprites can give, name it and propose a delta.
2. **Renderer: skeleton vs `cc.tween` on Node children.** This plan rejects DragonBones / Skeleton2D for MVP because (a) no skeleton infrastructure exists in the repo, (b) the hand-drawn aesthetic clashes with bone deformation, (c) DragonBones binding in Cocos 3.8 is editor-bound and agent-hostile. If you have a concrete reason `cc.tween` will fail to deliver a readable walk/reach (specific puzzle, specific motion), name it.
3. **Whiskers + line overlay baked into `body`.** Your plan promised separate `lemmy-whiskers.png` and `lemmy-line-overlay.png` overlays. This plan argues those overlays cannot believably follow head rotation as flat planes and would either swim or have to be re-cut per part. Disagree only if you have a working pattern from another Cocos project.
4. **Accent / smear frames out of scope.** Your plan reserves slots. This plan defers until a real M01–M10 reach reads as too clean. Disagree only with a concrete pose where the slim rig is known to fall short.
5. **Per-puzzle reactions.** This plan does not author any M02–M10 actions. Each level can add a new `LemmyActionId` and a schedule entry in <30 lines. Confirm this is acceptable instead of pre-authoring a full action library.

Items where this plan **agrees** with yours (no disagreement expected):

- `LemmyActor` renderer-neutral API.
- Cancellation contract with `LemmyActionInterrupted` / `LemmyActorDestroyed`.
- Identity source constant (`LEMMY_APPROVED_IDENTITY_SOURCE`).
- Clean master pipeline step (Task 1 + 2).
- Visual spot-check before commit (Task 7 step 3).
- Settle-in pause between walk and reach (Task 6 step 3 item 5).
- TDD red → impl → green per task.
- Frame durations / schedules as the eventual SFX sync source.

If you approve: leave a note in this file's bottom block. If you have rebuttals, append them below and ping the user.
