# M01 Art Slice Calibration Plan

> Date: 2026-04-27
> Status: Contact sheet v1 + runtime sprite sheet v2 generated; resource-backed art preview path prepared; 9 fragment + 3 filter token sprites split and wired
> Scope: M01 greybox art calibration only
> Source of truth: `docs/design/game-design-spec.md` §4, §5.2, §6.5; `docs/design/style-references/README.md`; `production/active.md`

## 1. Reframe

Surface request: start the next step after the M01 drag greybox became playable.

Real task: move from functional greybox to the smallest art-calibrated slice that can test whether the hand-drawn visual language improves clarity without hiding the puzzle logic.

Smallest useful outcome: one coherent M01 asset set for the highest-signal pieces only: gear-star body, nine-slot tray, memory fragments, three filters, and ToolCard thumbnail basis.

This remains a lake. It should not redraw all Stage 1, add Lemmy animation, build final VFX, or reopen M01 rules.

## 2. Art Targets

The first slice should produce these project-bound bitmap candidates:

| Asset | Role | Target File |
| --- | --- | --- |
| Gear-star body | Main repair object and completion-state silhouette | `assets/art/stage1-m01/m01-gear-star-slice.png` |
| Nine-slot tray | Central classification affordance | `assets/art/stage1-m01/m01-nine-slot-tray-slice.png` |
| Memory fragments | Shape/color readability test at gameplay scale | `assets/art/stage1-m01/m01-memory-fragments-slice.png` |
| Color filters | Filter insertion affordance | `assets/art/stage1-m01/m01-color-filters-slice.png` |
| ToolCard thumbnail basis | Card front scene silhouette | `assets/art/stage1-m01/m01-toolcard-thumbnail-slice.png` |

The first generated pass may be one contact sheet if that helps keep line weight and palette consistent. Final accepted assets should be split into separate PNGs before runtime integration.

Generated review candidates:

- `docs/design/generated-m01-art-slices/m01-contact-sheet-v1.png` — first AI-generated contact sheet candidate, saved for visual review and possible paintover.
- `docs/design/generated-m01-art-slices/m01-runtime-sprite-sheet-candidate-v2.png` — second AI-generated review sheet focused on runtime separation: empty gear-star body, empty nine-slot tray, individual fragments, individual filters, and ToolCard thumbnail basis.
- `docs/design/generated-m01-art-slices/m01-runtime-v3-visual-qa-and-prompt.md` — visual QA of the art-enabled Cocos preview plus the next transparent-ready runtime sprite sheet prompt.

Exported QA slices:

- `docs/design/generated-m01-art-slices/m01-gear-star-slice-candidate-v1.png`
- `docs/design/generated-m01-art-slices/m01-nine-slot-tray-slice-candidate-v1.png`
- `docs/design/generated-m01-art-slices/m01-memory-fragments-slice-candidate-v1.png`
- `docs/design/generated-m01-art-slices/m01-color-filters-slice-candidate-v1.png`
- `docs/design/generated-m01-art-slices/m01-toolcard-thumbnail-slice-candidate-v1.png`

These files are review-only candidates stored outside the Cocos `assets/` tree so they do not require Cocos `.meta` files. They still carry the warm paper background and are not yet transparent, isolated runtime sprites.

Imported runtime candidates:

- `assets/art/stage1-m01/m01-gear-star-slice.png`
- `assets/art/stage1-m01/m01-nine-slot-tray-slice.png`
- `assets/art/stage1-m01/m01-memory-fragments-slice.png`
- `assets/art/stage1-m01/m01-color-filters-slice.png`
- `assets/art/stage1-m01/m01-toolcard-thumbnail-slice.png`

Each imported candidate has a matching Cocos `.png.meta` generated after refreshing `db://assets/art/stage1-m01` through the local Cocos MCP server. These are deliberately paper-backed candidates for scale and import validation; they are not yet final transparent gameplay sprites. Because they are outside `assets/resources`, they are editor/import assets, not `resources.load` paths.

Runtime preview resource copies:

- `assets/resources/art/stage1-m01/m01-gear-star-slice.png`
- `assets/resources/art/stage1-m01/m01-nine-slot-tray-slice.png`
- `assets/resources/art/stage1-m01/m01-memory-fragments-slice.png`
- `assets/resources/art/stage1-m01/m01-color-filters-slice.png`
- `assets/resources/art/stage1-m01/m01-toolcard-thumbnail-slice.png`

These copies are Cocos dynamic-loading candidates. `M01GreyboxArt` exposes their `resources.load` sprite-frame paths, while keeping the original `assets/art/stage1-m01/` entries as editor/import catalog records.

Token-level runtime sprite candidates:

- `assets/resources/art/stage1-m01/runtime-sprites/fragments/m01-fragment-red-circle.png`
- `assets/resources/art/stage1-m01/runtime-sprites/fragments/m01-fragment-red-triangle.png`
- `assets/resources/art/stage1-m01/runtime-sprites/fragments/m01-fragment-red-hexagon.png`
- `assets/resources/art/stage1-m01/runtime-sprites/fragments/m01-fragment-blue-circle.png`
- `assets/resources/art/stage1-m01/runtime-sprites/fragments/m01-fragment-blue-triangle.png`
- `assets/resources/art/stage1-m01/runtime-sprites/fragments/m01-fragment-blue-hexagon.png`
- `assets/resources/art/stage1-m01/runtime-sprites/fragments/m01-fragment-yellow-circle.png`
- `assets/resources/art/stage1-m01/runtime-sprites/fragments/m01-fragment-yellow-triangle.png`
- `assets/resources/art/stage1-m01/runtime-sprites/fragments/m01-fragment-yellow-hexagon.png`
- `assets/resources/art/stage1-m01/runtime-sprites/filters/m01-filter-red.png`
- `assets/resources/art/stage1-m01/runtime-sprites/filters/m01-filter-blue.png`
- `assets/resources/art/stage1-m01/runtime-sprites/filters/m01-filter-yellow.png`

These files are the first move away from composite overlay calibration. `M01GreyboxArt` maps greybox fragment/filter tokens to their isolated `resources.load(.../spriteFrame)` paths, and `M01GreyboxBootstrap.enableArtPreview` attaches them as non-interactive child sprites under the draggable token nodes. The greybox nodes remain the authoritative interaction hit targets.

## 3. Style Contract

Use only the four active references, with the M01 unified hand-drawn style anchor as the primary game-style reference:

- Primary: `docs/design/style-references/2026-04-22-unified-handdrawn-style-anchor.png`
- Secondary UI/card language only: `docs/design/style-references/2026-04-23-game-interface-style-reference.png`
- Secondary UI/card language only: `docs/design/style-references/2026-04-23-game-ui-board-style-reference.png`
- Character scale and palette accent only: `docs/design/style-references/2026-04-24-lemmy-rabbit-style-reference.png`

Extract:

- continuous charcoal ink contours with slight hand wobble
- low-saturation clay red, dusty blue-gray, muted ochre, rice-gray, and gray-bronze planes
- broad clean watercolor massing inside large shapes, with soft low-contrast paper grain and watercolor pooling
- sparse, readable mechanical construction
- large quiet negative space
- panel/card language from the UI references for the ToolCard basis only

Reject:

- dense machinery, pipes, bolts, or ornate fantasy gear detail
- high-contrast white speckle noise, salt-and-pepper texture, scattered white flecks, or distressed paint chips inside mechanical bodies
- high-saturation candy colors
- polished vector outlines
- generic app-screen layouts
- baked-in readable text inside art assets
- exact copying of existing reference compositions

## 4. Prompt Pack

### Contact Sheet Prompt

Use case: stylized-concept
Asset type: game art asset contact sheet for a Cocos Creator 2D puzzle prototype
Primary request: Create a clean contact sheet of M01 "memory gear" game assets: a large gear-star body, a central nine-slot classification tray, red/blue/yellow circle/triangle/hexagon memory fragments, three rectangular color filters, and a small ToolCard thumbnail basis.
Style: follow the primary M01 unified hand-drawn style anchor most closely: minimalist hand-drawn ink line art, clear continuous charcoal contours with slight organic wobble, low-saturation watercolor fills, warm paper background, large calm planes, restrained clay red / dusty blue-gray / muted ochre / gray-bronze palette.
Composition: separated asset groups with generous padding, no overlap, no text, no labels, no UI chrome. Each piece must be readable when scaled down in gameplay.
Mechanical rule: the gear-star should feel like a simple believable repair object, not a dense machine illustration. Use clean layered gray-bronze and pale ochre watercolor masses. Soft low-contrast paper grain and natural watercolor pooling are allowed; reject high-contrast white speckle, scattered white flecks, salt-and-pepper noise, or distressed paint chips.
Gameplay clarity: colors and shapes must remain distinct; slot shapes must read clearly as circle, triangle, and hexagon.
Avoid: high saturation, glossy digital rendering, vector-perfect lines, dense machinery, high-contrast white speckle, baked-in words, icons, arrows, numbers, shadows, complex background scenes.

### ToolCard Thumbnail Prompt

Use case: stylized-concept
Asset type: small collectible card thumbnail basis
Primary request: Create a small quiet thumbnail scene for the M01 ToolCard "classification and grouping": a repaired gear-star with sorted simple fragments around it, rendered as a text-free ink-and-watercolor silhouette suitable for a card front.
Style: follow the primary M01 unified hand-drawn style anchor most closely: warm paper, charcoal ink contour, low-saturation watercolor, simple panel-ready composition, clean watercolor masses with soft paper grain but without high-contrast white speckle noise.
Composition: centered repaired gear-star, a few sorted fragments, generous blank space for later text outside the image area.
Avoid: readable text, UI labels, busy background, decorative machinery, high contrast glow, high-contrast white speckle, distressed flecks.

## 5. Acceptance Checks

Before runtime integration, inspect the candidate assets at three scales:

- full size: soft low-contrast paper grain is acceptable, but high-contrast white speckle / distressed flecks are not; no dense machinery, no baked-in text
- gameplay scale: fragment color/shape and slot identities remain readable
- ToolCard scale: thumbnail reads as "repaired ordered gear" without needing copy

Runtime integration is allowed only after:

- greybox can still run with generated art disabled
- no asset blocks dragging, slot hit testing, hints, or completion state
- Cocos preview shows no console/page errors
- completion ToolCard still fits without overlapping status or feedback

## 6. Next Implementation Step

Use the resource-backed paper candidates for gameplay-scale review in Cocos. `M01GreyboxBootstrap.enableArtPreview` is default-off and renders the five images as non-interactive calibration layers when enabled, plus isolated fragment/filter token sprites when available. Do not treat the composite layers as final gameplay replacements until the next pass decides between:

- transparent per-piece sprites for gear, tray, nine fragments, and three filters
- a sliced atlas with explicit Cocos sprite frames
- a deliberately paper-backed art overlay used only for calibration, with greybox hit targets still driving interaction

The fragment/filter pieces have now been split into transparent per-token sprites. Gear and tray are still composite candidates and should be promoted next, while keeping the resource-backed preview path explicitly separate from interaction hit targets.

Before any art-enabled runtime path is accepted, the art-disabled greybox must still complete cleanly and the art-enabled path must not block dragging, slot hit testing, hints, repair state, or ToolCard layout.

## 7. Contact Sheet v1 Notes

Generated source: `/Users/danmac/.codex/generated_images/019dccef-d4be-7df3-a512-758e1d8ca28e/ig_0d23ea6fe52de2f40169eeffa28d808191b372d2b8d987c560.png`

Workspace copy: `docs/design/generated-m01-art-slices/m01-contact-sheet-v1.png`

Visual QA:

- Strong: follows the primary M01 style anchor closely; gear-star silhouette, nine-slot tray, fragments, filters, and ToolCard thumbnail basis are clearly separated and readable.
- Strong: palette stays in the intended clay red / dusty blue-gray / muted ochre / gray-bronze range.
- Precheck: light flecks around contour edges and watercolor masses appear closer to low-contrast handmade paper / watercolor texture than high-contrast salt-and-pepper damage, but this still needs human visual QA before asset acceptance.
- Precheck: fragments and filter colors remain readable in the cropped QA slices.
- Watch: the nine-slot tray is not an empty tray asset; it is embedded in the gear-star and already contains sorted fragments.
- Blocker: cropped QA slices still include paper background and are not transparent isolated sprites; no runtime integration should happen from these files directly.

## 8. Runtime Sprite Sheet v2 Notes

Generated source: `/Users/danmac/.codex/generated_images/019dccef-d4be-7df3-a512-758e1d8ca28e/ig_0d23ea6fe52de2f40169ef0e940da8819192a559abbc9e9954.png`

Workspace copy: `docs/design/generated-m01-art-slices/m01-runtime-sprite-sheet-candidate-v2.png`

Precheck:

- Strong: solves the largest v1 asset-structure gaps by separating an empty gear-star, an empty nine-slot tray, nine individual fragments, and three filters.
- Strong: remains close to the primary M01 style anchor: calm hand-drawn contours, muted palette, simple believable mechanical forms.
- Accepted for first runtime candidate import: the gear, tray, fragment sheet, filter sheet, and ToolCard thumbnail were cropped into `assets/art/stage1-m01/` and Cocos generated real image `.png.meta` files. Matching preview copies now exist under `assets/resources/art/stage1-m01/` for `resources.load(.../spriteFrame)` calibration.
- Accepted for token-level follow-up: the transparent fragment sheet and filter sheet were further split into 9 fragment sprites and 3 filter sprites under `assets/resources/art/stage1-m01/runtime-sprites/`; Cocos generated real `.png.meta` files for each.
- Watch: still paper-backed and not transparent; final gameplay replacement likely needs per-piece transparent crops or Cocos sprite-frame slicing.
- Watch: filter tabs and fragment outlines should be checked at gameplay scale before art-enabled runtime acceptance.

## 9. Runtime Sprite Sheet v3 Direction

The token-level art preview now proves the runtime path can use isolated sprites without blocking drag/drop, hinting, repair state, or ToolCard layout. Visual QA of `temp/m01-art-preview-debug-underlay-hidden-complete.png` shows the current candidate is playable but should not become final runtime art.

The next asset generation pass should use `docs/design/generated-m01-art-slices/m01-runtime-v3-visual-qa-and-prompt.md` as the source prompt. The goal is a transparent-ready runtime sheet on a flat chroma-key background, not another warm paper contact sheet.

v3 should specifically improve:

- gear-star body: keep the v2 silhouette, but regenerate it with cleaner intentional linework, less edge noise, and an empty center designed to host the tray
- nine-slot tray: regenerate as a dedicated circular insert with exactly nine empty slot rings; columns are red/blue/yellow and rows are circle/triangle/hexagon, matching the runtime hit targets; no baked-in fragments
- filters: redraw as functional cartridges/tools, not paper-backed labels
- fragments: preserve v2 shape/color readability, but keep enough padding for clean transparent extraction

Do not replace runtime resources from v3 until alpha extraction and Cocos preview both pass.
