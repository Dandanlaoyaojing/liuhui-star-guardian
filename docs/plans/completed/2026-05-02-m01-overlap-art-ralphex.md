# M01 Overlap Art Ralphex Checkpoint

Goal: Continue M01 first-preview polish after the fixed-shape greybox and preview smoke harness are working. Complete one bounded checkpoint toward formal grey-white fragment / evidence marker art for the new overlap-evidence M01. Do not revive legacy filter/tray sorter art.

Sources of truth:
- `AGENTS.md`
- `CLAUDE.md`
- `docs/ai-workflow.md`
- `docs/ai-autonomous-checkpoint-loop.md`
- `docs/design/game-design-spec.md`
- `production/active.md`
- `docs/plans/2026-04-29-m01-overlap-evidence-greybox-plan.md`
- `docs/plans/2026-04-27-m01-art-slice-calibration.md`

Current branch: `codex/m01-drag-greybox`.

Known boundary:
- `profiles/v2/packages/scene.json` and `settings/v2/packages/information.json` may already be modified by Cocos/editor state. Do not stage, revert, overwrite, or format them.
- Stage only files directly related to this checkpoint.
- Keep work scoped to M01 overlap-evidence art integration, tests, and handoff docs.
- The current Cocos preview can go stale. If `npm run smoke:m01-preview` reports missing `fragment_circle_*` or `evidence_*` nodes, refresh through the local MCP server before rerunning:
  - POST `{ "folder": "db://assets/scripts" }` to `http://127.0.0.1:3000/api/project/refresh_assets`
  - POST `{ "folder": "db://assets/resources/configs/stage1" }` to `http://127.0.0.1:3000/api/project/refresh_assets`
  - POST `{}` to `http://127.0.0.1:3000/api/sceneAdvanced/soft_reload_scene`

### Task 1: Add first-pass overlap-evidence art resources and mapping

Reframe:
- The product need is not final art polish yet. The immediate need is to stop the new M01 preview from depending only on pure greybox Graphics for candidate fragments and evidence markers.
- The key gameplay constraint is that hidden base color must remain hidden: same-shape fragments with different `hiddenColor` must use the same default grey-white shape art until flashlight reveal or validation light explicitly shows color.

Expected implementation shape:
- [x] Read the files listed above plus the relevant M01 art/layout/bootstrap/tests.
- [x] Add or generate the smallest useful runtime resources for the new overlap-evidence mode:
  - [x] shape-only grey-white fragment resources for exactly `circle`, `triangle`, `hexagon`
  - [x] first-pass evidence marker resources that map by evidence `targetBlendColor` and `generatedOverlap.sourceShapes` without exposing solution fragment IDs
- [x] Update `M01GreyboxArt` and related tests so real overlap-evidence M01 no longer returns only the gear token art. Real-config candidate fragments now map to shape-only hidden/grey art and evidence markers map to evidence marker art, while legacy sorter token art remains quarantined from the new mode.
- [x] Ensure new `assets/resources` art files include Cocos `.meta` files. The local MCP refresh endpoint returned `404` in this session, so metadata was generated locally and validated by tests.
- [x] Keep evidence marker art non-interactive and preserve existing greybox hit targets / drag zones through the existing token-art attachment path.
- [x] Update `production/active.md` with the checkpoint result, verification evidence, and the next recommended step.
- [x] Commit only the scoped files on the current branch. No push was attempted from this restricted session.

Verification:
- [x] Run the most specific tests touched by the change: `npm test -- tests/cocos/M01GreyboxArt.test.ts`.
- [x] Run `npm run typecheck`.
- [x] Run broader `npm test` because shared M01 runtime art plumbing changed.
- [x] Run `git diff --check` before commit.
- [x] Run `npm run smoke:m01-preview`. No MCP refresh was required after the art change; the smoke passed against the existing preview.

Stop condition:
- Stop after this one checkpoint. Report selected scope, changed files, verification evidence, commit hash, pushed branch, and any remaining dirty files.
