# M30 Danger Prototype Autoloop Ralphex Plan

> **Status:** PAUSED on 2026-05-02. Do not execute this plan until M01 is complete and the operator explicitly resumes M30 work.
>
> Rationale: the current production focus is to finish M01 first. This file is kept as a later-stage planning artifact only, not an active handoff.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Start the non-art M30 dangerous prototype so Stage 5 can be tested as a real "naming ritual" instead of prose.

**Architecture:** Build M30 from data and domain logic first, then add a thin greybox runtime shell. The first prototype should model conceptual blending as a concrete operation: choose two source concepts, extract compatible traits, combine them into a named emergent concept, and unlock a ToolCard only after the blend is justified by the selected traits.

**Tech Stack:** Cocos Creator 3.8 TypeScript, JSON configs under `assets/resources/configs/`, level controllers under `assets/scripts/levels/`, Vitest tests, existing ToolCard and ProgressStore helpers.

---

## Sources Of Truth

- `AGENTS.md`
- `CLAUDE.md`
- `docs/ai-workflow.md`
- `docs/ai-autonomous-checkpoint-loop.md`
- `docs/design/game-design-spec.md`
- `production/active.md`
- this plan

## Current Branch

`codex/m01-drag-greybox`

## Known Boundary

- Final art, bitmap redraw, polished VFX, and Stage 5 illustration work are out of scope.
- Do not stage or revert unrelated Cocos editor state files, especially `profiles/v2/packages/scene.json` and `settings/v2/packages/information.json`.
- Do not redesign all of Stage 5. This is one narrow M30 prototype path.
- Use the spec-supported seed metaphor from `docs/design/wisdom-crystal-imagery-pool.md`: "moon + coin" creates a new concept around cyclical exchange/value. The exact greybox target name can be product-copy refined later, but the prototype must prove the player performs A+B->C, not just clicks through text.
- Commit and push after each completed checkpoint. Continue automatically while verification is clear.

## Acceptance Shape

M30's first playable greybox should eventually prove this loop:

1. Player inspects two source concept cards.
2. Player chooses one trait from each source.
3. Player places those traits into a furnace / blend slot.
4. System validates that the two traits can generate the target emergent concept.
5. Player names or selects the emergent concept.
6. ToolCard "概念融合" unlocks only after a valid blend.

This batch does not need final Cocos preview smoke unless a runtime scene is added and the local preview is available.

### Task 1: Freeze The M30 Prototype Contract In Data

- [ ] Add the smallest M30 JSON config under `assets/resources/configs/stage5/`.
- [ ] Add TypeScript interfaces and config validation for the M30 concept-blending shape.
- [ ] Add failing tests first for the config shape, then implement until they pass.
- [ ] Update `production/active.md` with the new M30 prototype contract and verification evidence.
- [ ] Verify with targeted tests, `npm run typecheck`, `npm test`, and `git diff --check`.

Reframe:

- The product risk is that Stage 5 becomes text-only philosophy.
- The smallest useful M30 step is a typed data contract that forces concept fusion to be represented as source concepts, traits, a target blend, and a ToolCard.

Suggested file scope:

- Create: `assets/resources/configs/stage5/m30-metaphor-furnace.json`
- Create: `assets/resources/configs/stage5.meta` if Cocos metadata is required by the repo pattern
- Create or modify: `assets/scripts/levels/stage5/M30MetaphorFurnaceController.ts`
- Modify: `tests/core/PuzzleConfig.test.ts` or add `tests/levels/stage5/M30MetaphorFurnaceController.test.ts`
- Modify: `production/active.md`

Verification:

- `jq empty assets/resources/configs/stage5/m30-metaphor-furnace.json`
- `npm test -- tests/levels/stage5/M30MetaphorFurnaceController.test.ts tests/core/PuzzleConfig.test.ts`
- `npm run typecheck`
- `npm test`
- `git diff --check`

Expected commit:

- `feat: define M30 concept blend config`

### Task 2: Implement M30 Blend Validation Domain Logic

- [ ] Add tests for selecting source traits, rejecting incomplete blends, rejecting mismatched traits, accepting the intended blend, and preserving deterministic result state.
- [ ] Implement the minimal controller methods needed by the tests.
- [ ] Ensure the controller does not unlock the ToolCard before a valid blend is completed.
- [ ] Update `production/active.md` with what the domain layer now proves.
- [ ] Verify with targeted tests, `npm run typecheck`, `npm test`, and `git diff --check`.

Reframe:

- The core gameplay action is not dragging yet; it is whether the system can distinguish "random association" from a justified conceptual blend.
- Domain tests should make that distinction explicit before any Cocos shell exists.

Suggested file scope:

- Modify: `assets/scripts/levels/stage5/M30MetaphorFurnaceController.ts`
- Modify: `tests/levels/stage5/M30MetaphorFurnaceController.test.ts`
- Modify: `production/active.md`

Verification:

- `npm test -- tests/levels/stage5/M30MetaphorFurnaceController.test.ts`
- `npm run typecheck`
- `npm test`
- `git diff --check`

Expected commit:

- `feat: add M30 blend validation`

### Task 3: Wire M30 ToolCard And Progress Unlock

- [ ] Add tests proving a valid M30 blend unlocks exactly one ToolCard and persists progress.
- [ ] Add tests proving invalid or incomplete blends do not unlock the ToolCard.
- [ ] Reuse existing ToolCard validation and ProgressStore patterns from M01.
- [ ] Update `production/active.md` with the ToolCard unlock evidence.
- [ ] Verify with targeted tests, `npm run typecheck`, `npm test`, and `git diff --check`.

Reframe:

- M30 is the "naming ritual" risk prototype, so the ToolCard is not optional decoration.
- The ToolCard must be causally tied to the player completing the blend.

Suggested file scope:

- Modify: `assets/resources/configs/stage5/m30-metaphor-furnace.json`
- Modify: `assets/scripts/levels/stage5/M30MetaphorFurnaceController.ts`
- Modify: `tests/levels/stage5/M30MetaphorFurnaceController.test.ts`
- Modify: `production/active.md`

Verification:

- `npm test -- tests/levels/stage5/M30MetaphorFurnaceController.test.ts`
- `npm run typecheck`
- `npm test`
- `git diff --check`

Expected commit:

- `feat: unlock M30 concept fusion toolcard`

### Task 4: Add A Thin M30 Greybox Session API

- [ ] Add tests for a session-level API that a later Cocos shell can call: inspect concept, select trait, place trait into blend slot, choose or submit target name, validate, request hint, get feedback.
- [ ] Implement the smallest session wrapper around the controller.
- [ ] Keep all visuals abstract and text-light; no final art.
- [ ] Update `production/active.md` with the next recommended runtime checkpoint.
- [ ] Verify with targeted tests, `npm run typecheck`, `npm test`, and `git diff --check`.

Reframe:

- Before drawing a Cocos scene, the runtime needs a stable interaction API.
- This prevents the first Stage 5 scene from hardcoding concept-fusion rules directly into UI code.

Suggested file scope:

- Create: `assets/scripts/cocos/M30GreyboxSession.ts`
- Create: `tests/cocos/M30GreyboxSession.test.ts`
- Modify: `production/active.md`

Verification:

- `npm test -- tests/cocos/M30GreyboxSession.test.ts tests/levels/stage5/M30MetaphorFurnaceController.test.ts`
- `npm run typecheck`
- `npm test`
- `git diff --check`

Expected commit:

- `feat: add M30 greybox session`

## Stop Conditions

Stop and report instead of guessing if:

- the first M30 concept content cannot be derived from the existing spec/history files
- implementing the next checkpoint requires final art or a product decision about all Stage 5 rules
- verification fails repeatedly for the same root issue
- committing would require staging unrelated Cocos editor files
