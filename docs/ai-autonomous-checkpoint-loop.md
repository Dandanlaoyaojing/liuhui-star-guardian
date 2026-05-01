# Autonomous Checkpoint Loop

This document defines the repo-local autonomous workflow for AI collaborators.

The goal is to preserve the current working rhythm:

1. choose the next bounded checkpoint from files
2. implement it
3. verify it
4. review the just-made diff
5. fix valid findings
6. commit and push
7. continue to the next checkpoint

This is a bounded Ralph loop, not an infinite unattended loop. The agent should keep moving while the next step is clear, but must stop when the work needs a product decision, the verification signal is ambiguous, or the same issue resists repeated fixes.

---

## 1. Trigger

Use this loop when the user says any of:

- "继续下一步"
- "开始下一步工作"
- "继续修"
- "自己 review 一下"
- "按计划继续"

Also use it when the active plan explicitly asks for checkpoint execution and review.

Do not use this loop for pure brainstorming, product strategy discussion, or direct questions where the user clearly wants an answer rather than file changes.

---

## 2. Sources Of Truth

Each iteration starts from files, in this order:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/ai-workflow.md`
4. `docs/design/game-design-spec.md` for substantial work, and always for behavior changes
5. `production/active.md`
6. the current plan under `docs/plans/`

Chat history can explain context, but files decide the next task.

---

## 3. Loop Contract

### Step 1: Select One Checkpoint

Pick the smallest useful next step that can be verified inside the current turn.

A good checkpoint has:

- a clear user-visible or engineering outcome
- a small file scope
- a verification command or concrete review criterion
- no unresolved product decision

If multiple next steps are possible, prefer the one that removes the biggest current risk in `production/active.md`.

### Step 2: Reframe

Before editing, state the actual problem in one or two sentences:

- what the user asked for on the surface
- what outcome the repo needs now
- what files are in scope

### Step 3: Test First When Behavior Changes

For gameplay logic, UI behavior, validation, state transitions, data formats, or bug fixes:

1. write or update the smallest useful failing test
2. run it and confirm it fails for the intended reason
3. implement the minimal fix
4. rerun the target test

Documentation-only checkpoints may use doc consistency checks instead of TDD.

### Step 4: Verify

Use the strongest verification that matches the risk:

- target test for the changed behavior
- `npm run typecheck` for TypeScript changes
- `npm test` for shared logic or runtime-adjacent changes
- Cocos preview smoke for player-facing interaction or visual changes when the preview service is available
- `git diff --check` before commit
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org` and a focused secret/danger scan before pushing code changes

Never claim completion without fresh evidence.

### Step 5: Self Review

After verification, review the just-made diff as if it came from another engineer.

Lead with findings. Check at least:

- product behavior vs. `docs/design/game-design-spec.md`
- state lifecycle and cleanup
- legacy fixture compatibility
- tests that could pass without proving the intended behavior
- visual/UI regressions caused by stale state
- accidental inclusion of Cocos-generated or unrelated files

If there are findings, fix valid ones immediately using the same test-first rule when possible.

### Step 6: Update Handoff

For substantial checkpoints, update `production/active.md` with:

- what changed
- what was verified
- any blocker or residual risk
- the next recommended step if it is clear

Do not bury important decisions only in chat.

### Step 7: Commit And Push

Commit after each verified checkpoint, unless the user explicitly asks not to.

Rules:

- stage only files related to the checkpoint
- do not stage unrelated Cocos profile/editor churn such as `profiles/v2/packages/scene.json`
- use a focused commit message
- push the current branch
- leave the worktree status explicit in the final response

### Step 8: Continue Or Stop

Continue to the next checkpoint when:

- tests pass
- self review has no unresolved finding
- the next step is already clear from `production/active.md` or the active plan
- the next step is small enough for another bounded iteration

Stop and ask the user when:

- the next move changes product design or puzzle rules
- the same issue has resisted three materially different attempts
- Cocos preview or another required external tool is unavailable and no equivalent verification exists
- there are competing valid directions
- continuing would require staging unrelated user or editor changes

---

## 4. Review Finding Loop

When a review finding appears:

1. restate the technical issue without performative agreement
2. verify it against the code and spec
3. if valid, add or adjust a failing test when the issue is behavioral
4. implement the fix
5. run target verification
6. run self review again on the fix
7. commit and push the fix

Invalid findings should be rejected with concrete code/spec evidence.

---

## 5. External Tooling Option

This repo can run the loop manually through Codex plus project skills. A future external orchestrator can automate it.

Good fit:

- ralphex-style plan executor
- Ralph loop runner with fresh agent context per checkpoint
- self-review loop that supports commit hooks and review/fix cycles

Required integration properties:

- reads `production/active.md` and `docs/plans/`
- starts each iteration from a clean file-based handoff
- runs configured verification commands
- commits only scoped files
- performs at least one code-review pass before moving on
- stops on ambiguous product decisions

Until such a tool is installed and validated, this document is the local loop contract.
