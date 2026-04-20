---
globs: resources/configs/**/*.json
---

# Puzzle Config Rules

- File naming: `puzzle_MXX.json` for puzzle configs, `[system]_[name].json` for other configs
- All keys use camelCase
- Every numeric value must have a comment field explaining its meaning (e.g., `"hintDelay": 15, "hintDelay_comment": "seconds before auto-hint"`)
- Must include a `"$schema"` or `"version"` field at the top level for forward compatibility
- No orphaned entries — every config value must be referenced by code
- Invalid JSON blocks commits (enforced by validate-commit hook)
