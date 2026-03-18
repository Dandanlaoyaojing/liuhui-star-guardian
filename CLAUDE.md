# CLAUDE.md — liuhui-star-guardian

## Project Context

**《流辉美慧号：星图守护者》** — 面向儿童的认知成长解谜游戏。

- **Engine**: Cocos Creator 3.8+ (TypeScript)
- **Platforms**: Web(H5), WeChat Mini Game, iOS, Android
- **Architecture**: Pure client-side (MVP), with reserved backend interfaces
- **Art Style**: Paul Klee + Machinarium aesthetic

## Design Document

The authoritative design document is: `docs/design/game-design-spec.md`

All implementation must align with this spec. If something needs changing, update the spec first.

## Code Standards

- All code in TypeScript (strict mode)
- Puzzle logic is data-driven via JSON configs in `resources/configs/`
- Complex per-level logic goes in `scripts/levels/stageN/`
- Interaction components in `scripts/interaction/` are reusable across levels
- Shaders in `shaders/` directory

## MVP Scope

Phase 1: 10 puzzles (M01-M10, "秩序之基" stage)
- Core framework + puzzle engine + 6 base shaders
- Placeholder art (to be replaced with AI-generated + polished assets)
- Local storage for progress
