# M01 Runtime Sprite Sheet v3 Visual QA and Prompt

> Date: 2026-04-28
> Scope: M01 art-preview visual QA after token-level runtime wiring
> Input preview: `temp/m01-art-preview-debug-underlay-hidden-complete.png`
> Current candidate source: `docs/design/generated-m01-art-slices/m01-runtime-sprite-sheet-candidate-v2.png`

## Visual QA

The current token-level art preview is playable and readable enough for gameplay-scale review:

- The repaired gear-star is recognizable at `960x640` preview scale.
- The nine-slot classification tray is readable after the greybox slot/gear underlay was hidden.
- Fragment and filter colors remain distinct in the intended clay red / dusty blue-gray / muted ochre range.
- The ToolCard completion layout is no longer visually blocked by bottom feedback.

The current candidate should not be promoted to final runtime replacement:

- The gear and tray are still derived from a paper-backed composite sheet, so their edges carry residual paper texture and crop artifacts.
- The filter sprites read as small paper-backed rectangular labels instead of clean magical/mechanical filter tools.
- The tray linework is usable, but still too close to a visual crop of the contact sheet; it should be regenerated as a dedicated gameplay sprite with simpler, cleaner slot rings.
- The gear body has good silhouette and palette, but should be regenerated with less salt-like edge noise and a more deliberate empty center designed to host the tray.
- The ToolCard thumbnail can remain a later pass; it is not blocking gameplay readability.

## v3 Asset Target

Generate one new formal runtime sprite sheet candidate, not another contact sheet. It should contain only the assets needed by the current runtime path:

- one empty gear-star body
- one empty nine-slot tray
- nine individual fragments: red/blue/yellow x circle/triangle/hexagon
- three individual color filters

The v3 sheet should be designed for transparent extraction. Use a perfectly flat chroma-key background and keep each asset separated by generous padding.

## v3 Prompt

Use case: stylized-concept
Asset type: transparent-ready 2D runtime sprite sheet for a Cocos Creator puzzle prototype
Primary request: Create a clean runtime sprite sheet for M01 "memory gear" gameplay assets: one empty gear-star body, one separate empty circular nine-slot classification tray, nine individual memory fragments, and three individual rectangular color filters.
Style: follow the primary M01 unified hand-drawn style anchor most closely: clear continuous charcoal ink contours with slight hand wobble, simple believable mechanical forms, low-saturation watercolor fills, warm handmade material inside the objects, restrained clay red / dusty blue-gray / muted ochre / gray-bronze palette.
Composition: all assets separated on one sheet with generous padding; no overlap; no labels; no UI chrome; no baked-in text; no cast shadows. Use a perfectly flat solid #00ff00 chroma-key background for later removal. The background must be one uniform color with no paper texture, gradients, lighting variation, shadows, or reflections. Do not use #00ff00 anywhere in the assets.
Gear-star body: empty center, strong readable gear-star silhouette, simple gray-bronze body, pale inner ring area, clean ink contour, minimal construction detail, no slot shapes baked into the gear body.
Nine-slot tray: a separate circular insert designed to sit inside the gear center; exactly nine empty slots in a 3x3 grid. Columns must be red / blue / yellow groups from left to right, and rows must be circle / triangle / hexagon shapes from top to bottom, matching the runtime hit targets. The grid order is: top row red circle, blue circle, yellow circle; middle row red triangle, blue triangle, yellow triangle; bottom row red hexagon, blue hexagon, yellow hexagon. Slot rings must be simple and readable at gameplay scale. Do not fill the slots with colored fragments.
Memory fragments: exactly nine separate pieces: red circle, red triangle, red hexagon, blue circle, blue triangle, blue hexagon, yellow circle, yellow triangle, yellow hexagon. Each fragment should have a clear ink contour, quiet watercolor fill, and enough padding for clean transparent cropping.
Color filters: exactly three separate rectangular filter tools, one red, one blue, one yellow. They should read as functional hand-drawn filter cartridges, not paper labels; each has a small side tab or connector, clean ink outline, and muted fill color.
Texture rule: allow soft low-contrast watercolor pooling inside objects, but avoid high-contrast white speckles, salt-and-pepper noise, distressed paint chips, random edge flecks, or dirty paper artifacts.
Avoid: dense machinery, ornate fantasy gear detail, glossy digital rendering, vector-perfect outlines, high-saturation candy colors, white speckle noise, paper background, shadows, arrows, icons, numbers, labels, text.

## Acceptance Checks

Before importing v3:

- Background is a flat removable chroma-key color, not warm paper.
- Gear, tray, all fragments, and filters are spatially separated and can be cropped without touching.
- Gear has no built-in slot shapes or fragments.
- Tray has exactly nine empty readable slots in runtime order: columns red/blue/yellow, rows circle/triangle/hexagon.
- Filters read as tools/cartridges at gameplay scale.
- Fragment colors and shapes remain distinct at gameplay scale.
- No asset relies on visible greybox underlay to be understandable.

After importing v3:

- Transparent extraction leaves alpha corners and no chroma-key fringe.
- Cocos `.png.meta` files are generated for each accepted runtime asset.
- `enableArtPreview=false` still runs the pure greybox path.
- `enableArtPreview=true` can complete the full 18-fragment drag pass with no console/page errors.
