# M01 Strict Input Repair Ralphex Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore `npm run smoke:m01-preview:input` so the M01 strict real-browser input path completes without falling back.

**Architecture:** Treat this as an input-state lifecycle bug, not an art or design task. The latest failure snapshot shows the held flashlight remains active and consumes later fragment drags, so the fix should make fragment interaction end or suspend held-flashlight beam/drag state without changing M01 puzzle rules, evidence pairs, art resources, or completion semantics.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Vitest, Playwright-based M01 preview smoke, repo-local Cocos MCP refresh helper.

---

## Sources Of Truth

- `AGENTS.md`
- `CLAUDE.md`
- `docs/ai-workflow.md`
- `docs/ai-autonomous-checkpoint-loop.md`
- `docs/design/game-design-spec.md`
- `production/active.md`
- `docs/plans/2026-05-02-m01-manual-qa-art-polish-plan.md`

## Current Failure Snapshot

`npm run smoke:m01-preview:input` currently fails strict mode by falling back. The latest snapshot in `production/active.md` says:

- `heldFlashlightId = flashlight_red`
- fragment drags move the flashlight position instead of staging evidence
- `isEvidenceStaged = false`
- failure happens in the real browser input path, while domain/tests remain green

## Non-Goals

- Do not change M01 puzzle rules, config, evidence solution pairs, or ToolCard text.
- Do not modify first-pass art resources unless the input bug directly requires it.
- Do not enable art preview by default.
- Do not resume M30 or any other level.

---

### Task 1: Fix Held-Flashlight State Before Fragment Drags

- [x] Read the sources of truth and reproduce the current strict smoke failure with `npm run smoke:m01-preview:input`, capturing the relevant snapshot.
- [x] Add or strengthen a focused test in `tests/cocosProjectScaffold.test.ts` or another existing M01 interaction test so the code must clear, suspend, or ignore held-flashlight follow/beam state when a fragment press begins.
- [x] Run the focused test and confirm it fails for the intended missing lifecycle guard.
- [x] Implement the smallest `M01GreyboxBootstrap.ts` fix so pressing or dragging a fragment cannot be treated as continued held-flashlight movement or beam gesture.
- [x] Verify focused tests with `npm test -- tests/cocosProjectScaffold.test.ts tests/m01PreviewSmokeScript.test.ts`.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `git diff --check`.
- [x] Refresh Cocos preview with `npm run smoke:m01-preview-refresh`.
- [x] Run `npm run smoke:m01-preview:input` and require `realInput.usedFallback = false`.
- [x] Update `production/active.md` with the root cause, fix, verification evidence, and next recommended step.
- [x] Self-review the diff for accidental gameplay-rule changes, stale flashlight state cleanup gaps, tests that only check strings, and accidental generated/editor files.
- [x] Commit and push only scoped files with a focused message.
