# M01 Manual QA And Art Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the completed M01 greybox into a human-readable art-polish target without changing the approved M01 rules.

**Architecture:** Keep the current domain/session/smoke path as the baseline. Separate QA findings from implementation tasks: first preserve visual evidence, then render the target overlap image as a side reference diagram outside the assembly plate, then keep board snap zones as invisible gameplay affordances, then replace greybox runtime assets with transparent-ready hand-drawn placeholders. Do not resume M30 or change other levels.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Vitest, Playwright-based M01 preview smoke, repo-local Cocos MCP refresh helper.

**Status:** Tasks 1-5 are complete as of 2026-05-02. The Task 5 Ralphex execution record is archived at `docs/plans/completed/2026-05-02-m01-art-preview-task5-ralphex.md`. This plan now remains as the QA/art-readiness handoff for the next visual review pass.

---

## Manual QA Baseline

Date: 2026-05-02

Commands run:
- `npm run smoke:m01-preview-refresh`
- `npm run smoke:m01-preview:input`

Evidence:
- Completion screenshot: `temp/m01-preview-completion-smoke.png`
- Failed-validation screenshot: `temp/m01-preview-failed-validation-smoke.png`
- Strict smoke result: `realInput.usedFallback = false`, `completion.evidenceCount = 4`, `completion.completionState.bottomLight = steady_on`, `completion.toolCardTitle = "分类与归纳"`, `consoleMessages = []`, `pageErrors = []`

Health score:
- Gameplay correctness: 9/10
- Preview automation confidence: 9/10
- Human readability: 6/10
- Art readiness: 3/10
- Ship-readiness for greybox prototype: yes
- Ship-readiness for public/art preview: no

## QA Findings

1. **[P1] Target evidence still reads like board contents, not a side reference diagram.**
   The spec says the target overlap evidence is a nearby reference diagram, while the center is the player assembly plate. In screenshots, colored evidence markers are visually embedded around the central board, so a human tester can read them as already-placed pieces rather than a target to reconstruct.

   Non-negotiable correction: do not draw the target image on top of the assembly plate. The target image must be a separate side picture. The central plate should show only the player's placed fragments, bottom light, and subtle assembly affordances.

2. **[P1] Flashlight beam visually sweeps over the assembly board.**
   The runtime hit logic only reveals bottom fragments, but the visible beam triangle crosses the board in the failed-validation screenshot. This conflicts with the design rule that the flashlight only illuminates bottom fragments and not the assembly platform.

3. **[P2] Editor/debug overlays contaminate QA screenshots.**
   Cocos preview chrome, FPS controls, and the engine debug stats panel appear in captured screenshots. This is acceptable for engineering smoke, but not for human playtest handoff or art review.

4. **[P2] The bottom floor lacks a designed sorting surface.**
   The bottom fragments are mechanically functional, but they sit on the raw background and partly compete with the debug stats overlay. The design asks for a ground-like floor where pieces feel placed on the surface and flashlight scanning is concentrated.

5. **[P2] Runtime visual assets are still greybox placeholders.**
   The current shapes are useful for logic, but M01 needs a first art-polish pass for: hidden fragments, target overlap evidence diagram, assembly plate, flashlight tools/beam, bottom light, and ToolCard styling.

6. **[P3] Previous art v3 prompt is stale.**
   `docs/design/generated-m01-art-slices/m01-runtime-v3-visual-qa-and-prompt.md` still targets the old nine-slot sorter assets. It should not be reused directly for the current overlap-evidence M01.

7. **[P1] Flashlight handfeel is underspecified and partly still behaves like a fixed tool selector.**
   The approved M01 interaction is not "click a color button and move an abstract beam." The flashlight should feel like a hand-held tool: click to pick it up, let the flashlight body follow the pointer, click or hold to shine, switch color by picking another flashlight, and stretch the beam endpoint with the gesture to set direction and range.

   Non-negotiable correction: keep the reveal rules unchanged, but make the runtime state machine explicit. A held flashlight must have visible position state independent from the target beam endpoint; shining should scan only the bottom fragment floor.

## Non-Goals

- Do not change the M01 puzzle rules, evidence count, solution pairs, or color-mixing rules.
- Do not implement M30.
- Do not create final production art in this pass.
- Do not commit unrelated Cocos editor state or auto-generated `.png.meta` churn unless a task explicitly imports accepted assets.

---

### Task 1: Add Clean QA Capture Mode For M01 Preview

**Files:**
- Modify: `scripts/m01-preview-smoke.mjs`
- Modify: `tests/m01PreviewSmokeScript.test.ts`
- Optional Create: `temp/m01-preview-clean-qa.png` generated by the script, not committed

**Step 1: Write the failing test**

In `tests/m01PreviewSmokeScript.test.ts`, add expectations that the smoke script supports a clean QA screenshot path and hides debug UI through a query/DOM option before capture.

Expected strings:
- `--capture-clean-qa`
- `m01-preview-clean-qa.png`
- `hidePreviewChrome`

**Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/m01PreviewSmokeScript.test.ts
```

Expected: FAIL because those strings do not exist yet.

**Step 3: Implement minimal clean capture**

In `scripts/m01-preview-smoke.mjs`:
- Add a `captureCleanQa` CLI flag.
- Before screenshot capture, inject a small style that hides Cocos preview chrome/debug overlays when possible.
- Save a final clean screenshot to `temp/m01-preview-clean-qa.png`.
- Keep existing engineering screenshots unchanged.

**Step 4: Verify**

Run:
```bash
node --check scripts/m01-preview-smoke.mjs
npm test -- tests/m01PreviewSmokeScript.test.ts
npm run smoke:m01-preview:input -- --capture-clean-qa
```

Expected:
- Tests pass.
- Strict smoke still reports `realInput.usedFallback = false`.
- `temp/m01-preview-clean-qa.png` exists and is suitable for visual review.

**Step 5: Commit**

```bash
git add scripts/m01-preview-smoke.mjs tests/m01PreviewSmokeScript.test.ts
git commit -m "test: add M01 clean QA capture"
git push
```

---

### Task 2: Split Target Evidence Reference From Board Snap Poses

**Files:**
- Modify: `assets/scripts/cocos/M01GreyboxLayout.ts`
- Modify: `assets/scripts/cocos/M01GreyboxBootstrap.ts`
- Test: `tests/cocos/M01GreyboxLayout.test.ts`
- Test: `tests/cocosProjectScaffold.test.ts`

**Step 1: Write failing layout test**

In `tests/cocos/M01GreyboxLayout.test.ts`, assert that:
- `layout.evidence` keeps hidden snap poses for gameplay.
- A new `layout.referenceEvidence` or equivalent view model exists for the side target diagram.
- Reference evidence positions are outside the central assembly board bounds and form a side picture, not an overlay on the assembly plate.
- Snap poses still resolve inside/around the board.

**Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/cocos/M01GreyboxLayout.test.ts
```

Expected: FAIL because there is no separate reference evidence model.

**Step 3: Implement minimal split**

In `M01GreyboxLayout.ts`:
- Add a reference-only evidence collection for the visual target picture.
- Keep `layout.evidence` for snap/drop hit zones and validation, but treat those zones as invisible gameplay affordances rather than visible target art.
- Position reference markers as a compact side diagram, preferably right of the board and above the floor pool.

In `M01GreyboxBootstrap.ts`:
- Render reference markers only in the side target diagram.
- Do not render colored target evidence markers on the central assembly plate.
- Keep gameplay evidence hit zones invisible on the board while preserving weak snap and validation behavior.
- Preserve weak snap and validation behavior.

**Step 4: Verify**

Run:
```bash
npm test -- tests/cocos/M01GreyboxLayout.test.ts tests/cocosProjectScaffold.test.ts
npm run typecheck
npm run smoke:m01-preview-refresh
npm run smoke:m01-preview:input
```

Expected:
- Strict smoke still passes with `usedFallback = false`.
- Completion screenshot shows the target reference diagram as a separate side picture, while the assembly plate contains only player-placed fragments and completion lighting.

**Step 5: Commit**

```bash
git add assets/scripts/cocos/M01GreyboxLayout.ts assets/scripts/cocos/M01GreyboxBootstrap.ts tests/cocos/M01GreyboxLayout.test.ts tests/cocosProjectScaffold.test.ts
git commit -m "fix: separate M01 target reference diagram"
git push
```

---

### Task 3: Clip Flashlight Beam To Bottom Fragment Floor

**Files:**
- Modify: `assets/scripts/cocos/M01GreyboxBootstrap.ts`
- Test: `tests/cocosProjectScaffold.test.ts`

**Step 1: Write failing scaffold test**

In `tests/cocosProjectScaffold.test.ts`, assert that the beam drawing path references a bottom-floor or fragment-pool clipping boundary and does not draw an unrestricted triangle across the board.

Expected strings:
- `drawFlashlightBeam`
- `FRAGMENT_FLOOR`
- `clip` or an equivalent floor-boundary helper

**Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/cocosProjectScaffold.test.ts
```

Expected: FAIL until beam clipping/floor-boundary helper exists.

**Step 3: Implement minimal visual clipping**

In `M01GreyboxBootstrap.ts`:
- Keep reveal hit detection unchanged.
- Limit visible beam geometry to the bottom fragment-floor band.
- Avoid drawing beam over the central board or ToolCard.

**Step 4: Verify**

Run:
```bash
npm test -- tests/cocosProjectScaffold.test.ts
npm run typecheck
npm run smoke:m01-preview:input
```

Expected:
- Strict smoke still passes.
- Failed-validation screenshot no longer shows the beam crossing the board.

**Step 5: Commit**

```bash
git add assets/scripts/cocos/M01GreyboxBootstrap.ts tests/cocosProjectScaffold.test.ts
git commit -m "fix: keep M01 flashlight beam on fragment floor"
git push
```

---

### Task 4: Create Current-Mechanic M01 Art Prompt And Asset Acceptance Checklist

**Files:**
- Create: `docs/design/generated-m01-art-slices/m01-overlap-runtime-art-polish-qa-and-prompt.md`
- Modify: `production/active.md`

**Step 1: Write the art QA document**

The new prompt must replace the old nine-slot sorter assumptions with current M01 assets:
- empty memory gear / assembly plate
- side target overlap evidence diagram
- 13 hidden fragments using only circle / triangle / hexagon silhouettes
- 3 flashlight tools
- bottom fragment floor surface
- bottom-light states
- ToolCard preview frame

Acceptance checklist must include:
- no final-answer outline
- no hidden base colors on default fragments
- target evidence shows only local two-fragment overlaps
- no three-layer overlap depiction
- flat transparent-ready or chroma-key extraction requirements
- gameplay-scale readability at `960x640`

**Step 2: Verify doc consistency**

Run:
```bash
git diff --check
```

Expected: PASS.

**Step 3: Commit**

```bash
git add docs/design/generated-m01-art-slices/m01-overlap-runtime-art-polish-qa-and-prompt.md production/active.md
git commit -m "docs: plan M01 overlap art polish"
git push
```

---

### Task 3.5: Make The Flashlight A Held Tool

**Files:**
- Modify: `docs/design/game-design-spec.md`
- Modify: `assets/scripts/cocos/M01GreyboxBootstrap.ts`
- Modify: `scripts/m01-preview-smoke.mjs`
- Modify: `scripts/m01-preview-smoke-helpers.mjs`
- Test: `tests/cocosProjectScaffold.test.ts`
- Test: `tests/m01PreviewSmokeScript.test.ts`

**Runtime handfeel contract:**
- A flashlight is not a fixed button or fixed emitter.
- Click / tap a flashlight to pick it up.
- The held flashlight body follows the pointer.
- Click / hold while holding the flashlight to shine.
- Picking another flashlight switches the active color.
- The beam source is the held flashlight position; the beam target is the current gesture endpoint, so direction and range come from the player's hand movement.
- Reveal hit detection remains limited to bottom fragments.

**Verification:**
```bash
npm test -- tests/cocosProjectScaffold.test.ts tests/m01PreviewSmokeScript.test.ts
npm run typecheck
npm run smoke:m01-preview-refresh
npm run smoke:m01-preview:input -- --capture-clean-qa
```

Expected:
- Strict smoke still uses real browser input (`usedFallback = false`).
- Smoke output records `heldFlashlightId = flashlight_red` before reveal.
- The flashlight token follows the hand position before the beam endpoint is stretched.
- Completion still reaches `bottomLight = steady_on`.

---

### Task 5: Import First-Pass Overlap Runtime Art Behind A Toggle

**Files:**
- Add: `assets/resources/art/stage1-m01/runtime-sprites/...`
- Modify: `assets/scripts/cocos/M01GreyboxArt.ts`
- Modify: `assets/scripts/cocos/M01GreyboxBootstrap.ts`
- Test: `tests/cocos/M01GreyboxArt.test.ts`
- Test: `tests/cocosProjectScaffold.test.ts`

**Step 1: Write failing art inventory tests**

In `tests/cocos/M01GreyboxArt.test.ts`, assert the new overlap-mode art inventory includes:
- shape-only hidden fragment sprites for circle/triangle/hexagon
- target evidence marker sprites for the 4 configured evidence pairs
- flashlight sprites
- assembly plate / bottom floor / ToolCard frame resources

**Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/cocos/M01GreyboxArt.test.ts
```

Expected: FAIL until inventory/resource declarations exist.

**Step 3: Add resources and mapping**

Add accepted placeholder or generated art assets under `assets/resources/art/stage1-m01/runtime-sprites/`.

Update `M01GreyboxArt.ts` so art resources are keyed by current overlap-evidence tokens, not legacy sorter slots.

Keep `M01GreyboxBootstrap.enableArtPreview` default false until QA accepts the visual pass.

**Step 4: Verify**

Run:
```bash
npm test -- tests/cocos/M01GreyboxArt.test.ts tests/cocosProjectScaffold.test.ts
npm run typecheck
npm test
npm run smoke:m01-preview-refresh
npm run smoke:m01-preview:input
```

Expected:
- Tests pass.
- Strict smoke passes with art toggle default false.
- Manual toggle of art preview does not block hit targets or completion.

**Step 5: Commit**

```bash
git add assets/resources/art/stage1-m01/runtime-sprites assets/scripts/cocos/M01GreyboxArt.ts assets/scripts/cocos/M01GreyboxBootstrap.ts tests/cocos/M01GreyboxArt.test.ts tests/cocosProjectScaffold.test.ts
git commit -m "feat: add M01 overlap art preview assets"
git push
```

---

## Recommended Next Action

Run the art-preview visual QA pass against the completed Task 1-5 baseline: refresh Cocos preview, run the strict smoke with `--enable-art-preview --capture-clean-qa`, review `temp/m01-art-preview-clean-qa.png`, and decide whether the first-pass placeholder sprites are acceptable for the next prototype checkpoint or need a new generated/paintover asset pass. M30 remains paused unless the operator explicitly resumes it.
