# CLAUDE.md — liuhui-star-guardian

## Project Context

**《流辉美慧号：星图守护者》** — 面向成人及青年玩家（16+）、对思维成长感兴趣者的认知解谜游戏。详见 `docs/design/vision.md`。

- **Engine**: Cocos Creator 3.8+ (TypeScript)
- **Platforms**: Web(H5), WeChat Mini Game, iOS, Android
- **Architecture**: Pure client-side (MVP), with reserved backend interfaces
- **Art Style**: Arrog-inspired minimalist hand-drawn line art with restrained low-saturation color

## Source Of Truth

- The authoritative product spec is `docs/design/game-design-spec.md`.
- All implementation must align with that spec.
- If behavior, scope, or puzzle structure needs to change, update the spec first.

## Shared Workflow

- Follow `docs/ai-workflow.md` for the common execution flow.
- Before substantial work, read `production/active.md` if it exists.
- For substantial work, keep `production/active.md` updated with the current objective, scope, decisions, blockers, and next step.
- Use `production/active.md` as the cross-session artifact, not chat memory.

## Core Rules

- Reframe the task before implementing it. Do not jump straight from request to code if the real problem is unclear.
- Distinguish **lake** vs **ocean** work. Fully solve small, well-bounded problems; explicitly scope large, system-wide work.
- Check three knowledge layers before locking a solution:
  - existing standard or known pattern
  - current community practice
  - first-principles reasoning
- If the same bug or issue has resisted three materially different attempts, stop patching and reassess the root cause.
- When fixing a bug, state the intended impact scope and avoid incidental edits outside that scope.
- Do not claim completion without verification evidence.
- If the task needs automated verification and the project has no suitable test scaffold yet, add the smallest useful scaffold or explain the blocker clearly.

## Code Standards

- All code in TypeScript (strict mode).
- Puzzle logic is data-driven via JSON configs in `resources/configs/`.
- Complex per-level logic goes in `scripts/levels/stageN/`.
- Interaction components in `scripts/interaction/` are reusable across levels.
- Shaders live in `shaders/`.

## MVP Scope

Phase 1: 10 puzzles (M01-M10, "秩序之基" stage)

- Core framework + puzzle engine + 6 base shaders
- Placeholder art for prototypes; final art must be regenerated or polished against the three active style references in `docs/design/style-references/`
- Local storage for progress
