# M01 Completion Autoloop Ralphex Plan

Goal: Finish M01 as the current production focus before moving to any other level or M30.

Sources of truth:
- `AGENTS.md`
- `CLAUDE.md`
- `docs/ai-workflow.md`
- `docs/ai-autonomous-checkpoint-loop.md`
- `docs/design/game-design-spec.md`
- `production/active.md`
- `docs/plans/2026-04-29-m01-overlap-evidence-greybox-plan.md`

Current branch: `codex/m01-drag-greybox`.

Known boundary:
- M30 and all other levels are paused until M01 is complete.
- `docs/plans/2026-05-02-m30-danger-prototype-autoloop-ralphex.md` is paused and must not be executed.
- Do not stage, revert, overwrite, or format unrelated Cocos/editor state files such as `profiles/v2/packages/scene.json` and `settings/v2/packages/information.json`.
- Keep final bitmap art polish out of scope unless the checkpoint explicitly needs placeholder asset wiring to make M01 playable. Use existing greybox / first-pass placeholder art.
- Commit and push after every completed checkpoint. Continue automatically while tests pass and the next M01 task is clear.

Definition of M01 complete for this phase:
- A player can complete the M01 core path in Cocos preview using real pointer input, without relying on bootstrap-level fallback.
- The strict command `npm run smoke:m01-preview:input` passes when Cocos preview is available and fresh.
- The default smoke still reports useful diagnostics, but no longer hides a broken real-input path.
- Completion feedback, bottom-light success state, and ToolCard preview remain visible and non-overlapping.
- Handoff docs clearly explain how to run and refresh M01 preview.

### Task 1: Make Strict Real-Input Preview Smoke Pass

- [x] Investigate why `npm run smoke:m01-preview:input` currently falls back instead of driving Cocos canvas input.
- [x] Fix the smallest real cause in either runtime input handling or the smoke coordinate/event strategy.
- [x] Keep fallback in default `npm run smoke:m01-preview`, but ensure strict mode fails only for genuine real-input breakage.
- [x] Update `production/active.md` with the blocker found, the fix, and fresh verification evidence.
- [x] Verify with `npm run smoke:m01-preview:input`, `npm run smoke:m01-preview`, relevant targeted tests, `npm run typecheck`, `npm test`, and `git diff --check`.

Completion note:
- Root cause was not a generic Cocos canvas-input failure. The preview path threw `Illegal invocation` when `ObservedResetScheduler` called an unbound browser `setTimeout`, leaving `activeDragNode` stuck on the flashlight after reveal. Fragment hit areas were also widened from 48px to 64px for more reliable real pointer targeting without changing visual size.
- `npm run smoke:m01-preview-refresh` succeeded through local Cocos MCP, and `npm run smoke:m01-preview:input` now passes with `realInput.usedFallback = false`, `observedColor = purple`, `fragment_circle_yellow_1` freely placed at `(0, -146)`, `evidence_purple_upper_left` staged, and `consoleMessages/pageErrors = []`.

Reframe:
- M01 is not complete while the only reliable preview smoke path can bypass real player input.
- The first completion checkpoint is to make the browser/canvas path exercise the actual Cocos input flow for flashlight selection, fragment movement, evidence staging, failed validation, and successful completion if practical.

Suggested file scope:
- `scripts/m01-preview-smoke.mjs`
- `scripts/m01-preview-smoke-helpers.mjs`
- `assets/scripts/cocos/M01GreyboxBootstrap.ts` if runtime input routing is the blocker
- `tests/m01PreviewSmokeScript.test.ts`
- `tests/cocosProjectScaffold.test.ts` or focused session/drag tests only if production code changes
- `production/active.md`

Preview refresh note:
- If the preview bundle is stale, run `npm run smoke:m01-preview-refresh` before rerunning smoke.
- If Cocos preview or local MCP is unavailable, stop and report the blocker rather than substituting a green fallback for strict mode.

Expected commit:
- `fix: make M01 strict input smoke pass`

### Task 2: Cover Full Real-Input Completion Path

- [x] Extend preview smoke or add a focused strict variant so real input completes all four evidence pairs and reaches ToolCard unlock.
- [x] Assert completion state, bottom light `steady_on`, ToolCard title, and no console/page errors.
- [x] Keep the failed-validation smoke coverage intact.
- [x] Update `production/active.md` with fresh evidence.
- [x] Verify with preview smoke commands, `npm run typecheck`, `npm test`, and `git diff --check`.

Completion note:
- `scripts/m01-preview-smoke.mjs` now runs failed-validation coverage and then reloads a clean M01 preview to complete all evidence pairs through Playwright mouse-driven browser input.
- `npm run smoke:m01-preview:input` passes with `realInput.usedFallback = false`, `completion.evidenceCount = 4`, `completion.areAllEvidenceStaged = true`, `completion.completionState.bottomLight = "steady_on"`, `completion.toolCardTitle = "分类与归纳"`, and empty `consoleMessages/pageErrors`.

Reframe:
- A partial input smoke is useful, but M01 completion requires proving a player can finish the level through the same public interaction path.

Suggested file scope:
- `scripts/m01-preview-smoke.mjs`
- `scripts/m01-preview-smoke-helpers.mjs`
- `tests/m01PreviewSmokeScript.test.ts`
- `production/active.md`

Expected commit:
- `test: cover M01 real-input completion smoke`

### Task 3: Polish M01 Completion Presentation Without Final Art

- [x] Review the runtime completion state in Cocos preview for overlap, stale feedback, or invisible affordances.
- [x] Fix any M01-only presentation issue that blocks “complete playable prototype” quality.
- [x] Add scaffold tests for any presentation lifecycle fix.
- [x] Update `production/active.md` with what was checked and fixed.
- [x] Verify with targeted tests, preview smoke, `npm run typecheck`, `npm test`, and `git diff --check`.

Completion note:
- Completion smoke screenshot review found the completed scene still showing the active red flashlight beam across the board, which distracted from the steady bottom light and ToolCard unlock state.
- `M01GreyboxBootstrap` now stores the hint button root, clears active flashlight id/color/beam target, redraws the beam, and hides the hint button before rendering the completion ToolCard.
- `npm run smoke:m01-preview:input` now asserts completion also clears the active flashlight beam target and hides the hint button; the fresh completion screenshot is `temp/m01-preview-completion-smoke.png`.
- A follow-up preview review caught same-evidence fragments snapping into one pile. `M01GreyboxLayout` now derives per-fragment snap poses from each evidence `generatedOverlap.offset`, and strict preview smoke asserts the staged pair lands in separated partial-overlap poses instead of one shared center.

Reframe:
- This is still not final art. It is the pass that makes the playable M01 state readable and stable enough to hand to a human tester.

Suggested file scope:
- `assets/scripts/cocos/M01GreyboxBootstrap.ts`
- `tests/cocosProjectScaffold.test.ts`
- `production/active.md`

Expected commit:
- `fix: polish M01 completion presentation`

### Task 4: Record M01 Completion Handoff

- [x] Update `production/active.md` to mark M01 complete for this prototype phase only if Tasks 1-3 are actually verified.
- [x] Update any relevant scene/preview README with the exact M01 run commands and current caveats.
- [x] Ensure M30 remains paused until the operator explicitly resumes it.
- [x] Verify docs with `git diff --check`.
- [x] Commit and push. Local handoff commit `473a113` was pushed to `origin/codex/m01-drag-greybox`.

Completion note:
- `production/active.md` now records M01 as complete for the current greybox prototype phase, cites the strict real-input completion smoke evidence from Tasks 1-3, and keeps M30 / other levels paused until explicit operator direction.
- `assets/scenes/README.md` now lists the exact M01 preview URL, refresh helper, default smoke, strict real-input smoke, typecheck/test commands, and caveats for stale preview bundles and fallback diagnostics.

Reframe:
- The completion handoff should be file-based, so the next agent does not rediscover whether M01 is truly done.

Suggested file scope:
- `production/active.md`
- `assets/scenes/README.md`
- this plan file

Expected commit:
- `docs: record M01 completion handoff`
