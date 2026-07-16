# CLAUDE.md — liuhui-star-guardian

## Project Context

**《流辉美慧号：星图守护者》** — 面向成人及青年玩家（16+）、对思维成长感兴趣者的认知解谜游戏。详见 `docs/design/vision.md`。

- **Engine**: **Unity 6.3 LTS `6000.3.19f1`(2D URP, C#)** —— 2026-07-12 起从 Cocos Creator 3.8(TypeScript)迁移, 决策与计划见 `docs/design/unity-migration-plan.md`。Cocos 版完整保留于 tag `cocos-engine-final-2026-07-12`(历史真源, TS 代码/`assets/` 目录暂存库中作迁移对照)
- **Platforms**: iOS App + Steam (PC/Mac). (2026-06-01 调整;历史曾含 Web/微信小游戏/安卓，微信 4MB 主包限制不再适用，动画帧数可按质量给足)
- **Architecture**: Pure client-side (MVP), with reserved backend interfaces
- **Art Style**: Arrog-inspired minimalist hand-drawn line art with restrained low-saturation color

## Source Of Truth

- The authoritative product spec is `docs/design/game-design-spec.md`.
- All implementation must align with that spec.
- If behavior, scope, or puzzle structure needs to change, update the spec first.

## Shared Workflow

- Follow `docs/ai-workflow.md` for the common execution flow.
- **跨 AI 审阅一律零框架**(只给对象+中性环境事实, 不给你改了什么/重点查什么/你的结论)——见 `docs/ai-workflow.md` §7b。引导=把盲点传染给审阅者, 第二意见沦为回声。
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

- Unity 侧一律 C#(工程在 `StarGuardian/`, 纯逻辑放 `StarGuardian/Assets/Scripts/{Core,Interaction,M01}/`, 禁 `using UnityEngine` 于纯逻辑层, C#9 兼容——禁 record struct/文件级 namespace)。历史 TS(`assets/scripts/`, strict mode)仅作迁移对照, 不再新增。
- Puzzle logic is data-driven via JSON configs; Unity 运行时源=`StarGuardian/Assets/Resources/Configs/`(自 `assets/resources/configs/` 拷贝, 改配置两处同步直至 Cocos 树退役)。
- 纯逻辑测试在 `unity-tests/Core.Tests`(xUnit, `dotnet test`; 同一批 .cs 由 Unity 与 dotnet 双编译——dotnet 绿≠Unity 编得过, 需 Unity console 复核)。
- Interaction components in `scripts/interaction/` are reusable across levels.
- Shaders live in `shaders/`.

## MVP Scope

Phase 1: 10 puzzles (M01-M10, "秩序之基" stage)

- Core framework + puzzle engine + 6 base shaders
- Placeholder art for prototypes; final art must be regenerated or polished against the four active style references in `docs/design/style-references/`
- Local storage for progress
