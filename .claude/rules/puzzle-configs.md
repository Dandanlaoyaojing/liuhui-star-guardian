---
globs: StarGuardian/Assets/Resources/Configs/**/*.json, assets/resources/configs/**/*.json
---

# Puzzle Config Rules

> **适用边界(2026-07-16)**: 新建/自有 config 适用。**自 Cocos 逐字拷贝的运行时 config**
> (`StarGuardian/Assets/Resources/Configs/` 下与 `assets/resources/configs/` 双源字节相等的那些)
> **豁免** `_comment`/`$schema`/命名三条 —— 它们由 `M02ConfigSyncTests` 等钉着**字节相等**,
> 单侧加注释会当场撞红同步测试。等 Cocos 树退役、双源合一后再统一补规。


- File naming: `puzzle_MXX.json` for puzzle configs, `[system]_[name].json` for other configs
- All keys use camelCase
- Every numeric value must have a comment field explaining its meaning (e.g., `"hintDelay": 15, "hintDelay_comment": "seconds before auto-hint"`)
- Must include a `"$schema"` or `"version"` field at the top level for forward compatibility
- No orphaned entries — every config value must be referenced by code
- Invalid JSON blocks commits (enforced by validate-commit hook)
