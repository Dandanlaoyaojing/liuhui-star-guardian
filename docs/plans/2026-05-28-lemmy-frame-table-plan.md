# Lemmy Frame-Table Animation Plan (Arrog-Aligned)

> **⚠️ SUPERSEDED 2026-05-28** — replaced by [`docs/plans/2026-05-28-lemmy-transform-anim-plan.md`](2026-05-28-lemmy-transform-anim-plan.md). The Luma frame-generation approach was abandoned after the drift-gate (`--ref`) AND `--modify` image-edit both proved AI regeneration drifts Lemmy's identity — even a one-word "close the eye" edit repainted the whole rabbit (evidence: `temp/lemmy-frame-spot-check/modify-test/canonical-vs-blink.png`). Final approach: transform the single canonical sprite (position/rotation/scale/squash) + one hand-drawn reach-up pose. The drift-gate / modify-test machinery in this plan was run and is retained only as the evidence that justified the pivot.

> **Author:** Claude (Opus 4.7, 1M context)
> **Date:** 2026-05-28
> **Status:** Superseded 2026-05-28 (drift-gate ran, AI generation rejected)
> **Supersedes:** `docs/plans/2026-05-27-lemmy-slim-actor-plan.md`
> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task. Steps use checkbox (`- [ ]`) syntax. Follow `superpowers:test-driven-development` per task.

**Goal:** Animate Lemmy with a small set of hand-composed single-PNG frames per action, played back via a `update(deltaTime)` frame-table — the same range Arrog uses — instead of cut-out puppet layers tweened at runtime.

**Architecture:** Take the 2026-05-28 canonical Lemmy and cut **four production-source parts** (body, ear-left, ear-right, arm-front) from it. Those parts are dev-only素材 — they do not ship as runtime sprites. In an external image tool (Photoshop / Affinity Photo / Krita / Procreate), manually position the four parts to author each pose, then flatten to a single transparent PNG. Each flattened PNG is one runtime frame. `LemmyActor` mounts **one** `Sprite` child and swaps `spriteFrame` on a `deltaTime` accumulator. Action schedules become `LemmyActionClip[]` of `{ resourcePath, durationMs, event? }`. Codex's `LemmyActorContract` cancellation logic is kept; the tween-based `playPose` / `driveSchedule` is removed.

**Tech Stack:** Cocos Creator 3.8 TypeScript, `sprite.spriteFrame` swap via `Component.update(deltaTime)`, `resources.load(SpriteFrame)`, Vitest pure-helper tests, an external image tool for frame composition. No `cc.tween` for character pose. No DragonBones. No `.anim`.

---

## Why This Plan Exists (2026-05-28 Direction Revision)

The 2026-05-27 slim plan proposed 4-layer cut-out + `cc.tween` rotation/translation on child nodes. After researching Arrog's actual production tech via the IGF interview with director Mateo Alayza on Game Developer ("We used hand drawings for the characters, scanned textures of paper for the background, Unity for the programming, and some shaders to make a common visual language with everything"), three facts forced a course correction:

1. Arrog animates with **hand-drawn frame sequences**, not layered puppets. Every Arrog frame is a complete drawing; there is no Spine / DragonBones / Live2D / Toon Boom in the credits.
2. The "略带不完美的纸感" aesthetic of Arrog comes from per-frame hand variation. Tween easing curves produce mathematical smoothness — the opposite of the target feel. This is the structural reason the slim plan's puppet path would land at ~4/10 fidelity even with all three bugs from the 2026-05-28 code review fixed.
3. The user observed: "莱米的动画效果并不多" — Lemmy's action vocabulary across the 10 MVP puzzles is small (idle + walk + reach + per-puzzle micro-reactions). This matches Arrog's typical 2–6 frames per action, which makes the per-frame production cost feasible for a single-dev team.

The **layered parts work codex already shipped is not wasted** — it becomes a production素材 library. Instead of mounting the 4 parts as runtime layers, we use them as building blocks in an external image tool to compose each pose by hand, then flatten to a single PNG per frame. Identity stays locked (parts come from the canonical master), production cost stays low (5–15 min per frame instead of 1–2 hours of free-hand drawing), and runtime stays simple (one sprite, swap-per-frame).

## Diff vs The Slim Plan

| Concern | Slim plan (superseded) | This plan |
|---|---|---|
| Aesthetic anchor fidelity to Arrog | ~4/10 (puppet stand-in) | ~7/10 (true frame-by-frame range; gap is paper-shader, deferred) |
| Runtime layer count | 4 (body + 2 ears + arm) | **1** (single Sprite, frame swapped) |
| Action driver | `cc.tween` chained `.delay`/`.call` on child nodes | `Component.update(dt)` accumulator |
| Frame count per action | implicit (continuous tween) | **explicit small set** (idle 5, walk 8, reach 6 = 19 total) |
| Pose data | keyframe `{ bodyOffsetY, earRotateDeg, … }` | `{ resourcePath, durationMs, event? }` |
| 4-part PNGs | mounted as runtime layers | **production素材 only**, used in external image tool |
| Pivot problem (slim plan Bug 2) | open | gone — no rotated layers at runtime |
| body含耳/arm 重影 (slim plan Bug 1) | open | gone — body part exists only as素材, not runtime |
| Cancellation tween-gate (slim plan Bug 3) | open | resolved — `update(dt)` checks `token.isActive` per tick |
| Single-dev cost | low | medium (manual per-frame composition) |
| Identity drift risk | low | low (parts come from canonical, composition is mechanical) |

## What Carries Over From Codex's Implementation

Codex's 2026-05-27 PR materials are partially reused. Concrete inventory:

### Keep verbatim
- `assets/scripts/cocos/LemmyActorContract.ts`:
  - `LEMMY_APPROVED_IDENTITY_SOURCE` constant — pointed at `lemmy-rabbit-canonical.png` after the slim plan revision. (Codex's separate `LEMMY_CLEAN_MASTER_PATH` constant is dropped — redundant with IDENTITY_SOURCE now that the canonical IS the clean master.)
  - `LemmyActionInterrupted`, `LemmyActorDestroyed` error classes.
  - `LemmyActionToken`, `LemmyActionHandle`, `LemmyCancellationContext` interfaces.
  - `createLemmyCancellationContext()` factory.
  - `isExpectedLemmyActionCancel()` helper.
- `assets/scripts/cocos/M01IntroSequence.ts` diff (the `async beginWalk` / `await this.lemmyActor.walkTo` / `await this.lemmyActor.playAction` shape and the `isExpectedLemmyActionCancel` catch). The public `LemmyActor` API does not change in this plan; only the internals change.
- `assets/scripts/cocos/M01GreyboxArt.ts` addition of `getM01GreyboxRuntimeLemmyLayerResource` — repurposed as `getM01GreyboxRuntimeLemmyFrameResource` (renamed; same manifest pattern).
- `scripts/prepare-lemmy-layered-proof.py` script structure — modified in Task 3 to (a) read from canonical, (b) exclude ears + arm pixels from the body output.

### Remove / Replace
- `LemmyActorContract.ts → LEMMY_ACTION_SCHEDULES` keyframe data (`bodyOffsetY`, `earRotateDeg`, …) is replaced by `LEMMY_ACTION_CLIPS` frame data (`resourcePath`, `durationMs`, `event`).
- `LemmyActor.ts → playPose`, `driveSchedule`, `nearestScheduleEntry`, `mountLayer`, the four `bodyNode` / `earLeftNode` / `earRightNode` / `armFrontNode` fields → replaced by one `frameSprite: Sprite` field + an `update(dt)` frame accumulator.
- The four runtime parts under `assets/resources/art/characters/lemmy/lemmy-*.png` are **not** the runtime assets anymore. They move (or get re-cut) into `assets/art/characters/lemmy/parts/` only. The `assets/resources/art/characters/lemmy/` runtime folder gets a new `frames/` subdirectory.
- `tests/cocos/LemmyActor.test.ts` assertions for `playPose` / pose keyframes are replaced by assertions on the frame clip schedule.

## Source Of Identity

Unchanged from the 2026-05-28 elevation:

```text
assets/art/style-references/lemmy-rabbit-canonical.png            (runtime/script source)
docs/design/style-references/2026-05-28-lemmy-rabbit-canonical.png (dated record)
```

`LEMMY_APPROVED_IDENTITY_SOURCE` constant in `LemmyActorContract.ts` already points here after the slim-plan revision. The 2026-04-24 paper-backed thumbnail is historical (not used as input). See [memory:project_lemmy_canonical_identity](../../.claude/projects/-Users-danmac-liuhui-star-guardian/memory/project_lemmy_canonical_identity.md).

## In Scope

- **Luma drift-gate test** (Task 5 Step 1): generate 3 idle frames with `--ref canonical --ref-weight 0.95`, post-process to RGBA, visually compare to canonical. **Block all downstream work on identity preservation here.**
- **19 runtime frames** generated via Luma + canonical ref, post-processed to RGBA: 5 idle + 8 walk + 6 reach.
- **`LemmyActionClip`** data structure + `LEMMY_ACTION_CLIPS` constant covering the 3 MVP actions.
- **`LemmyActor`** frame-table playback via `update(dt)` accumulator, single sprite child.
- **`reach_contact`** event emitted at the contact frame entry (no tween, no `setTimeout`).
- **Cancellation contract** preserved: supersession → `LemmyActionInterrupted`; destroy → `LemmyActorDestroyed`.
- **`M01IntroSequence`** preserves the codex wire-up; only internals of `LemmyActor` change.
- **M01 preview smoke** passes end-to-end.
- **Visual spot-check** of every committed runtime frame against the canonical.
- **Fallback path documented**: if Luma drift-gate fails, switch to whole-body hand-drawn frames (user decision recorded; not in this plan's task graph).

## Out Of Scope

- Left-facing direction pair.
- Per-puzzle Lemmy reactions for M02–M10 (each level can add a new `LemmyActionId` + a 2–4 frame clip when authored).
- Paper-grain / watercolor unifying shader (Arrog has it; we don't yet — separate workstream, tracked but not blocking).
- AI per-frame generation (Luma identity drift already proven; not retried here).
- DragonBones / Skeleton2D / `.anim`.
- Walkable-area masks, multi-waypoint pathfinding, Y-sort.
- Audio production. Frame `durationMs` is the eventual SFX sync source but no clips are wired.

## Acceptance Criteria

- 4 part PNGs under `assets/art/characters/lemmy/parts/` exist, cut from `lemmy-rabbit-canonical.png`. Body's alpha is 0 where ear/arm regions are.
- A composite of body + ear-left + ear-right + arm-front at neutral pose reads pixel-close to the canonical silhouette (visual spot-check, not pixel-perfect test).
- 19 runtime frame PNGs under `assets/resources/art/characters/lemmy/frames/` (5 idle + 8 walk + 6 reach), transparent corners, non-trivial opaque content.
- `LEMMY_ACTION_CLIPS["reach_up_right"]` contains exactly one frame whose `event === "reach_contact"`, and that frame is neither the first nor the last in the clip.
- `LemmyActor.playAction("reach_up_right")` resolves after the clip duration, emits `reach_contact` once at the expected frame's start.
- New `playAction()` while one is in flight cancels the old token with `LemmyActionInterrupted` and immediately starts the new clip from frame 0.
- `onDestroy()` rejects any active token with `LemmyActorDestroyed`.
- `M01IntroSequence.ts` contains no `swapSprite(this.lemmySprite, …)` for `walking` / `reaching`, no `setTimeout(REACH_HOLD_DURATION …)`.
- `npm test`, `npm run typecheck`, `git diff --check` clean. `npm run smoke:m01-preview -- --enable-art-preview` ends with `ok=true`, basket wobble starts on `reach_contact`, all 9 fragments release.

## Resolved Decisions (2026-05-28)

1. **Frame production tool: Luma Uni-1.1 via `scripts/luma-gen.py`** (user choice).
   - Endpoint: `https://agents.lumalabs.ai/v1` (Agents API, Python urllib only — Node fetch is TLS-fingerprint-blocked, see memory `project_luma_agents_node_tls_blocked.md`)
   - Mandatory flags: `--ref assets/art/style-references/lemmy-rabbit-canonical.png --ref-weight 0.95` to lock identity
   - **Luma outputs RGB-only PNG**. Mandatory post-process: luminance → alpha (PIL ramp, see memory `reference_luma_image_gen.md` for the snippet). Without this, every frame has a near-black solid background.
   - Known risk: an earlier Luma generation pass produced rabbit variants the user rejected as "和莱米一点也不一样" (per `production/active.md` 2026-05-27 entry). That pass used the 274×440 4-24 thumbnail as ref. **This pass uses the 2000×2000 canonical** — image quality is far higher, so ref-locking should hold better. The drift-gate test step (Task 5 Step 1) verifies this empirically with 3 idle frames before committing to the full ~19-frame generation.

2. **Frame budget: extended for fluidity** (user choice: "适当多一些保证流畅"):
   - `idle_right` (loop): **5 frames** × 300ms = 1500ms cycle
   - `walk_right` (loop): **8 frames** × 100ms = 800ms cycle (Machinarium-typical step cadence)
   - `reach_up_right`: **6 frames** with anticipation / pre-contact / **contact** / apex hold / pre-recovery / recovery
   - **Total: 19 PNGs** for M01. Later levels each add 2–4 frames per reaction.

3. **Cut-parts vs. whole-body frames: whole-body Luma generation** (consequence of Decision 1).
   The user gave two paths: (a) hybrid cut-parts + manual composition if I can cut cleanly, (b) whole-body multi-frame hand drawing if I can't. Since Decision 1 picks Luma generation, the implementation collapses to whole-body **Luma** generation — no manual cut-parts composition needed. **Task 3 (re-cut parts) is therefore SKIPPED.** Codex's 4 stale parts under `assets/resources/art/characters/lemmy/` are removed in Task 3's brief retire step. If Luma drift-gate fails (Task 5 Step 1), we fall back to the original option (b): manual whole-body hand drawing — not back to cut-parts composition.

## File Plan

### Create

- `assets/resources/art/characters/lemmy/frames/idle-right-00.png` … `idle-right-04.png` (5 frames)
- `assets/resources/art/characters/lemmy/frames/walk-right-00.png` … `walk-right-07.png` (8 frames)
- `assets/resources/art/characters/lemmy/frames/reach-up-right-00.png` … `reach-up-right-05.png` (6 frames)
- `scripts/generate-lemmy-frames.py` (Luma generation orchestrator, all 19 prompts version-controlled)
- `scripts/lemmy-rgb-to-alpha.py` (luminance → alpha post-process)
- `temp/lemmy-frame-spot-check/drift-gate/` (3 idle frames for the drift-gate test)
- `temp/lemmy-frame-spot-check/raw/` (19 raw RGB Luma outputs, kept as audit trail)
- `temp/lemmy-frame-spot-check/contact-sheet.png` (5×4 review sheet)

### Modify

- `assets/scripts/cocos/LemmyActorContract.ts` — replace `LEMMY_ACTION_SCHEDULES` with `LEMMY_ACTION_CLIPS`; add `LemmyFrame`, `LemmyActionClip` types; keep all cancellation surface as-is.
- `assets/scripts/cocos/LemmyActor.ts` — single sprite child; `update(dt)` accumulator; preload all clip frames in `init()`.
- `assets/scripts/cocos/M01GreyboxArt.ts` — `getM01GreyboxRuntimeLemmyLayerResource` → `getM01GreyboxRuntimeLemmyFrameResource`; manifest entries point to the 19 new frame paths.
- `tests/cocos/LemmyActor.test.ts` — replace keyframe assertions with clip / frame / event assertions.
- `tests/cocos/M01GreyboxArt.test.ts` — update manifest expectations for the 19 frame entries.
- `tests/cocosProjectScaffold.test.ts` — keep the existing scaffold assertions added by codex.
- `production/active.md` — append 2026-05-28 direction-revision entry.

### Leave Alone

- `assets/art/style-references/lemmy-rabbit-canonical.png` (canonical identity source)
- `assets/art/style-references/lemmy-rabbit-style-reference.png` (historical, do not edit)
- `docs/design/style-references/2026-05-28-lemmy-rabbit-canonical.png` (dated record)
- `docs/design/style-references/2026-04-24-lemmy-rabbit-style-reference.png` (historical)
- `assets/resources/art/stage1-m01/runtime-sprites/intro/m01-lemmy-walking.png` and `m01-lemmy-reaching.png` — orphans after migration. Retire in a follow-up cleanup PR.

### Mark Superseded

- `docs/plans/2026-05-27-lemmy-slim-actor-plan.md` — top-of-file banner pointing to this plan.

---

## Task 0: Mark The Slim Plan Superseded

**Files:**
- Modify: `docs/plans/2026-05-27-lemmy-slim-actor-plan.md`

- [ ] **Step 1: Add superseded banner**

Prepend immediately under the existing `# Lemmy Slim Actor & Layered Parts Plan` heading:

```markdown
> **⚠️ SUPERSEDED 2026-05-28** — replaced by `docs/plans/2026-05-28-lemmy-frame-table-plan.md`. After researching Arrog's actual production tech (hand-drawn frame sequences, not layered cut-outs), and given Lemmy's small MVP action vocabulary, the 4-layer + `cc.tween` runtime path was rejected in favor of a frame-table player driven by hand-composed single-PNG frames per pose. The 4 layered parts kept by this plan still exist — they become production素材 used in an external image tool, not runtime sprites. Codex's `LemmyActorContract.ts` cancellation logic is preserved verbatim.
```

- [ ] **Step 2: Commit**

```bash
git add docs/plans/2026-05-27-lemmy-slim-actor-plan.md
git commit -m "docs(plans): mark slim plan superseded by frame-table plan"
```

---

## Task 1: Canonical Identity [COMPLETED 2026-05-28]

**Status:** ✅ Completed. `assets/art/style-references/lemmy-rabbit-canonical.png` is 2000×2000 RGBA transparent. `LEMMY_APPROVED_IDENTITY_SOURCE` constant in `LemmyActorContract.ts` already points there.

No further action. Skip to Task 2.

---

## Task 2: Transparent Master [SKIPPED]

**Status:** ⏭️ Skipped. User delivered a fully transparent RGBA master directly — no background-cleanup script needed.

No further action. Skip to Task 3.

---

## Task 3: Retire Codex's Stale Parts [Cut-Parts task SKIPPED — Luma whole-body path]

**Status:** ⏭️ Cut-parts production source is no longer needed (Resolved Decision 3 — Luma generates whole-body frames). This task collapses to a tiny cleanup: remove the 4 stale codex parts that were cut from the wrong source.

**Files:**
- Delete: `assets/resources/art/characters/lemmy/lemmy-body.png`
- Delete: `assets/resources/art/characters/lemmy/lemmy-ear-left.png`
- Delete: `assets/resources/art/characters/lemmy/lemmy-ear-right.png`
- Delete: `assets/resources/art/characters/lemmy/lemmy-arm-front.png`
- Delete (and remove): `assets/art/characters/lemmy/lemmy-part-pivots.json` (codex's stale schema without pivots)
- Delete (or archive in `temp/`): `scripts/prepare-lemmy-layered-proof.py` (kept until Task 5 confirms drift-gate passes — if it fails, this script may be revived for the manual hybrid fallback)

- [ ] **Step 1: Verify the files are untracked**

```bash
git status --short -- assets/resources/art/characters/ assets/art/characters/
```

Expected: all entries prefixed `??` (untracked). They were never committed.

- [ ] **Step 2: Remove**

```bash
rm -rf assets/resources/art/characters/lemmy
rm -rf assets/art/characters/lemmy
rmdir assets/resources/art/characters 2>/dev/null || true
rmdir assets/art/characters           2>/dev/null || true
mv scripts/prepare-lemmy-layered-proof.py temp/lemmy-frame-spot-check/prepare-lemmy-layered-proof.py.archived 2>/dev/null || true
```

(Move-to-archive instead of delete in case Task 5 falls back to the hybrid path.)

- [ ] **Step 3: Verify**

```bash
git status --short
```

Expected: the part PNGs and pivots JSON no longer show as `??`. The archived Python script lives under `temp/lemmy-frame-spot-check/`.

No tests for this task — it's a pure cleanup. The asset test file (`tests/cocos/LemmyCharacterAssets.test.ts`) is no longer needed since runtime parts won't exist; remove its mention from the test suite if codex's PR already staged it.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(lemmy): retire stale codex parts; whole-body Luma path supersedes cut-parts hybrid"
```

(No `git add` needed because the targeted files were untracked; commit captures the script archive move only. If nothing is staged, skip the commit and move on.)

---

## (Reference) Task 3 ORIGINAL plan: Re-Cut Four Production-Source Parts From Canonical [SUPERSEDED 2026-05-28]

The cut-parts hybrid task originally planned here is preserved below as a fallback reference in case Task 5 Step 1 (Luma drift-gate) fails and we need to switch to the hybrid manual-composition path. **Do not execute unless the drift-gate fails.**

**Files (original):**
- Modify: `scripts/prepare-lemmy-layered-proof.py` (rename to `scripts/cut-lemmy-parts-from-canonical.py`)
- Create: `assets/art/characters/lemmy/parts/{body,ear-left,ear-right,arm-front}.png`
- Modify: `assets/art/characters/lemmy/lemmy-part-pivots.json` (add real pivots)
- Create: `tests/cocos/LemmyCharacterAssets.test.ts`

Output would be **dev-only**; nothing under `assets/resources/art/characters/lemmy/` would be touched. Parts would be素材 for an external image tool's manual frame composition.

- [ ] **Step 1: Write failing parts asset test**

Create `tests/cocos/LemmyCharacterAssets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";

const PARTS_DIR = "assets/art/characters/lemmy/parts";
const PARTS = ["body", "ear-left", "ear-right", "arm-front"];

describe("Lemmy production parts (from canonical)", () => {
  it.each(PARTS)("%s.png exists with transparent corners and opaque content", async (name) => {
    const path = `${PARTS_DIR}/${name}.png`;
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
    expect(opaque).toBeGreaterThan(1000);
  });

  it("pivots manifest covers all four parts with normalized pivot coords", async () => {
    const raw = readFileSync("assets/art/characters/lemmy/lemmy-part-pivots.json", "utf8");
    const pivots = JSON.parse(raw);
    expect(Object.keys(pivots.parts).sort()).toEqual(["arm-front", "body", "ear-left", "ear-right"]);
    for (const part of Object.values(pivots.parts) as Array<{ pivot: { x: number; y: number } }>) {
      expect(part.pivot.x).toBeGreaterThanOrEqual(0);
      expect(part.pivot.x).toBeLessThanOrEqual(1);
      expect(part.pivot.y).toBeGreaterThanOrEqual(0);
      expect(part.pivot.y).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/cocos/LemmyCharacterAssets.test.ts
```

Expected: FAIL — parts at the new path don't exist yet (codex shipped them at `lemmy-body.png` etc., not `body.png`, and from the wrong source).

- [ ] **Step 3: Refactor the cut script to read from canonical and exclude ear/arm from body**

Rewrite `scripts/prepare-lemmy-layered-proof.py` (or copy → rename `scripts/cut-lemmy-parts-from-canonical.py`):

Key changes from codex's existing script:

```python
# Change 1: source becomes canonical, not the old stand-in
SOURCE = ROOT / "assets/art/style-references/lemmy-rabbit-canonical.png"

# Change 2: PART_FILES drops the `lemmy-` prefix and routes to the new parts dir
PART_FILES = {
    "body":      "body.png",
    "ear_left":  "ear-left.png",
    "ear_right": "ear-right.png",
    "arm_front": "arm-front.png",
}
PARTS_ROOT = ROOT / "assets/art/characters/lemmy/parts"
# Runtime root is removed — these parts do NOT ship to assets/resources/

# Change 3: render_part for "body" must EXCLUDE ear/arm regions (the slim-plan-review Bug 1 fix)
def render_part(clean: Image.Image, part_id: str, bounds) -> Image.Image:
    ...
    for y in range(height):
        for x in range(width):
            px = source[x, y]
            if px[3] == 0:
                continue
            name = part_name_at(x, y, bounds)
            # OLD: if part_id == "body" or name == part_id:
            # NEW: only keep pixels classified as this exact part
            if name == part_id:
                out[x, y] = px
    ...

# Change 4: write a richer pivots manifest with real pivot coords
def build_pivots(part_bboxes: dict[str, tuple[int, int, int, int]],
                 part_sizes: dict[str, tuple[int, int]]) -> dict:
    # body pivot = silhouette hip center (0.5, 0.18 of body bbox)
    # ears = bottom edge (root), centered horizontally → (0.5, 0.05)
    # arm-front pivot = top edge (shoulder), centered → (0.5, 0.92)
    return {
        "$schema": "lemmy-part-pivots-v2",
        "identitySource": "assets/art/style-references/lemmy-rabbit-canonical.png",
        "parts": {
            "body":      {"pivot": {"x": 0.50, "y": 0.18}, "size": part_sizes["body"]},
            "ear-left":  {"pivot": {"x": 0.50, "y": 0.05}, "size": part_sizes["ear_left"]},
            "ear-right": {"pivot": {"x": 0.50, "y": 0.05}, "size": part_sizes["ear_right"]},
            "arm-front": {"pivot": {"x": 0.50, "y": 0.92}, "size": part_sizes["arm_front"]},
        },
        "note": "Parts are PRODUCTION SOURCE (素材) used in an external image tool. They do not ship as runtime sprites. Runtime sprites live under assets/resources/art/characters/lemmy/frames/ and are flat single PNGs per pose composed manually from these parts."
    }
```

The `part_name_at` normalized-bbox heuristic from codex can stay as a first pass; tune the boundaries by eye after running once.

- [ ] **Step 4: Run the script**

```bash
python3 scripts/cut-lemmy-parts-from-canonical.py
```

Expected: writes 4 PNGs under `assets/art/characters/lemmy/parts/` and overwrites `assets/art/characters/lemmy/lemmy-part-pivots.json`.

- [ ] **Step 5: Manual visual review of body**

Open `assets/art/characters/lemmy/parts/body.png`. Confirm:

- ears are **transparent**, not drawn into body
- the front arm region is **transparent**, not drawn into body
- head, face, whiskers, torso, tail, and the back-facing arm hint are all present
- watercolor / ink line quality is preserved

If the ear/arm cut bleeds into adjacent head pixels, tune the normalized-bbox ranges in `part_name_at` and re-run.

- [ ] **Step 6: Composite spot-check**

In Python or the image tool, composite `body + ear-left + ear-right + arm-front` at neutral pose with their pivots aligned to the canonical's reference points. The composite should read pixel-close to the canonical itself (allowing for tiny gaps at part seams).

Save the composite as `temp/lemmy-frame-spot-check/composite-neutral.png` for the record.

- [ ] **Step 7: Run parts test to verify it passes**

```bash
npm test -- tests/cocos/LemmyCharacterAssets.test.ts
```

Expected: PASS.

- [ ] **Step 8: Retire codex's old runtime parts**

```bash
git rm assets/resources/art/characters/lemmy/lemmy-body.png \
       assets/resources/art/characters/lemmy/lemmy-ear-left.png \
       assets/resources/art/characters/lemmy/lemmy-ear-right.png \
       assets/resources/art/characters/lemmy/lemmy-arm-front.png
# Note: these were never committed; this is effectively `rm`.
```

Actually those files aren't tracked yet (per `git status`), so `rm` them directly:

```bash
rm -f assets/resources/art/characters/lemmy/lemmy-body.png \
      assets/resources/art/characters/lemmy/lemmy-ear-left.png \
      assets/resources/art/characters/lemmy/lemmy-ear-right.png \
      assets/resources/art/characters/lemmy/lemmy-arm-front.png
rmdir assets/resources/art/characters/lemmy 2>/dev/null || true
rmdir assets/resources/art/characters       2>/dev/null || true
```

The `frames/` runtime subdir will be created in Task 5.

- [ ] **Step 9: Commit**

```bash
git add scripts/cut-lemmy-parts-from-canonical.py \
        assets/art/characters/lemmy/parts \
        assets/art/characters/lemmy/lemmy-part-pivots.json \
        tests/cocos/LemmyCharacterAssets.test.ts \
        temp/lemmy-frame-spot-check
git commit -m "feat(lemmy): cut 4 production-source parts from canonical (body excludes ears/arm)"
```

---

## Task 4: Define LemmyActionClip Data Structure And Frame Manifest

**Files:**
- Modify: `assets/scripts/cocos/LemmyActorContract.ts`
- Modify: `tests/cocos/LemmyActor.test.ts`

- [ ] **Step 1: Write failing tests for the new clip types and constants**

Replace the existing `LEMMY_ACTION_SCHEDULES`-based tests in `tests/cocos/LemmyActor.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import {
  LEMMY_APPROVED_IDENTITY_SOURCE,
  LEMMY_ACTION_CLIPS,
  getLemmyActionClip,
  estimateLemmyActionDurationMs,
  buildLemmyFrameTimeline,
  createLemmyCancellationContext,
  LemmyActionInterrupted,
  LemmyActorDestroyed,
  isExpectedLemmyActionCancel
} from "../../assets/scripts/cocos/LemmyActorContract.ts";

describe("LemmyActorContract identity constant", () => {
  it("points at the 2026-05-28 canonical", () => {
    expect(LEMMY_APPROVED_IDENTITY_SOURCE).toBe(
      "assets/art/style-references/lemmy-rabbit-canonical.png"
    );
  });
});

describe("Lemmy action clips", () => {
  it("idle_right has 5 frames, loops, no events", () => {
    const clip = getLemmyActionClip("idle_right");
    expect(clip.frames.length).toBe(5);
    expect(clip.loop).toBe(true);
    expect(clip.frames.some((f) => f.event)).toBe(false);
  });

  it("walk_right has 8 frames, loops, two footstep events", () => {
    const clip = getLemmyActionClip("walk_right");
    expect(clip.frames.length).toBe(8);
    expect(clip.loop).toBe(true);
    const events = clip.frames.map((f) => f.event).filter(Boolean);
    expect(events).toEqual(["footstep_left", "footstep_right"]);
  });

  it("reach_up_right has 6 frames, does not loop, one reach_contact event between anticipation and recovery", () => {
    const clip = getLemmyActionClip("reach_up_right");
    expect(clip.frames.length).toBe(6);
    expect(clip.loop).toBe(false);
    const contact = clip.frames.findIndex((f) => f.event === "reach_contact");
    expect(contact).toBeGreaterThan(0);
    expect(contact).toBeLessThan(clip.frames.length - 1);
  });

  it("estimateLemmyActionDurationMs sums frame durations", () => {
    const clip = getLemmyActionClip("reach_up_right");
    const expected = clip.frames.reduce((sum, f) => sum + f.durationMs, 0);
    expect(estimateLemmyActionDurationMs("reach_up_right")).toBe(expected);
  });

  it("buildLemmyFrameTimeline gives cumulative startMs per frame", () => {
    const timeline = buildLemmyFrameTimeline("reach_up_right");
    expect(timeline.length).toBe(6);
    expect(timeline[0].startMs).toBe(0);
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].startMs).toBeGreaterThan(timeline[i - 1].startMs);
    }
  });

  it("every clip's frame resourcePath starts with art/characters/lemmy/frames/", () => {
    for (const clip of Object.values(LEMMY_ACTION_CLIPS)) {
      for (const frame of clip.frames) {
        expect(frame.resourcePath).toMatch(/^art\/characters\/lemmy\/frames\//);
      }
    }
  });
});

describe("Lemmy cancellation context", () => {
  it("supersedes previous token and rejects pending promise with LemmyActionInterrupted", async () => {
    const ctx = createLemmyCancellationContext();
    const first = ctx.beginAction("walk_right");
    const second = ctx.beginAction("reach_up_right");
    await expect(first.promise).rejects.toBeInstanceOf(LemmyActionInterrupted);
    expect(second.token.isActive).toBe(true);
  });

  it("destroy() rejects active token with LemmyActorDestroyed", async () => {
    const ctx = createLemmyCancellationContext();
    const active = ctx.beginAction("walk_right");
    ctx.destroy();
    await expect(active.promise).rejects.toBeInstanceOf(LemmyActorDestroyed);
    expect(active.token.isActive).toBe(false);
  });

  it("isExpectedLemmyActionCancel returns true for both sentinels", () => {
    expect(isExpectedLemmyActionCancel(new LemmyActionInterrupted("walk_right"))).toBe(true);
    expect(isExpectedLemmyActionCancel(new LemmyActorDestroyed("walk_right"))).toBe(true);
    expect(isExpectedLemmyActionCancel(new Error("other"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/cocos/LemmyActor.test.ts
```

Expected: FAIL — `LEMMY_ACTION_CLIPS`, `getLemmyActionClip`, `buildLemmyFrameTimeline` not yet exported.

- [ ] **Step 3: Implement the new types and constant**

In `assets/scripts/cocos/LemmyActorContract.ts`:

(a) **Keep** the existing identity constants (point at canonical), `LemmyActionId`, `LemmyActorEvent`, all cancellation surface (`LemmyActionToken`, `LemmyActionHandle`, `LemmyCancellationContext`, the two error classes, `createLemmyCancellationContext`, `isExpectedLemmyActionCancel`).

(b) **Remove** `LemmyActionScheduleEntry`, `LemmyLayerId`, `LEMMY_ACTION_SCHEDULES`, `getLemmyActionSchedule`. They are replaced.

(c) **Add** new clip types and constants:

```ts
export interface LemmyFrame {
  /** resources.load path (no leading slash, no extension). */
  resourcePath: string;
  /** How long this frame stays on screen. SFX sync source. */
  durationMs: number;
  /** Optional event emitted at the START of this frame. */
  event?: LemmyActorEvent;
}

export interface LemmyActionClip {
  id: LemmyActionId;
  loop: boolean;
  pingPong?: boolean;
  frames: LemmyFrame[];
}

const FRAME_ROOT = "art/characters/lemmy/frames";

export const LEMMY_ACTION_CLIPS: Record<LemmyActionId, LemmyActionClip> = {
  idle_right: {
    id: "idle_right",
    loop: true,
    frames: [
      { resourcePath: `${FRAME_ROOT}/idle-right-00`, durationMs: 300 },  // neutral
      { resourcePath: `${FRAME_ROOT}/idle-right-01`, durationMs: 300 },  // breathe-in
      { resourcePath: `${FRAME_ROOT}/idle-right-02`, durationMs: 300 },  // hold
      { resourcePath: `${FRAME_ROOT}/idle-right-03`, durationMs: 300 },  // breathe-out
      { resourcePath: `${FRAME_ROOT}/idle-right-04`, durationMs: 300 }   // settle / occasional blink
    ]
  },
  walk_right: {
    id: "walk_right",
    loop: true,
    frames: [
      { resourcePath: `${FRAME_ROOT}/walk-right-00`, durationMs: 100, event: "footstep_left"  }, // contact L
      { resourcePath: `${FRAME_ROOT}/walk-right-01`, durationMs: 100 },                          // pass-L
      { resourcePath: `${FRAME_ROOT}/walk-right-02`, durationMs: 100 },                          // mid
      { resourcePath: `${FRAME_ROOT}/walk-right-03`, durationMs: 100 },                          // up-R
      { resourcePath: `${FRAME_ROOT}/walk-right-04`, durationMs: 100, event: "footstep_right" }, // contact R
      { resourcePath: `${FRAME_ROOT}/walk-right-05`, durationMs: 100 },                          // pass-R
      { resourcePath: `${FRAME_ROOT}/walk-right-06`, durationMs: 100 },                          // mid
      { resourcePath: `${FRAME_ROOT}/walk-right-07`, durationMs: 100 }                           // up-L
    ]
  },
  reach_up_right: {
    id: "reach_up_right",
    loop: false,
    frames: [
      { resourcePath: `${FRAME_ROOT}/reach-up-right-00`, durationMs: 220 },                          // anticipation
      { resourcePath: `${FRAME_ROOT}/reach-up-right-01`, durationMs: 100 },                          // pre-contact rise
      { resourcePath: `${FRAME_ROOT}/reach-up-right-02`, durationMs: 180, event: "reach_contact" }, // CONTACT
      { resourcePath: `${FRAME_ROOT}/reach-up-right-03`, durationMs: 200 },                          // apex hold
      { resourcePath: `${FRAME_ROOT}/reach-up-right-04`, durationMs: 200 },                          // pre-recovery
      { resourcePath: `${FRAME_ROOT}/reach-up-right-05`, durationMs: 280 }                           // recovery
    ]
  }
};

export function getLemmyActionClip(actionId: LemmyActionId): LemmyActionClip {
  return LEMMY_ACTION_CLIPS[actionId];
}

export function estimateLemmyActionDurationMs(actionId: LemmyActionId): number {
  return LEMMY_ACTION_CLIPS[actionId].frames.reduce((sum, f) => sum + f.durationMs, 0);
}

export function buildLemmyFrameTimeline(
  actionId: LemmyActionId
): Array<{ frameIndex: number; startMs: number; durationMs: number; event?: LemmyActorEvent }> {
  const frames = LEMMY_ACTION_CLIPS[actionId].frames;
  const out: Array<{ frameIndex: number; startMs: number; durationMs: number; event?: LemmyActorEvent }> = [];
  let cursor = 0;
  for (let i = 0; i < frames.length; i++) {
    out.push({ frameIndex: i, startMs: cursor, durationMs: frames[i].durationMs, event: frames[i].event });
    cursor += frames[i].durationMs;
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/cocos/LemmyActor.test.ts
```

Expected: PASS.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: clean. If `LemmyActor.ts` still references the removed `LEMMY_ACTION_SCHEDULES`, it will fail typecheck — that's expected; Task 6 fixes it. To unblock the typecheck **right now**, temporarily stub `LemmyActor.ts`'s body to a no-op `init()`/`walkTo()`/`playAction()`/`playIdle()` with the same public signatures but no internal logic. The real implementation lands in Task 6.

- [ ] **Step 6: Commit**

```bash
git add assets/scripts/cocos/LemmyActorContract.ts \
        assets/scripts/cocos/LemmyActor.ts \
        tests/cocos/LemmyActor.test.ts
git commit -m "feat(lemmy): replace keyframe schedules with frame-table clips"
```

---

## Task 5: Generate 19 Whole-Body Frames Via Luma + Canonical Ref

**Files:**
- Create: 19 PNGs under `assets/resources/art/characters/lemmy/frames/` (5 idle + 8 walk + 6 reach)
- Create: `scripts/generate-lemmy-frames.py` (orchestrator for Luma + post-process)
- Create: `temp/lemmy-frame-spot-check/drift-gate/` (3 idle frames for the gate test)
- Create: `temp/lemmy-frame-spot-check/contact-sheet.png` (final 5×4 review sheet)

**Tool:** `scripts/luma-gen.py` (the Python wrapper — Node version is TLS-blocked, see memory `project_luma_agents_node_tls_blocked.md`). All generations use `--ref assets/art/style-references/lemmy-rabbit-canonical.png --ref-weight 0.95`.

**Post-process:** Luma outputs RGB-only PNG with a near-black background. Every generated frame must run through the luminance→alpha PIL ramp from memory `reference_luma_image_gen.md` before being committed to the runtime folder.

### Step 1: Luma drift-gate test (idle ×3) — BLOCKS everything else

- [ ] **Step 1a: Generate 3 idle frames**

```bash
mkdir -p temp/lemmy-frame-spot-check/drift-gate

REF="assets/art/style-references/lemmy-rabbit-canonical.png"

# Neutral standing — the canonical pose; if this drifts, Luma can't preserve identity
python3 scripts/luma-gen.py "the same rabbit character, standing upright, neutral pose, side view, hand-drawn watercolor with thin ink contours, soft red and blue-gray washes, small dark eye, long uneven ears, whiskers, transparent paper-white background" \
  --ref "$REF" --ref-weight 0.95 --aspect 1:1 \
  --out temp/lemmy-frame-spot-check/drift-gate/idle-00-raw.png &

# Slight breathe-in — body lifted very slightly
python3 scripts/luma-gen.py "the same rabbit character, standing upright, taking a small breath, chest very slightly lifted, side view, hand-drawn watercolor with thin ink contours, soft red and blue-gray washes, small dark eye, long uneven ears, whiskers, transparent paper-white background" \
  --ref "$REF" --ref-weight 0.95 --aspect 1:1 \
  --out temp/lemmy-frame-spot-check/drift-gate/idle-01-raw.png &

# Slight breathe-out — body settled
python3 scripts/luma-gen.py "the same rabbit character, standing upright, exhaling, chest very slightly relaxed, side view, hand-drawn watercolor with thin ink contours, soft red and blue-gray washes, small dark eye, long uneven ears, whiskers, transparent paper-white background" \
  --ref "$REF" --ref-weight 0.95 --aspect 1:1 \
  --out temp/lemmy-frame-spot-check/drift-gate/idle-02-raw.png &

wait
```

Three jobs run in parallel; each ~30–60s. Total ~1–2 min.

- [ ] **Step 1b: Apply luminance → alpha post-process to all 3 raw outputs**

Create `scripts/lemmy-rgb-to-alpha.py`:

```python
#!/usr/bin/env python3
"""Convert Luma RGB-only PNG to RGBA with luminance ramp (per memory reference_luma_image_gen)."""
import sys
from pathlib import Path
from PIL import Image

LO, HI = 8.0, 40.0   # tune per generation; widen for soft watercolor halos

def to_alpha(src: Path, dst: Path) -> None:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    px = im.load()
    out = Image.new("RGBA", (w, h))
    op = out.load()
    bbox = [w, h, 0, 0]
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            lum = 0.2126*r + 0.7152*g + 0.0722*b
            a = 0 if lum <= LO else 255 if lum >= HI else int(round((lum-LO)/(HI-LO)*255))
            op[x, y] = (r, g, b, a)
            if a > 4:
                bbox[0] = min(bbox[0], x); bbox[1] = min(bbox[1], y)
                bbox[2] = max(bbox[2], x); bbox[3] = max(bbox[3], y)
    pad = 16
    out.crop((max(0,bbox[0]-pad), max(0,bbox[1]-pad), min(w,bbox[2]+pad+1), min(h,bbox[3]+pad+1))).save(dst, optimize=True)

if __name__ == "__main__":
    to_alpha(Path(sys.argv[1]), Path(sys.argv[2]))
```

Run on all 3:

```bash
for raw in temp/lemmy-frame-spot-check/drift-gate/idle-*-raw.png; do
  out="${raw%-raw.png}.png"
  python3 scripts/lemmy-rgb-to-alpha.py "$raw" "$out"
done
```

- [ ] **Step 1c: Visually compare drift-gate output to canonical**

Open the 3 alpha-processed PNGs side-by-side with `assets/art/style-references/lemmy-rabbit-canonical.png` in any viewer (Preview.app, or build a contact sheet via `sharp`).

Pass criteria (**all five must hold for every one of the 3 frames**):

1. silhouette proportions read as Lemmy (head/body/ear ratio close to canonical)
2. ear shape uneven hand-drawn, not symmetric / not cartoon
3. small dark eye preserved, not enlarged into anime / mascot eyes
4. red + blue-gray watercolor palette, no new colors introduced
5. whisker line strokes still present (not smoothed away)

**If any frame fails any criterion: STOP. The Luma route is rejected. Fall back to whole-body hand-drawn frames per the user's Decision 3 fallback ("可以考虑全身多帧手绘"). The plan's Task 5 is then re-authored in a follow-up.**

If all 3 pass: proceed to Step 2.

### Step 2: Build the full prompt manifest

- [ ] **Step 2a: Create `scripts/generate-lemmy-frames.py` (orchestrator)**

This script encapsulates all 19 frame prompts so they live in version control, not in ad-hoc shell history.

Structure:

```python
#!/usr/bin/env python3
"""Generate all 19 Lemmy runtime frames via Luma + ref + post-process."""
import argparse
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REF = "assets/art/style-references/lemmy-rabbit-canonical.png"
OUT_DIR = ROOT / "assets/resources/art/characters/lemmy/frames"
RAW_DIR = ROOT / "temp/lemmy-frame-spot-check/raw"

BASE = ("the same rabbit character, side view, hand-drawn watercolor with thin "
        "ink contours, soft red and blue-gray washes, small dark eye, long "
        "uneven ears, whiskers, transparent paper-white background")

FRAMES = [
    # IDLE (5) — subtle breathing cycle
    ("idle-right-00", f"{BASE}, standing upright, neutral pose"),
    ("idle-right-01", f"{BASE}, standing upright, chest very slightly lifted (breath in)"),
    ("idle-right-02", f"{BASE}, standing upright, peak inhalation, body slightly tall"),
    ("idle-right-03", f"{BASE}, standing upright, chest very slightly relaxed (breath out)"),
    ("idle-right-04", f"{BASE}, standing upright, settled, neutral with eye briefly closed"),
    # WALK (8) — 8-beat right-facing step cycle
    ("walk-right-00", f"{BASE}, walking step pose, left foot just touching ground, slight forward lean"),
    ("walk-right-01", f"{BASE}, walking step pose, left foot bearing weight, body slight up"),
    ("walk-right-02", f"{BASE}, walking step pose, mid-stride, body at neutral height"),
    ("walk-right-03", f"{BASE}, walking step pose, right foot lifting, body rising slightly"),
    ("walk-right-04", f"{BASE}, walking step pose, right foot just touching ground, slight forward lean"),
    ("walk-right-05", f"{BASE}, walking step pose, right foot bearing weight, body slight up"),
    ("walk-right-06", f"{BASE}, walking step pose, mid-stride, body at neutral height"),
    ("walk-right-07", f"{BASE}, walking step pose, left foot lifting, body rising slightly"),
    # REACH (6) — anticipation → contact → recovery
    ("reach-up-right-00", f"{BASE}, anticipating an upward reach, body slightly squashed down, front paw curling inward"),
    ("reach-up-right-01", f"{BASE}, beginning to reach up, front paw rising, body extending tall"),
    ("reach-up-right-02", f"{BASE}, fully reaching upward, front paw at peak height touching something overhead, body fully stretched, ears lifted"),
    ("reach-up-right-03", f"{BASE}, holding reach at apex, front paw still up, body fully stretched"),
    ("reach-up-right-04", f"{BASE}, beginning to lower from reach, front paw descending, body relaxing"),
    ("reach-up-right-05", f"{BASE}, returning to neutral standing pose, front paw down, body settled")
]

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="Generate only frames matching this substring")
    parser.add_argument("--concurrency", type=int, default=4)
    args = parser.parse_args()

    targets = [(n, p) for n, p in FRAMES if not args.only or args.only in n]
    print(f"generating {len(targets)} frames via Luma…")

    # Generate raw (RGB) in batches of N parallel
    procs = []
    for name, prompt in targets:
        raw_path = RAW_DIR / f"{name}-raw.png"
        cmd = [
            "python3", "scripts/luma-gen.py", prompt,
            "--ref", REF, "--ref-weight", "0.95",
            "--aspect", "1:1", "--out", str(raw_path)
        ]
        procs.append((name, subprocess.Popen(cmd, cwd=ROOT)))
        # Throttle
        while sum(1 for _, p in procs if p.poll() is None) >= args.concurrency:
            for _, p in procs:
                if p.poll() is None:
                    p.wait(timeout=5)
                    break

    for name, p in procs:
        p.wait()
        print(f"  raw: {name}")

    # Post-process all
    for name, _ in targets:
        raw_path = RAW_DIR / f"{name}-raw.png"
        out_path = OUT_DIR / f"{name}.png"
        subprocess.run(
            ["python3", "scripts/lemmy-rgb-to-alpha.py", str(raw_path), str(out_path)],
            check=True
        )
        print(f"  alpha: {name}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2b: Run the full generation**

```bash
python3 scripts/generate-lemmy-frames.py
```

Expected: ~30–40 minutes (19 frames × 30–60s each, 4-way parallel) producing:
- 19 raw RGB PNGs under `temp/lemmy-frame-spot-check/raw/`
- 19 RGBA PNGs under `assets/resources/art/characters/lemmy/frames/`

If a single frame visually fails, re-run just that frame:

```bash
python3 scripts/generate-lemmy-frames.py --only walk-right-04
```

### Step 3: Contact sheet + visual review

- [ ] **Step 3a: Build 5×4 contact sheet**

```bash
python3 - <<'PY'
from PIL import Image
from pathlib import Path
ROOT = Path(".")
FRAMES_DIR = ROOT / "assets/resources/art/characters/lemmy/frames"
CANONICAL = ROOT / "assets/art/style-references/lemmy-rabbit-canonical.png"

LAYOUT = [
    ["idle-right-00", "idle-right-01", "idle-right-02", "idle-right-03", "idle-right-04"],
    ["walk-right-00", "walk-right-01", "walk-right-02", "walk-right-03", "walk-right-04"],
    ["walk-right-05", "walk-right-06", "walk-right-07", None,              None],
    ["reach-up-right-00", "reach-up-right-01", "reach-up-right-02", "reach-up-right-03", "reach-up-right-04"],
    ["reach-up-right-05", None, None, None, "CANONICAL"]
]

CELL = 400
cols = max(len(row) for row in LAYOUT)
rows = len(LAYOUT)
sheet = Image.new("RGBA", (CELL*cols, CELL*rows), (255, 255, 255, 255))
for r, row in enumerate(LAYOUT):
    for c, name in enumerate(row):
        if name is None: continue
        src = CANONICAL if name == "CANONICAL" else FRAMES_DIR / f"{name}.png"
        if not src.exists(): continue
        img = Image.open(src).convert("RGBA")
        img.thumbnail((CELL, CELL))
        sheet.paste(img, (c*CELL + (CELL-img.width)//2, r*CELL + (CELL-img.height)//2), img)
sheet.save(ROOT / "temp/lemmy-frame-spot-check/contact-sheet.png")
print("wrote temp/lemmy-frame-spot-check/contact-sheet.png")
PY
```

- [ ] **Step 3b: Hand-review every frame**

Open `temp/lemmy-frame-spot-check/contact-sheet.png`. For every frame, the same 5 criteria from Step 1c must hold. Additionally:

- walk cycle should show a clear left-then-right-then-left foot pattern across frames 00→04→08
- reach cycle should show progressive arm rise from 00→02 (contact) and progressive arm lowering from 02→05
- contact frame (`reach-up-right-02`) should clearly show the paw at apex, ready to touch the basket

Any frame failing review → re-generate that single frame with `--only` flag → re-run Step 3a.

### Step 4: Refresh Cocos + commit

- [ ] **Step 4a: Refresh Cocos asset DB**

```text
db://assets/resources/art/characters/lemmy/frames
```

Per memory `project_cocos_preview_refresh_rules`: PNG additions need an MCP refresh + browser reload.

- [ ] **Step 4b: Commit**

```bash
git add scripts/generate-lemmy-frames.py scripts/lemmy-rgb-to-alpha.py \
        assets/resources/art/characters/lemmy/frames \
        temp/lemmy-frame-spot-check
git commit -m "feat(lemmy): generate 19 Luma frames (5 idle + 8 walk + 6 reach) ref-locked to canonical"
```

---

## Task 6: Implement LemmyActor Frame-Table Playback

**Files:**
- Modify: `assets/scripts/cocos/LemmyActor.ts`
- Modify: `tests/cocos/LemmyActor.test.ts`

The Cocos integration is small because the pure logic lives in `LemmyActorContract.ts` already.

- [ ] **Step 1: Write failing tests for the playback contract**

Append to `tests/cocos/LemmyActor.test.ts`:

```ts
import { advanceLemmyFrameState } from "../../assets/scripts/cocos/LemmyActor.ts";

describe("advanceLemmyFrameState (pure)", () => {
  it("advances to next frame when accumulator passes the current frame's duration", () => {
    const state = { actionId: "reach_up_right" as const, frameIndex: 0, accumulatorMs: 0 };
    const r = advanceLemmyFrameState(state, 100, { loop: false });
    expect(r.frameIndex).toBe(0);
    expect(r.accumulatorMs).toBe(100);
    expect(r.didAdvance).toBe(false);
    expect(r.ended).toBe(false);
  });

  it("advances frame index when accumulator passes the current frame's duration", () => {
    // reach frame 1 lasts 100ms. Start at frame 1, accumulator 80ms; +30ms → 110ms > 100ms → frame 2.
    const state = { actionId: "reach_up_right" as const, frameIndex: 1, accumulatorMs: 80 };
    const r = advanceLemmyFrameState(state, 30, { loop: false });
    expect(r.frameIndex).toBe(2);
    expect(r.accumulatorMs).toBe(10);
    expect(r.didAdvance).toBe(true);
    expect(r.emittedEvent).toBe("reach_contact");  // frame 2 carries the event
    expect(r.ended).toBe(false);
  });

  it("non-looping reach ends after the last frame", () => {
    // reach has 6 frames (indices 0-5). Last frame is 5, lasts 280ms.
    const state = { actionId: "reach_up_right" as const, frameIndex: 5, accumulatorMs: 270 };
    const r = advanceLemmyFrameState(state, 20, { loop: false });
    expect(r.ended).toBe(true);
  });

  it("looping idle wraps frame index back to 0 from the last frame", () => {
    // idle has 5 frames (indices 0-4). All 300ms. Last frame is 4.
    const state = { actionId: "idle_right" as const, frameIndex: 4, accumulatorMs: 280 };
    const r = advanceLemmyFrameState(state, 30, { loop: true });
    expect(r.frameIndex).toBe(0);
    expect(r.accumulatorMs).toBe(10);
    expect(r.ended).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/cocos/LemmyActor.test.ts -t "advanceLemmyFrameState"
```

Expected: FAIL — helper not yet exported.

- [ ] **Step 3: Implement `LemmyActor.ts`**

Replace the file body. Public API surface (`init`, `walkTo`, `playAction`, `playIdle`, `onDestroy`) is unchanged so `M01IntroSequence.ts` does not need re-editing. Internal:

```ts
import {
  _decorator,
  Component,
  Node,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec3,
  resources,
  tween
} from "cc";

import {
  LEMMY_ACTION_CLIPS,
  createLemmyCancellationContext,
  isExpectedLemmyActionCancel,
  type LemmyActionClip,
  type LemmyActionId,
  type LemmyActionToken,
  type LemmyActorEvent
} from "./LemmyActorContract.ts";

export {
  LEMMY_APPROVED_IDENTITY_SOURCE,
  createLemmyCancellationContext,
  estimateLemmyActionDurationMs,
  getLemmyActionClip,
  buildLemmyFrameTimeline,
  isExpectedLemmyActionCancel,
  LemmyActionInterrupted,
  LemmyActorDestroyed
} from "./LemmyActorContract.ts";

export interface LemmyActorOptions {
  displaySize?: { width: number; height: number };
}

export interface LemmyWalkOptions {
  durationMs?: number;
}

export interface LemmyPlayOptions {
  onEvent?: (event: LemmyActorEvent) => void;
}

const DEFAULT_DISPLAY_SIZE = { width: 180, height: 180 };

const { ccclass } = _decorator;

interface LemmyFrameState {
  actionId: LemmyActionId;
  frameIndex: number;
  accumulatorMs: number;
}

interface AdvanceResult {
  frameIndex: number;
  accumulatorMs: number;
  didAdvance: boolean;
  emittedEvent?: LemmyActorEvent;
  ended: boolean;
}

/** Pure helper, fully unit-testable. */
export function advanceLemmyFrameState(
  state: LemmyFrameState,
  deltaMs: number,
  options: { loop: boolean }
): AdvanceResult {
  const clip = LEMMY_ACTION_CLIPS[state.actionId];
  let frameIndex = state.frameIndex;
  let accumulator = state.accumulatorMs + deltaMs;
  let didAdvance = false;
  let emittedEvent: LemmyActorEvent | undefined;
  let ended = false;

  while (accumulator >= clip.frames[frameIndex].durationMs) {
    accumulator -= clip.frames[frameIndex].durationMs;
    if (frameIndex === clip.frames.length - 1) {
      if (options.loop) {
        frameIndex = 0;
      } else {
        ended = true;
        accumulator = 0;
        break;
      }
    } else {
      frameIndex += 1;
    }
    didAdvance = true;
    emittedEvent = clip.frames[frameIndex].event ?? emittedEvent;
  }

  return { frameIndex, accumulatorMs: accumulator, didAdvance, emittedEvent, ended };
}

@ccclass("LemmyActor")
export class LemmyActor extends Component {
  private readonly cancellation = createLemmyCancellationContext();
  private displaySize = DEFAULT_DISPLAY_SIZE;
  private frameSprite: Sprite | null = null;
  private frameNode: Node | null = null;
  private readyPromise: Promise<void> = Promise.resolve();
  private spriteFrames: Map<string, SpriteFrame> = new Map();

  private playState: {
    token: LemmyActionToken;
    clip: LemmyActionClip;
    frame: LemmyFrameState;
    onEvent?: (event: LemmyActorEvent) => void;
  } | null = null;

  init(options: LemmyActorOptions = {}): Promise<void> {
    this.displaySize = options.displaySize ?? DEFAULT_DISPLAY_SIZE;
    const transform = this.node.addComponent(UITransform);
    transform.setContentSize(this.displaySize.width, this.displaySize.height);

    const child = new Node("LemmyFrame");
    this.node.addChild(child);
    const childTransform = child.addComponent(UITransform);
    childTransform.setContentSize(this.displaySize.width, this.displaySize.height);
    const sprite = child.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.frameNode = child;
    this.frameSprite = sprite;

    const allPaths = new Set<string>();
    for (const clip of Object.values(LEMMY_ACTION_CLIPS)) {
      for (const frame of clip.frames) allPaths.add(frame.resourcePath);
    }

    this.readyPromise = Promise.all(
      Array.from(allPaths).map(
        (path) =>
          new Promise<void>((resolve, reject) => {
            resources.load(path, SpriteFrame, (err, sf) => {
              if (err || !sf) {
                reject(err ?? new Error(`failed to load ${path}`));
                return;
              }
              this.spriteFrames.set(path, sf);
              resolve();
            });
          })
      )
    ).then(() => undefined);

    return this.readyPromise;
  }

  async walkTo(target: Vec3, options: LemmyWalkOptions = {}): Promise<void> {
    await this.readyPromise;
    const handle = this.cancellation.beginAction("walk_right");
    this.startClip("walk_right", handle.token);

    tween(this.node)
      .to(
        (options.durationMs ?? 1800) / 1000,
        { position: target },
        { easing: "sineInOut" }
      )
      .call(() => {
        if (handle.token.isActive) this.cancellation.resolveActive(handle.token);
      })
      .start();

    return handle.promise;
  }

  async playAction(actionId: LemmyActionId, options: LemmyPlayOptions = {}): Promise<void> {
    await this.readyPromise;
    const handle = this.cancellation.beginAction(actionId);
    this.startClip(actionId, handle.token, options.onEvent);
    return handle.promise;
  }

  playIdle(): void {
    void this.playAction("idle_right").catch((err) => {
      if (!isExpectedLemmyActionCancel(err)) throw err;
    });
  }

  onDestroy(): void {
    this.cancellation.destroy();
    this.playState = null;
  }

  update(deltaTime: number): void {
    if (!this.playState) return;
    if (!this.playState.token.isActive) {
      this.playState = null;
      return;
    }

    const deltaMs = deltaTime * 1000;
    const result = advanceLemmyFrameState(
      this.playState.frame,
      deltaMs,
      { loop: this.playState.clip.loop }
    );

    this.playState.frame.frameIndex = result.frameIndex;
    this.playState.frame.accumulatorMs = result.accumulatorMs;

    if (result.didAdvance) {
      this.swapToFrame(result.frameIndex);
      if (result.emittedEvent && this.playState.onEvent) {
        this.playState.onEvent(result.emittedEvent);
      }
    }

    if (result.ended) {
      const token = this.playState.token;
      this.playState = null;
      this.cancellation.resolveActive(token);
    }
  }

  private startClip(
    actionId: LemmyActionId,
    token: LemmyActionToken,
    onEvent?: (event: LemmyActorEvent) => void
  ): void {
    const clip = LEMMY_ACTION_CLIPS[actionId];
    this.playState = {
      token,
      clip,
      frame: { actionId, frameIndex: 0, accumulatorMs: 0 },
      onEvent
    };
    this.swapToFrame(0);
    if (clip.frames[0].event && onEvent) onEvent(clip.frames[0].event);
  }

  private swapToFrame(index: number): void {
    if (!this.frameSprite || !this.playState) return;
    const frame = this.playState.clip.frames[index];
    const sf = this.spriteFrames.get(frame.resourcePath);
    if (sf) this.frameSprite.spriteFrame = sf;
  }
}
```

Notes on the implementation:
- The `update(dt)` accumulator is the canonical Cocos pattern; matches the Phase A recommendation in the original `2026-05-27-lemmy-machinarium-motion-plan.md`.
- `walkTo` still uses `tween(this.node)` for **position only** — that's translating the whole actor across the scene, not animating pose. While walking, the frame clip plays normally.
- Cancellation is gated at the top of `update()` — interrupted state is dropped before any sprite swap.
- `swapToFrame` is a no-op if the SpriteFrame isn't cached (e.g. `init()` rejected for one path) — the actor degrades gracefully instead of throwing mid-render.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/cocos/LemmyActor.test.ts
npm run typecheck
```

Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add assets/scripts/cocos/LemmyActor.ts tests/cocos/LemmyActor.test.ts
git commit -m "feat(lemmy): frame-table playback via update(dt) accumulator"
```

---

## Task 7: Update M01GreyboxArt Manifest

**Files:**
- Modify: `assets/scripts/cocos/M01GreyboxArt.ts`
- Modify: `tests/cocos/M01GreyboxArt.test.ts`

Codex's manifest currently exposes `getM01GreyboxRuntimeLemmyLayerResource` for the 4 layer paths. With frames replacing layers, we now expose `getM01GreyboxRuntimeLemmyFrameResource` covering the 19 frame paths (5 idle + 8 walk + 6 reach).

- [ ] **Step 1: Update tests for the new manifest entries**

In `tests/cocos/M01GreyboxArt.test.ts`, replace the layer-resource assertions with frame-resource ones:

```ts
it("exposes all 19 Lemmy frame resources via getM01GreyboxRuntimeLemmyFrameResource", () => {
  const ids = [
    "idle_right_00", "idle_right_01", "idle_right_02", "idle_right_03", "idle_right_04",
    "walk_right_00", "walk_right_01", "walk_right_02", "walk_right_03",
    "walk_right_04", "walk_right_05", "walk_right_06", "walk_right_07",
    "reach_up_right_00", "reach_up_right_01", "reach_up_right_02",
    "reach_up_right_03", "reach_up_right_04", "reach_up_right_05"
  ] as const;
  for (const id of ids) {
    const entry = getM01GreyboxRuntimeLemmyFrameResource(id);
    expect(entry?.resourcesLoadPath).toMatch(/^art\/characters\/lemmy\/frames\//);
  }
});
```

- [ ] **Step 2: Run red test**

```bash
npm test -- tests/cocos/M01GreyboxArt.test.ts -t "Lemmy frame resources"
```

Expected: FAIL.

- [ ] **Step 3: Update the manifest**

Rename `getM01GreyboxRuntimeLemmyLayerResource` → `getM01GreyboxRuntimeLemmyFrameResource`. Manifest entries enumerate the 19 frame paths. Drop the 4 layer entries.

- [ ] **Step 4: Run green test**

```bash
npm test -- tests/cocos/M01GreyboxArt.test.ts
npm run typecheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add assets/scripts/cocos/M01GreyboxArt.ts tests/cocos/M01GreyboxArt.test.ts
git commit -m "feat(m01): expose 11 Lemmy frame resources via manifest"
```

---

## Task 8: Preview Verification + Visual Spot-Check

**Files:**
- Modify (if needed): `scripts/m01-preview-smoke.mjs`
- Modify: `production/active.md`

- [ ] **Step 1: Refresh Cocos**

Refresh:

```text
db://assets/resources/art/characters/lemmy/frames
db://assets/scripts
```

`.ts` edits require a manual preview server restart per memory `project_cocos_preview_refresh_rules`.

- [ ] **Step 2: Run M01 preview smoke**

```bash
npm run smoke:m01-preview -- --enable-art-preview
```

Expected:

- no console errors
- M01 reaches the completion path
- on basket tap: Lemmy plays `walk_right` clip while sliding to the basket anchor
- Lemmy plays a brief `idle_right` (settle) — natural because `await this.lemmyActor.playAction("idle_right")` plays one loop before being cancelled by the next action
- Lemmy plays `reach_up_right`; `reach_contact` fires at the contact frame; basket wobbles
- 9 fragments release
- Lemmy plays `walk_right` while sliding to the watching anchor

- [ ] **Step 3: Visual review**

Check:

- Lemmy still looks like the canonical
- no part seams visible (because runtime is single PNG per frame, this should be inherently clean)
- no "puppet glide" — each frame is a distinct hand-composed pose
- the reach `reach_contact` lands on a frame that actually shows the paw touching the basket rim

- [ ] **Step 4: Update `production/active.md`**

Append a 2026-05-28 close-out note describing: frame-table is live; 19 Luma-generated frames shipped; layered-tween path retired; codex's `LemmyActorContract` cancellation reused verbatim; paper-shader still open.

- [ ] **Step 5: Final verification**

```bash
npm test
npm run typecheck
git diff --check
```

All clean.

- [ ] **Step 6: Commit**

```bash
git add production/active.md
git commit -m "chore(lemmy): m01 preview verification + frame-table direction close-out"
```

---

## Final Verification

```bash
npm test -- tests/cocos/LemmyCharacterAssets.test.ts \
            tests/cocos/LemmyActor.test.ts \
            tests/cocos/M01GreyboxArt.test.ts \
            tests/cocosProjectScaffold.test.ts
npm run typecheck
git diff --check
npm run smoke:m01-preview -- --enable-art-preview
```

All clean. M01 intro reads as the canonical Lemmy in preview.

---

## Handoff Notes For Codex

Codex, this plan supersedes the slim plan you reviewed. Substantive deltas from your perspective:

1. **`LemmyActorContract.ts`**: cancellation context + sentinels + identity constants are **kept verbatim** (with the slim-plan-revision path update to `lemmy-rabbit-canonical.png`). `LEMMY_ACTION_SCHEDULES` keyframe data is **replaced** by `LEMMY_ACTION_CLIPS` frame data. `LemmyLayerId` and per-layer rotation fields are gone.
2. **`LemmyActor.ts`**: the four-layer mount + `playPose` + `driveSchedule` is **replaced** by a single sprite child + `update(dt)` frame accumulator (`advanceLemmyFrameState`). Public API (`init` / `walkTo` / `playAction` / `playIdle`) is unchanged.
3. **`prepare-lemmy-layered-proof.py`**: SOURCE must change to `lemmy-rabbit-canonical.png`; `render_part("body", …)` must use `if name == part_id` (exclude ears/arm), not `if part_id == "body" or name == part_id`; output goes to `assets/art/characters/lemmy/parts/`, not the runtime folder; pivots JSON gains real `pivot` fields.
4. **Runtime parts you shipped** under `assets/resources/art/characters/lemmy/lemmy-*.png` get retired — they were cut from the old 4-24 stand-in, not the canonical. Re-cut in Task 3.
5. **`M01IntroSequence.ts` diff you wrote**: **kept** in full. Public API unchanged.
6. **The composition of every runtime frame** (Task 5) is a manual step in an external image tool. Your script is reused as a source-of-parts cutter, not a final asset generator.

Reasons for the direction change (research-backed, not opinion):

- Mateo Alayza (Arrog director) in the Game Developer / IGF interview: "We used **hand drawings for the characters**, scanned textures of paper for the background, Unity for the programming, and some shaders to make a common visual language with everything." There is no rigging or layered cut-out in Arrog's actual production. Confirming this required external research (Web search + Game Developer article fetch).
- The "略带不完美的纸感" Arrog feel is per-frame hand variation, not interpolated keyframes. `cc.tween` easing curves produce mathematical smoothness — wrong texture.
- Lemmy's MVP action set is small (idle + walk + reach + per-puzzle reactions) → 19 frames covers M01 with extended fluidity per user request. Per-puzzle reactions add 2–4 frames each in later levels. Total MVP frame budget ≈ 30–50 PNGs.

If you disagree with any of the above, append a rebuttal block at the bottom of this file. If you agree, append "✅ approved — codex 2026-05-28" and start at Task 0.
