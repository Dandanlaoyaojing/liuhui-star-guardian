# liuhui-star-guardian

Prototype repo for 《流辉美慧号：星图守护者》.

## Current Focus

The active playable prototype is `assets/scenes/M01Greybox.scene`. The current M01 loop is:

- switch between the red / yellow / blue flashlight
- reveal candidate fragment blend colors
- pick up fragments and weak-snap them onto overlap evidence
- let the bottom light validate the full candidate structure

If the Cocos browser preview opens to a blank shell, use:

- `http://127.0.0.1:7456/?scene=a2135734-fc11-4a0e-926d-40bc2301a752`

`/` can stay black when Cocos has no `current_scene` selected.

## Local Checks

- `npm test`
- `npm run typecheck`

## Ralphex + Codex

This repo includes a project-local `.ralphex/config` that points Ralphex at `.ralphex/bin/codex-as-claude.sh`.

Requirements:

- `ralphex`
- `codex`
- `jq`

Defaults:

- `CODEX_SANDBOX=workspace-write`
- `CODEX_MODEL` is optional
- `CODEX_VERBOSE=1` includes command output in the translated stream
- `CODEX_DANGEROUS_RUN=1` is opt-in only for environments that already provide an external sandbox

The first repo trial intentionally keeps:

- `external_review_tool = none`
- `finalize_enabled = false`

The directories `.ralphex/progress/`, `.ralphex/worktrees/`, `.ralphex/agents/`, and `.ralphex/prompts/` are local runtime state, not source-of-truth project artifacts.
