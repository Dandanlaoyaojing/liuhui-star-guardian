# CLAUDE.md — liuhui-star-guardian

## Project Context

**《流辉美慧号：星图守护者》** — 面向成人及青年玩家（16+）、对思维成长感兴趣者的认知解谜游戏。详见 `docs/design/vision.md`。

- **Engine**: Cocos Creator 3.8+ (TypeScript)
- **Platforms**: iOS App + Steam (PC/Mac). (2026-06-01 调整;历史曾含 Web/微信小游戏/安卓，微信 4MB 主包限制不再适用，动画帧数可按质量给足)
- **Architecture**: Pure client-side (MVP), with reserved backend interfaces
- **Art Style**: Arrog-inspired minimalist hand-drawn line art with restrained low-saturation color

## Source Of Truth

- The authoritative product spec is `docs/design/game-design-spec.md`.
- All implementation must align with that spec.
- If behavior, scope, or puzzle structure needs to change, update the spec first.

## Shared Workflow

- Follow `docs/ai-workflow.md` for the common execution flow.
- Follow `docs/ai-autonomous-checkpoint-loop.md` when the user asks to keep moving autonomously with prompts like "继续下一步", "开始下一步工作", or "自己 review 一下".
- Before substantial work, read `production/active.md` if it exists.
- For substantial work, keep `production/active.md` updated with the current objective, scope, decisions, blockers, and next step.
- Use `production/active.md` as the cross-session artifact, not chat memory.

## Automation

- The repo ships a project-local `.ralphex/config` that routes Ralphex task/review execution through `.ralphex/bin/codex-as-claude.sh`.
- Default automation runs should keep `CODEX_SANDBOX=workspace-write`; only set `CODEX_DANGEROUS_RUN=1` when an external sandbox already exists and the operator explicitly intends that mode.
- `.ralphex/progress/`, `.ralphex/worktrees/`, `.ralphex/agents/`, and `.ralphex/prompts/` are local runtime state. Do not treat them as source-of-truth docs.

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
- Placeholder art for prototypes; final art must be regenerated or polished against the four active style references in `docs/design/style-references/`
- Local storage for progress
