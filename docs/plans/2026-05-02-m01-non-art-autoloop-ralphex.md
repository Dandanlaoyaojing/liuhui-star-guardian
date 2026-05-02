# M01 Non-Art Autoloop Ralphex Plan

Goal: Let ralphex continue M01 automatically through several bounded non-final-art checkpoints. Final visual asset polish, style refinement, and bitmap redraw are deliberately deferred until after gameplay, verification, and handoff stability are tighter.

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
- `profiles/v2/packages/scene.json` and `settings/v2/packages/information.json` may already be modified by Cocos/editor state. Do not stage, revert, overwrite, or format them.
- Do not generate, redraw, visually polish, replace, or expand final art assets in this plan. The existing first-pass hidden fragment / evidence marker sprites may be used only as runtime placeholders.
- Keep changes scoped to M01 gameplay, preview automation, tests, docs, and workflow handoff.
- Commit and push after every completed checkpoint.
- Continue to the next checkpoint automatically while tests pass and the next task is clear. Stop only for a real product decision, repeated technical blocker, unavailable required verification with no equivalent fallback, or ambiguity between two valid directions.

Preview refresh note:
- If `npm run smoke:m01-preview` reports missing `fragment_circle_*` or `evidence_*` nodes, refresh through the local MCP server before rerunning:
  - POST `{ "folder": "db://assets/scripts" }` to `http://127.0.0.1:3000/api/project/refresh_assets`
  - POST `{ "folder": "db://assets/resources/configs/stage1" }` to `http://127.0.0.1:3000/api/project/refresh_assets`
  - POST `{}` to `http://127.0.0.1:3000/api/sceneAdvanced/soft_reload_scene`

### Task 1: Redirect Active Handoff Away From Final Art Polish

- [x] update `production/active.md` so the immediate handoff prioritizes non-art M01 completion over runtime sprite polish
- [x] if useful, normalize this plan into checkbox-driven task sections so the external loop can continue on later tasks
- [x] verify the doc-only redirect with `git diff --check`

Reframe:
- The current `production/active.md` says the next step is runtime sprite visual refinement, but the operator now wants final art last.
- Update the handoff so future loops prioritize non-art completion: preview automation, interaction coverage, state lifecycle, and smoke reliability.

Scope:
- `production/active.md`
- This plan file if a completion checklist is useful

Verification:
- `git diff --check`

Expected commit:
- `docs: defer m01 final art polish`

### Task 2: Add A Real-Input M01 Preview Smoke

- [x] extend or add an M01 preview smoke that drives at least one real browser input path through the Cocos canvas
- [x] keep the existing failed-validation smoke coverage intact while recording any stability blocker precisely
- [x] update `production/active.md` with the new smoke path and fresh verification evidence
- [x] verify with `node --check` for changed scripts, `npm run smoke:m01-preview`, any new smoke command, and `git diff --check`

Reframe:
- `npm run smoke:m01-preview` currently proves runtime freshness and failed validation by using runtime APIs.
- Add a separate or extended smoke path that exercises at least one real browser input path through Cocos canvas: flashlight selection/beam movement, fragment pickup/follow, free placement, and one weak snap or staged evidence action where practical.
- This should reduce the gap between unit tests and actual player behavior without relying on final art.

Scope:
- `scripts/m01-preview-smoke.mjs` or a new focused script under `scripts/`
- `package.json` if a new npm script is warranted
- tests only if helper logic is extracted
- `production/active.md`

Constraints:
- Do not make this a brittle pixel-perfect test. Prefer querying runtime node positions and then driving mouse/touch input at those coordinates.
- Keep the existing failed-validation smoke behavior intact.
- If real input cannot be made stable in Cocos preview, record the precise blocker and add the strongest equivalent harness that can run repeatably.

Verification:
- `node --check` for changed scripts
- `npm run typecheck` if TypeScript/package changes require it
- `npm run smoke:m01-preview`
- any new smoke script if added
- `git diff --check`

Expected commit:
- `test: add M01 real-input preview smoke`

### Task 3: Strengthen Gameplay State Regression Coverage

- [ ] identify the highest-risk uncovered M01 interaction lifecycle gap by reading current tests
- [ ] add focused regression coverage, changing production code only if a real gap is found
- [ ] update `production/active.md` with the new coverage and why this gap was chosen
- [ ] verify with targeted tests, `npm run typecheck`, `npm test`, and `git diff --check`

Reframe:
- User-facing M01 behavior depends on several fragile state transitions: held fragment follows pointer until second click, touch/mouse global move paths, flashlight beam movement reveals fragments continuously, staged evidence unstages when fragments move away, and failed validation resets color reveal state.
- Add focused regression coverage for the highest-risk uncovered transition discovered by reading existing tests.

Scope:
- likely `tests/cocos/M01GreyboxSession.test.ts`, `tests/cocos/M01GreyboxDrag.test.ts`, `tests/cocosProjectScaffold.test.ts`, or small runtime helpers
- production code only if a real gap is found
- `production/active.md`

Constraints:
- Do not change puzzle rules.
- Do not add UI text or final art.
- If all listed behaviors are already well-covered, choose the next highest-risk lifecycle gap and document why.

Verification:
- targeted tests for changed coverage
- `npm run typecheck`
- `npm test`
- `git diff --check`

Expected commit:
- `test: cover M01 interaction state regressions` or a more precise message if a bug is fixed

### Task 4: Make Preview Refresh/Smoke Workflow Less Fragile

- [ ] add a repo-local helper, script option, or focused documentation path for stale preview diagnosis and refresh
- [ ] prefer MCP refresh / soft reload guidance before any restart-heavy fallback
- [ ] update `production/active.md` with the stabilized refresh/smoke workflow
- [ ] verify any helper syntax, run `npm run smoke:m01-preview` after the refresh path if feasible, and run `git diff --check`

Reframe:
- We already hit stale Cocos preview bundles. The fix is known, but future agents should not rediscover it by trial and error.
- Add a small repo-local helper, script option, or documentation path that makes stale preview diagnosis and refresh steps explicit and easy to run before smoke.

Scope:
- `scripts/`, `package.json`, and/or docs under `docs/`
- `production/active.md`

Constraints:
- Do not require killing Cocos Creator unless the helper first tries MCP refresh and explains the safer path.
- Do not stage Cocos editor state files.

Verification:
- command syntax check for any script
- `npm run smoke:m01-preview` after helper/refresh path if feasible
- `git diff --check`

Expected commit:
- `chore: document M01 preview refresh workflow` or `chore: add M01 preview refresh helper`
