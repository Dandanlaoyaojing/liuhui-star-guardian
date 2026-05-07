# M01 Standard-Piece Target Manifest Plan

## Goal

Make M01 target geometry use one canonical standard-piece manifest. Candidate pieces and the center target must share the same piece definitions, so manual assembly can become the locked target without a second, drifting coordinate system.

## Current Problem

- Candidate fragments are already displayed as 56x56 standard pieces.
- The target preview also renders hidden standard-piece sprites, but its target slots are still hardcoded in `M01GreyboxLayout.ts`.
- Because the target is not authored from the same data as the pieces, the preview can drift: sizes line up in one place, but target placement still depends on separate code constants.

## Design

- Add `standardPieces` to `assets/resources/configs/stage1/m01-memory-gear.json`.
- Add `targetPattern` to the same config. This is the manually assembled, locked target manifest.
- Keep initial manifest positions equal to the latest accepted layout, then let future manual assembly update only this JSON data.
- Make layout derive `targetPieceSlots` from `targetPattern.pieces` and `standardPieces`.
- Preserve each manifest piece's `standardPieceId`, `position`, `rotation`, and `layer` through layout, art plan, and Cocos rendering.
- Keep legacy/empty configs stable by returning no target slots when no manifest exists.

## Test-First Tasks

1. Add layout tests proving the real M01 config contains a locked manual manifest and that every target slot is derived from it.
2. Add art tests proving target standard-piece rendering preserves manifest resource, size, position, rotation, and layer order.
3. Add scaffold coverage proving the old hardcoded target slot constructor is gone from layout code.
4. Implement M01 config types for standard pieces and target pattern pieces.
5. Seed `m01-memory-gear.json` with canonical circle, triangle, and hexagon standard pieces plus the locked target pattern.
6. Refactor layout to resolve target slots from manifest data.
7. Refactor art/bootstrap target standard-piece rendering to carry and apply layer/rotation.
8. Update `production/active.md` with evidence and run verification.

## Verification Commands

- `npm test -- tests/cocos/M01GreyboxLayout.test.ts tests/cocos/M01GreyboxArt.test.ts tests/cocosProjectScaffold.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run smoke:m01-preview-refresh && npm run smoke:m01-preview:input -- --enable-art-preview --capture-clean-qa`
- `git diff --check`
