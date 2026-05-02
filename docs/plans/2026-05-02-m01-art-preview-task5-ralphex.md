# M01 Art Preview Task 5 Ralphex Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the remaining Task 5 art-preview inventory for the current M01 overlap-evidence prototype behind the existing disabled art-preview toggle.

**Architecture:** Build on the already committed overlap-evidence runtime sprite mapping. Keep `M01GreyboxBootstrap.enableArtPreview` default `false`; add inventory declarations and minimal placeholder/runtime resources only where tests prove the current art plan is incomplete. Do not change M01 puzzle rules, evidence pairs, snap zones, completion logic, or preview smoke semantics.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Vitest, repo-local M01 preview smoke scripts.

---

## Sources Of Truth

- `AGENTS.md`
- `CLAUDE.md`
- `docs/ai-workflow.md`
- `docs/ai-autonomous-checkpoint-loop.md`
- `docs/design/game-design-spec.md`
- `production/active.md`
- `docs/plans/2026-05-02-m01-manual-qa-art-polish-plan.md`
- `docs/design/generated-m01-art-slices/m01-overlap-runtime-art-polish-qa-and-prompt.md`

## Current State

- Task 1-4 of the manual QA art polish plan are complete.
- First-pass hidden fragment and evidence marker resources already exist and are mapped.
- Remaining Task 5 coverage should focus on the missing overlap-mode runtime-art inventory:
  - flashlight tool resources
  - assembly plate / memory gear art resource declaration
  - bottom fragment floor surface resource declaration
  - ToolCard preview frame resource declaration
- The worktree may contain unrelated Cocos editor state in `profiles/v2/packages/scene.json` and `settings/v2/packages/information.json`; do not stage or modify those files.

## Non-Goals

- Do not generate final production art.
- Do not change M01 gameplay rules or solution data.
- Do not reintroduce the legacy nine-slot sorter.
- Do not enable art preview by default.
- Do not stage unrelated Cocos editor/profile changes.
- Do not resume M30 or any other level.

---

### Task 1: Complete M01 Overlap Art Preview Inventory

- [ ] Read the sources of truth and confirm the checkpoint is the remaining Task 5 inventory, not a new product-design pass.
- [ ] Add failing or extended tests in `tests/cocos/M01GreyboxArt.test.ts` and, if needed, `tests/cocosProjectScaffold.test.ts` requiring overlap-mode art inventory to include flashlight tools, assembly plate / memory gear, bottom fragment floor, and ToolCard preview frame resources in addition to the already mapped hidden fragments and evidence markers.
- [ ] Run `npm test -- tests/cocos/M01GreyboxArt.test.ts tests/cocosProjectScaffold.test.ts` and confirm the new expectations fail for the intended missing inventory.
- [ ] Implement the minimal `M01GreyboxArt.ts` resource declarations and mapping changes needed to satisfy the tests while keeping `enableArtPreview=false` by default.
- [ ] Add or generate only the smallest acceptable placeholder runtime resources under `assets/resources/art/stage1-m01/runtime-sprites/` if the tests require real files; include Cocos `.png.meta` files for any added PNG.
- [ ] Keep existing real-input and gameplay paths untouched; if `M01GreyboxBootstrap.ts` changes, it must only consume non-interactive art plan resources and preserve hit targets.
- [ ] Update `production/active.md` with the checkpoint result, verification evidence, residual risk, and next recommended step.
- [ ] Verify with:
  - `npm test -- tests/cocos/M01GreyboxArt.test.ts tests/cocosProjectScaffold.test.ts`
  - `npm run typecheck`
  - `npm test`
  - `git diff --check`
- [ ] Run `npm run smoke:m01-preview-refresh` and `npm run smoke:m01-preview:input` if the local Cocos MCP / preview services are reachable; if unavailable, record the blocker precisely in `production/active.md` instead of faking success.
- [ ] Self-review the diff for accidental product-rule changes, legacy sorter regression, tests that do not prove the intended behavior, and accidental staging of Cocos editor state.
- [ ] Commit only scoped files with a focused message.
