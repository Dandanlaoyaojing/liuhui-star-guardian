# M01 First Preview Ralphex Checkpoint

Goal: Continue the M01 first-preview implementation using the repo-local autonomous checkpoint loop. Do not redesign puzzle rules. Do not redo completed historical tasks.

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
- `profiles/v2/packages/scene.json` may already be modified by Cocos/editor state. Do not stage, revert, or overwrite it.
- Stage only files directly related to the checkpoint.
- Keep the work within M01 first-preview polish, tests, and handoff docs.

### Task 1: Pick and complete one bounded first-preview checkpoint (completed 2026-05-01)

1. Read the sources of truth above.
2. Inspect current git status and recent commits.
3. Choose the smallest clear M01 first-preview checkpoint that:
   - is already implied by `production/active.md` or the M01 plan,
   - does not need a new product decision,
   - can be verified with tests/typecheck and, if practical, a Cocos/browser smoke.
4. Before editing, state the selected checkpoint and file scope in the agent output.
5. For behavior changes, write or update the smallest useful failing test first.
6. Implement the checkpoint.
7. Run the strongest relevant verification:
   - targeted tests for changed behavior,
   - `npm run typecheck` for TypeScript changes,
   - broader `npm test` if shared/runtime-adjacent logic changed,
   - `git diff --check` before commit.
8. Self-review the just-made diff. If findings are valid, fix them and rerun relevant verification.
9. Update `production/active.md` with the completed checkpoint, verification evidence, and next recommended step.
10. Commit and push only scoped files on the current branch.
11. Stop after this one checkpoint and report:
    - selected checkpoint,
    - changed files,
    - verification evidence,
    - commit hash,
    - remaining dirty files, if any.

Completion note:
- Selected checkpoint: failed bottom-light validation now briefly reveals the staged fragments' true colors, then returns them to grey after the 2-second flash window.
- File scope: `assets/scripts/cocos/M01GreyboxSession.ts`, `assets/scripts/cocos/M01GreyboxBootstrap.ts`, `tests/cocos/M01GreyboxSession.test.ts`, `tests/cocosProjectScaffold.test.ts`, `production/active.md`.
- Verification evidence: `npm test -- tests/cocos/M01GreyboxSession.test.ts`, `npm test -- tests/cocosProjectScaffold.test.ts`, `npm run typecheck`, `npm test`, and `git diff --check` all passed; `curl -I http://127.0.0.1:7456/` returned `HTTP/1.1 200 OK`.
