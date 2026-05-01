# Cocos Scene Entry Points

This folder is reserved for Cocos Creator scene assets.

`M01Greybox.scene` is the committed preview entry for the M01 greybox prototype.
It attaches `M01GreyboxBootstrap` to `M01GreyboxRoot`. An optional `Label` can be
wired to `statusLabel`; if it is omitted, the bootstrap creates a runtime status
label.

The bootstrap loads:

- `assets/resources/configs/stage1/m01-memory-gear.json`
- `assets/scripts/levels/stage1/M01MemoryGearController.ts`

It now builds the overlap-evidence M01 preview at runtime:

- gear-star body
- 3 color flashlights
- candidate fragments with hidden base colors
- overlap evidence markers
- bottom-light validation and ToolCard preview
- click/drag interaction path: flashlight -> reveal -> weak snap -> validation

The current browser preview entry is:

- `http://127.0.0.1:7456/?scene=a2135734-fc11-4a0e-926d-40bc2301a752`

The bare `/` route can stay black if Cocos has no `current_scene` selected.

The repo keeps the layout and click-session logic in pure TypeScript so it can
be validated with `npm test` before deeper Cocos node binding and art polish.
