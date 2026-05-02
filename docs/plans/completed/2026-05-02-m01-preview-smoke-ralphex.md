# M01 Preview Smoke Ralphex Checkpoint

Goal: Run one bounded M01 first-preview checkpoint through the repo-local autonomous loop. This checkpoint is verification-first: confirm the current M01 Cocos preview behavior for failed bottom-light validation, then record the result. Do not redesign puzzle rules.

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
- `profiles/v2/packages/scene.json` and `settings/v2/packages/information.json` may already be modified by Cocos/editor state. Do not stage, revert, or overwrite them.
- Stage only files directly related to this checkpoint.
- Keep the work within M01 first-preview smoke verification and handoff docs.

### Task 1: Verify M01 Failed Bottom-Light Preview Smoke

- [x] Read the sources of truth above.
- [x] Inspected current git status and recent commits.
- [x] Reframed the checkpoint before editing: selected checkpoint = Cocos/browser preview smoke for the wrong complete M01 candidate; desired behavior = wrong complete candidate triggers bottom-light flash, staged fragments briefly reveal true base colors, then return to grey after about 2 seconds; file scope stayed in handoff docs because verification did not expose a runtime bug.
- [x] Confirmed preview availability with `curl -I http://127.0.0.1:7456/`; scene URL remains `http://127.0.0.1:7456/?scene=a2135734-fc11-4a0e-926d-40bc2301a752`.
- [x] Browser smoke not run because browser automation is unavailable in this session (`mcp__node_repl__js` is not exposed, the repo has no `playwright`, and no local `chrome/chromium` binary is available). Strongest available evidence was gathered and recorded instead.
- [x] Recorded the blocker instead of faking success.
- [x] Ran relevant verification: `npm test -- tests/cocos/M01GreyboxSession.test.ts`, `npm run typecheck`, and `npm test`.
- [x] Self-reviewed the doc-only diff and kept the scope limited to the checkpoint plan plus `production/active.md`.
- [x] Updated `production/active.md` with what was verified, screenshot status (none this round), console/page error status (not collected this round), and the residual blocker / next recommended step.
- [x] Committed scoped files on the current branch; push skipped because external network actions are not automatable in this session.
- [x] Reported the selected checkpoint, changed files, verification evidence, commit hash, and remaining dirty files in the agent response.
