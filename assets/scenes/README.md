# Cocos Scene Entry Points

This folder is reserved for Cocos Creator scene assets.

For the M01 greybox prototype, create a Cocos scene that attaches
`M01GreyboxBootstrap` to a root node. An optional `Label` can be wired to
`statusLabel`; if it is omitted, the bootstrap creates a runtime status label.

The bootstrap loads:

- `assets/resources/configs/stage1/m01-memory-gear.json`
- `assets/scripts/levels/stage1/M01MemoryGearController.ts`

It then builds the first greybox view at runtime:

- gear-star body
- 3 color filters
- 18 fragments
- 9 sorting slots
- click-to-test interaction path: filter -> fragment -> slot

The current repo keeps the layout and click-session logic in pure TypeScript so
it can be validated with `npm test` before deeper Cocos node binding and drag
polish.
