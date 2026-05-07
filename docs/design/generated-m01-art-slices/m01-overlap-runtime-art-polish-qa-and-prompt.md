# M01 Overlap Runtime Art Polish QA and Prompt

> Date: 2026-05-02
> Scope: current M01 overlap-evidence runtime art direction
> Replaces: old nine-slot sorter prompt assumptions in `m01-runtime-v3-visual-qa-and-prompt.md`
> Current mechanic: handheld tricolor flashlight + hidden fragments + coherent side target pattern + central assembly plate
> Active local style reference: `docs/design/style-references/2026-04-22-unified-handdrawn-style-anchor.png`
> Active geometry reference: `docs/design/generated-m01-art-slices/m01-target-standard-piece-geometry-guide.svg`

## Purpose

This document defines the next M01 runtime-art prompt and acceptance checklist for the current "overlap evidence reconstruction" mechanic. It is not a final production-art brief. It is the first art-polish target after the playable greybox, intended to make human playtest screenshots readable while preserving the approved puzzle rules.

Do not reuse the old nine-slot sorter brief as a direct prompt. M01 no longer needs a nine-slot tray, color-filter cartridges, or red / blue / yellow visible fragment sets. It now needs shape-only hidden fragments, a separate side target diagram that reads as one coherent assembled pattern, and a quiet central assembly plate that does not reveal the final answer.

## Current Visual Contract

- **Geometry source of truth**: use `m01-target-standard-piece-geometry-guide.svg` as the hard target-reference geometry guide. Its silhouettes are not final art, but its standard-piece sizing, repeated triangle consistency, and clipped boolean overlap areas are the geometry contract for the generated / paintover target diagram.
- **Target geometry production rule**: do not ask an image generator to invent or redraw the target geometry from scratch. The target reference diagram must start from deterministic standard-piece geometry, such as the SVG guide or runtime shape templates, and may only receive hand-drawn line, watercolor material, paper texture, and frame paintover.
- **Assembly plate / empty memory gear**: a large, dim, hand-drawn gear-like repair surface in the center. It may contain faint construction marks, light scratches, and subtle snap affordance texture, but no answer outline and no colored target evidence.
- **Side target overlap evidence diagram**: a separate reference picture near the assembly plate, currently staged to the right. It must read as one complete assembled target pattern made from the same circle / triangle / hexagon fragment families the player can place. The colored two-fragment overlap clues are local relationship marks where those geometric pieces overlap, preserving their relative positions rather than appearing as scattered independent badges.
- **Hidden fragments**: 13 default candidate pieces using only circle, triangle, and hexagon silhouettes. They are grey-white / translucent by default. Hidden red / yellow / blue base colors must not be visible before flashlight observation or validation feedback.
- **Shape consistency**: circles, triangles, and hexagons in the side target must look like the same reusable fragments shown in the bottom pool, scaled together as a diagram if needed. The runtime fragment standard is one `48x48` token box per piece: circle, triangle, and hexagon all share that same box size. Triangles must use the same straight-edged runtime triangle template every time, circles must stay circular, and hexagons must stay regular six-sided polygons; hand-drawn line wobble is allowed, but warped / stretched / improvised silhouettes are not.
- **Triangle consistency**: the target diagram may contain two triangle fragments. Every triangle must be the same runtime triangle template at the same diagram scale; never draw one large triangle and one small triangle in the same target reference.
- **Flashlight tool**: one handheld flashlight tool with three selectable light buttons for red / yellow / blue. The flashlight body should be readable as a small object the player can pick up; the colored buttons live on the body as mode selectors, the beam source is the held flashlight position, and the beam visually stays on the bottom fragment floor.
- **Bottom fragment floor**: a designed low, quiet work surface where scattered fragments sit and where flashlight scanning happens. It should focus attention on bottom fragments without becoming a decorative platform.
- **Bottom-light states**: the central plate needs clear off, failed-flash, and steady-on states. Failed-flash is a short warning glow; steady-on is calm repair confirmation. Neither state should hide the placed fragment silhouettes.
- **ToolCard preview frame**: a small hand-drawn card frame for completion. It should provide a visual home for real engine text, not bake in readable generated text.

## Prompt

Use case: stylized-concept
Asset type: transparent-ready 2D runtime sprite sheet and UI-surface set for a Cocos Creator puzzle prototype

Primary request: Create a clean, separated runtime art sheet for M01 "memory gear overlap evidence" gameplay. The sheet should contain: one empty memory gear / central assembly plate, one side target overlap evidence diagram frame showing a single coherent assembled target pattern made only from overlapping circles, triangles, and hexagons with local evidence marks, thirteen hidden grey-white fragments using only circle / triangle / hexagon silhouettes, one handheld flashlight tool with three selectable light buttons colored red / yellow / blue, one bottom fragment floor surface, bottom-light state overlays for off / failed flash / steady on, and one ToolCard preview frame.

Style: follow the 2026-04-22 unified hand-drawn style anchor for this M01 pass. Use its warm off-white paper ground, clear charcoal / ink contours with slight hand wobble, simple believable gear-like machinery, low-saturation watercolor fills, grey-bronze mechanical masses, dusty clay red / muted blue-gray / soft ochre fragment colors, and large calm negative space. The image should feel like a hand-painted puzzle prop from the same world as the reference gear and small rabbit scene: tactile, quiet, functional, and slightly imperfect. Preserve line clarity above color. Do not drift into a dark cockpit, glossy sci-fi console, dense fantasy machine, or hard vector diagram.

Composition: place every asset separately with generous padding for cropping. Use either a perfectly flat transparent background or a perfectly flat solid #00ff00 chroma-key background. If using chroma key, the background must be one uniform color with no paper texture, gradients, shadows, reflections, or lighting variation, and #00ff00 must not appear inside any asset. Do not add labels, numbers, arrows, UI chrome, debug overlays, cast shadows, or baked-in readable text.

Assembly plate: create one empty central memory gear / repair plate in the same hand-painted pale-paper mechanical language as the 2026-04-22 anchor. It should be simple, warm grey-bronze, and readable at 960x640 gameplay scale. The center should be open enough for player-placed fragments. It may show faint scratches, hand-drawn circular construction lines, light watercolor pooling, tiny screw marks, soft bottom-light wash zones, and a few abstract memory-groove marks. It must not show a completed final silhouette, colored target overlaps, exact fragment slots, or an answer outline.

Side target evidence diagram: create a separate small reference picture surface, not a board overlay. It should feel like a hand-drawn inset on a pale mechanical gear board, matching the 2026-04-22 anchor. It must read first as one larger completed pattern that the player is trying to reconstruct, and that pattern must be visibly built from overlapping circle, triangle, and hexagon pieces. Keep this pattern deliberately simple: use roughly five to seven large readable geometric pieces, not a dense mosaic. All target pieces must look like duplicated instances from one consistent fragment template set: same visual scale family, same stroke weight, same pale watercolor material, same canonical geometry. Use the runtime standard-piece system as the source of truth: each circle, triangle, and hexagon occupies the same square token box and is scaled as a standard part, not resized independently. Circles are true circles, triangles are the same straight-edged runtime triangle template, and hexagons are regular six-sided polygons. Rotation is allowed; stretching, skewing, lumpy sides, irregular triangle proportions, different triangle sizes, or ad-hoc hand-shaped pieces are not allowed. If the composition uses two triangle clues, duplicate the exact same triangle template at the exact same size. Do not use torn-map, puzzle-piece, rock shard, or irregular cracked silhouettes for the target pattern. Place four to six local two-fragment overlap marks inside the geometric composition; each local mark should use the actual circle/triangle/hexagon silhouettes and a target blend color from muted orange, green, or purple. Each colored overlap region must be large enough to read at 960x640 gameplay scale, roughly a quarter to a third of the smaller piece where possible. The colored area must be clipped exactly to the true intersection between two pieces: for circle + triangle, the color is the curved triangular cap shared by both shapes; for triangle + hexagon, the color is the polygonal area inside both straight-edged shapes; for hexagon + hexagon, the color is the shared polygon formed by their overlapping edges; for hexagon + circle, the color has one circular boundary segment and hexagon-edge boundary segments. No colored spotlight, no glow halo, no colored wash across either full piece, no lens flare, no cast color, and no color outside the overlapping geometry. Preserve the relative spacing and direction between marks so the diagram feels like a single geometric object, not a grid of separate clue icons. Never depict three or more layers meeting in one target clue.

Hidden fragments: create thirteen separate default fragments. Use only three silhouette families: circle, triangle, and hexagon. Keep every default fragment cool grey / smoky pale metal-glass with charcoal outline and slight painterly variation. Some fragments may share the same silhouette, but do not reveal their hidden base color. Do not create red, yellow, or blue default fragments.

Flashlight: create one handheld flashlight tool with one body and three small selectable light buttons on the top / side: red, yellow, and blue. It should read as a single functional tool with a simple handle, lens, mode buttons, and hand-drawn contour. Use cartoon toy-like proportions: a slightly squat rounded body, oversized soft lens rim, plump button pod, friendly uneven outline, and warm storybook-watercolor material. The buttons should look pressable but integrated into the prop, not like separate floating UI pills. Create small runtime overlay decals for button highlights and lens glow: one soft lens glow, three button-selected highlight rings, and at most a short beam-mouth accent near the lens. Do not bake the full flashlight beam into an art decal; do not bake the full flashlight beam into an art decal as a long cone. The long cone / scanning area must be drawn dynamically by runtime so direction, reach, color, and floor clipping stay correct.

Bottom fragment floor: create one low horizontal floor / work surface for the bottom band of the play area. It should borrow from the 2026-04-22 anchor's thin ground line, small scattered fragments, pale paper dust, and restrained hand-drawn marks. Keep enough contrast for grey fragments to remain visible. Avoid heavy decoration; the floor exists to make scattered pieces feel physically placed and to constrain flashlight scanning visually.

Bottom-light overlays: create simple transparent-ready overlays for the assembly plate states: off / failed flash / steady on. Off should be nearly invisible; failed flash should be a short muted red-orange warning wash; steady on should be a calm warm repair glow. All overlays must preserve visibility of placed grey-white fragments.

ToolCard frame: create one completion card frame inspired by the pale hand-drawn gear reference and active game UI references. It should feel like a small watercolor paper card or simple hand-drawn instrument plaque with clean reserved zones for title, illustration, crystal sentence, and back-side notes. Do not generate readable text; use blank strips or abstract marks only.

Texture rule: hand-made feeling should come from continuous ink contours, slight line wobble, broad watercolor pooling, paper grain, and same-hue tonal variation. Use the 2026-04-22 reference image's pale ground, grey-bronze machinery, small clay / blue / ochre accents, and clear line-first construction, but keep runtime assets separated and readable. Avoid salt-like white speckles, dirty scan noise, distressed paint chips, dense ornament, glossy digital rendering, vector-perfect outlines, high-saturation candy colors, purple-dominant palettes, dark sci-fi cockpit palettes, and complex machinery.

## Acceptance Checklist

### Mechanic Accuracy

- The sheet contains no nine-slot tray, no color-filter cartridges, and no visible red / blue / yellow default fragment set.
- The assembly plate is empty and does not reveal the final-answer outline.
- The target evidence appears only as a side reference diagram, not as colored evidence baked onto the assembly plate.
- The side reference diagram reads as one coherent completed pattern, not scattered clue badges.
- The coherent target pattern is visibly built from circle / triangle / hexagon pieces, not irregular puzzle shards.
- Target circles / triangles / hexagons match the same canonical shape templates and relative sizes used by hidden fragments.
- Target circles / triangles / hexagons match the visible bottom-pool standard fragments, not just each other inside the target frame.
- Any repeated triangles are the same runtime triangle template at the same diagram size.
- The target pattern is simple enough to read quickly: a few large pieces, not a complicated cluster.
- Target evidence shows local two-fragment overlap clues inside that larger geometric pattern.
- Colored evidence appears only inside the real two-shape intersection area, with crisp clipped boundaries and no surrounding colored light.
- No target clue depicts three-layer overlap or a pile of many fragments.
- Hidden fragments use only circle / triangle / hexagon silhouettes.
- Default hidden fragments do not show hidden base colors before interaction.
- The flashlight reads as one handheld tool with three integrated red / yellow / blue selector buttons, not three separate tools and not fixed emitters.
- The flashlight glow art is limited to small runtime overlay decals for button highlights and lens glow; the full beam remains dynamic runtime graphics.
- The bottom floor clearly belongs to the fragment-scanning band.
- Bottom-light overlays are state feedback, not answer hints.

### Style And Readability

- Clear ink contours remain visible when the image is viewed at 960x640.
- The palette stays low-saturation and aligned to the 2026-04-22 anchor: warm off-white paper, grey-bronze machinery, smoky pale grey, dusty clay red, muted blue-gray, soft ochre, muted green, and restrained purple only for evidence marks.
- The central play area has enough blank space for player-placed fragments.
- Side evidence marks remain legible without labels or numbers while still belonging to one complete target pattern.
- Each colored overlap mark is visibly large enough to inspect at gameplay scale.
- Grey-white fragments are distinguishable from the bottom floor at gameplay scale.
- ToolCard frame leaves clean space for engine-rendered Chinese text.
- No baked-in readable text, numbers, arrows, debug UI, or tutorial labels.

### Extraction Readiness

- Assets are separated with enough padding for clean cropping.
- Background is either true alpha or a flat removable chroma-key color.
- If chroma-keyed, the key color is perfectly uniform and absent from assets.
- Transparent extraction leaves no colored fringe around ink lines.
- Individual sprites can be exported for: assembly plate, reference diagram frame / marks, hidden fragments, the single three-button flashlight, bottom floor, bottom-light overlays, and ToolCard frame.
- Runtime import can keep `enableArtPreview=false` as the safe greybox path until QA accepts the visual pass.

## Generated Watercolor PSD Asset Pass

- The 2026-04-22 watercolor handdrawn reference must be treated as the style reference, not as a literal crop source. Direct crops do not follow the original linework closely enough for production use.
- Current generated PSD assets live in `m01-generated-watercolor-psd-assets/`. The source sheet was generated from the reference style, then each part was isolated into an individual transparent PNG and same-name PSD.
- Current output includes 26 individual PSD part files: empty gear assembly plate, target reference card, single three-button flashlight, ToolCard frame, fragment floor, bottom-light overlays, flashlight decals, and 13 hidden grey-white fragments.
- The target reference card is a special locked-geometry asset. `parts/target_reference_card.psd` must use the approved clue-only watercolor target from `source/m01-locked-knot-target-clue-only-watercolor-imagegen-v1.*`: full circle / triangle / hexagon bodies and outlines outside the colored clues are hidden, and only colored overlap evidence plus local ink boundaries remain. Image generation may paint style around the clues but must not freely redesign, loosen, or rearrange the target pattern.
- Use these PSD files as visual-review sources for final runtime paintover / import. Do not treat vector SVG approximations as the final watercolor style.
- Any future generated replacement should preserve the same rule: reference image controls watercolor paper, pigment, broken ink, and muted palette; deterministic geometry controls circles, equilateral triangles, regular hexagons, and true overlap regions.

## Rejection Triggers

Reject the candidate if any of these are true:

- It looks like the old sorter with a nine-slot tray.
- The central plate contains the target evidence or final assembled outline.
- The side target diagram breaks into unrelated standalone clue icons instead of one complete pattern.
- The side target diagram is made of irregular cracked pieces, torn-map silhouettes, or rock shards instead of circles / triangles / hexagons.
- Target triangles are warped, uneven, non-regular, or visibly different from the triangle fragment template.
- Two target triangles appear at different sizes or proportions.
- A colored overlap mark is a decorative blob or badge rather than the actual geometric intersection of its two pieces.
- Target shape sizes feel inconsistent with the bottom fragment family instead of one scaled diagram system.
- The target diagram was generated freehand and no longer matches the deterministic SVG / runtime standard-piece geometry.
- The side target diagram becomes too complex to parse as one simple puzzle goal.
- Any overlap color appears as lighting, glow, a soft aura, or surface tint outside the exact intersection.
- The colored overlap areas are too small to see clearly.
- Default fragments are already colored red / yellow / blue.
- The target diagram gives away which fragment IDs or base colors solve the puzzle.
- Evidence marks imply a three-layer intersection.
- The sheet relies on labels or text to explain the mechanic.
- It includes a full-length flashlight beam baked into the art sheet instead of only small lens / button overlay decals.
- It becomes a dense fantasy machine instead of a simple repair surface.
- It reads as soft watercolor atmosphere with weak lines.
- It ignores the 2026-04-22 hand-drawn gear anchor and drifts into a dark cockpit / glossy sci-fi console.
- It becomes a full decorative scene instead of separated runtime puzzle assets.
- It has noisy white speckles inside mechanical color masses.
- It is not readable in a 960x640 screenshot.

## Import Notes For Task 5

- Keep generated source images under `docs/design/generated-m01-art-slices/` until accepted.
- Put accepted runtime sprites under `assets/resources/art/stage1-m01/runtime-sprites/`.
- Preserve the current greybox path as default.
- Import art behind the existing preview toggle and verify the full real-input M01 preview smoke after Cocos asset refresh.

## Runtime Correction Notes

- 2026-05-03 platform correction: do not solve the assembly platform by stretching a wide source image at runtime, and do not regress to the earlier process-cut `parts/assembly_gear_empty.png`. The current runtime direction is a square rich-color platform PNG derived from `m01-anchor-cleaned-v2-gear-empty-center-rich-color-candidate.png`; measured inner ring is about `center=(592,598), radius=328px`, exported as `1212x1212`, and displayed uniformly at `553x553`, giving an inner-ring display radius of about `150px`. This version deliberately preserves the source paper ground to avoid color-threshold alpha extraction eating the pale right-upper gear rim. If true transparency is required, create a hand-authored / PSD alpha mask instead of using automatic paper-color removal.
- 2026-05-04 flashlight cartoon correction: the current corrected source is `m01-single-flashlight-tool-runtime-fixed.png`; it keeps the single three-button flashlight composition but shifts the prop toward cartoon toy-like proportions: squat rounded body, oversized lens rim, large tactile selector buttons, and friendly hand-drawn wobble. Do not rely on runtime tint to rescue a dark flashlight.
