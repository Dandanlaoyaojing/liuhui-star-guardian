# Cocos Scene Entry Points

This folder is reserved for Cocos Creator scene assets.

For the M01 greybox prototype, create a Cocos scene that attaches
`M01GreyboxBootstrap` to a root node and wires an optional `Label` to
`statusLabel`. The bootstrap loads:

- `assets/resources/configs/stage1/m01-memory-gear.json`
- `assets/scripts/levels/stage1/M01MemoryGearController.ts`

The current repo keeps scene logic in pure TypeScript first so it can be
validated with `npm test` before binding to Cocos nodes.
