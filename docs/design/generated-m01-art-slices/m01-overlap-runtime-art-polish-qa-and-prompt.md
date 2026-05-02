# M01 Overlap Runtime Art Polish QA and Prompt

> Date: 2026-05-02
> Scope: current M01 overlap-evidence runtime art direction
> Replaces: old nine-slot sorter prompt assumptions in `m01-runtime-v3-visual-qa-and-prompt.md`
> Current mechanic: handheld tricolor flashlight + hidden fragments + coherent side target pattern + central assembly plate
> Active local style reference: `docs/design/style-references/2026-05-02-console-cockpit-style-reference.png`

## Purpose

This document defines the next M01 runtime-art prompt and acceptance checklist for the current "overlap evidence reconstruction" mechanic. It is not a final production-art brief. It is the first art-polish target after the playable greybox, intended to make human playtest screenshots readable while preserving the approved puzzle rules.

Do not reuse the old nine-slot sorter brief as a direct prompt. M01 no longer needs a nine-slot tray, color-filter cartridges, or red / blue / yellow visible fragment sets. It now needs shape-only hidden fragments, a separate side target diagram that reads as one coherent assembled pattern, and a quiet central assembly plate that does not reveal the final answer.

## Current Visual Contract

- **Assembly plate / empty memory gear**: a large, dim, hand-drawn gear-like repair surface in the center. It may contain faint construction marks, light scratches, and subtle snap affordance texture, but no answer outline and no colored target evidence.
- **Side target overlap evidence diagram**: a separate reference picture near the assembly plate, currently staged to the right. It must read as one complete assembled target pattern. The colored two-fragment overlap clues are local relationship marks inside that larger pattern, preserving their relative positions rather than appearing as scattered independent badges.
- **Hidden fragments**: 13 default candidate pieces using only circle, triangle, and hexagon silhouettes. They are grey-white / translucent by default. Hidden red / yellow / blue base colors must not be visible before flashlight observation or validation feedback.
- **Flashlight tools**: three physical handheld tools for red / yellow / blue light. They are not fixed UI buttons. The flashlight body should be readable as a small object the player can pick up; the beam source is the held flashlight position, and the beam visually stays on the bottom fragment floor.
- **Bottom fragment floor**: a designed low, quiet work surface where scattered fragments sit and where flashlight scanning happens. It should focus attention on bottom fragments without becoming a decorative platform.
- **Bottom-light states**: the central plate needs clear off, failed-flash, and steady-on states. Failed-flash is a short warning glow; steady-on is calm repair confirmation. Neither state should hide the placed fragment silhouettes.
- **ToolCard preview frame**: a small hand-drawn card frame for completion. It should provide a visual home for real engine text, not bake in readable generated text.

## Prompt

Use case: stylized-concept
Asset type: transparent-ready 2D runtime sprite sheet and UI-surface set for a Cocos Creator puzzle prototype

Primary request: Create a clean, separated runtime art sheet for M01 "memory gear overlap evidence" gameplay. The sheet should contain: one empty memory gear / central assembly plate, one side target overlap evidence diagram frame showing a single coherent assembled target pattern with local evidence marks, thirteen hidden grey-white fragments using only circle / triangle / hexagon silhouettes, three handheld flashlight tools colored red / yellow / blue, one bottom fragment floor surface, bottom-light state overlays for off / failed flash / steady on, and one ToolCard preview frame.

Style: follow the provided 2026-05-02 console cockpit reference for this M01 pass. Use its dark blue-gray night-window atmosphere, old graphite / bronze metal, warm ochre edge highlights, curved cockpit framing, screw heads, panel seams, and textured painterly clouds as the mood anchor. Preserve the project hand-drawn line quality: visible charcoal / ink contours with slight wobble, low-saturation color, readable shapes, and no glossy vector polish. Compared with the earlier pale paper direction, this pass should feel darker, more mechanical, and more like a quiet starship console while still leaving clean gameplay space.

Composition: place every asset separately with generous padding for cropping. Use either a perfectly flat transparent background or a perfectly flat solid #00ff00 chroma-key background. If using chroma key, the background must be one uniform color with no paper texture, gradients, shadows, reflections, or lighting variation, and #00ff00 must not appear inside any asset. Do not add labels, numbers, arrows, UI chrome, debug overlays, cast shadows, or baked-in readable text.

Assembly plate: create one empty central memory gear / repair plate as an old bronze / graphite console instrument. It should be dim, simple, and readable at 960x640 gameplay scale. The center should be open enough for player-placed fragments. It may show faint scratches, curved metal seams, small screw heads, soft bottom-light wash zones, and a few abstract memory-groove marks. It must not show a completed final silhouette, colored target overlaps, exact fragment slots, or an answer outline.

Side target evidence diagram: create a separate small reference picture surface, not a board overlay. It should feel like a small cockpit instrument / inset diagram mounted near the assembly plate. It must read first as one larger completed pattern that the player is trying to reconstruct, with four to six local two-fragment overlap marks placed within that same overall silhouette. Each local mark should still use only a partial overlap silhouette and a target blend color from muted orange, green, or purple. Preserve the relative spacing and direction between marks so the diagram feels like a single object, not a grid of separate clue icons. Never depict three or more layers meeting in one target clue.

Hidden fragments: create thirteen separate default fragments. Use only three silhouette families: circle, triangle, and hexagon. Keep every default fragment cool grey / smoky pale metal-glass with charcoal outline and slight painterly variation. Some fragments may share the same silhouette, but do not reveal their hidden base color. Do not create red, yellow, or blue default fragments.

Flashlights: create three handheld flashlight tools, one red, one yellow, one blue. They should read as small functional tools with a simple handle, lens, and hand-drawn contour. They should not look like flat UI buttons or fixed emitters. Include optional small beam-start accents, but do not bake large beams into the tool sprites.

Bottom fragment floor: create one low horizontal floor / work surface for the bottom band of the play area. It should borrow from the reference image's dark metal console shelf: old graphite panels, warm bronze seams, subtle screws, and soft worn edges. Keep enough contrast for grey fragments to remain visible. Avoid heavy decoration; the floor exists to make scattered pieces feel physically placed and to constrain flashlight scanning visually.

Bottom-light overlays: create simple transparent-ready overlays for the assembly plate states: off / failed flash / steady on. Off should be nearly invisible; failed flash should be a short muted red-orange warning wash; steady on should be a calm warm repair glow. All overlays must preserve visibility of placed grey-white fragments.

ToolCard frame: create one completion card frame inspired by the console reference and active game UI references. It should feel like a small brass-rimmed console card or instrument plaque with dark graphite backing, warm ochre edge light, and clean reserved zones for title, illustration, crystal sentence, and back-side notes. Do not generate readable text; use blank strips or abstract marks only.

Texture rule: hand-made feeling should come from continuous ink contours, slight line wobble, broad painterly pooling, and same-hue tonal variation. Use the reference image's dark textured metal and cloudy sky value structure, but keep runtime assets separated and readable. Avoid salt-like white speckles, dirty scan noise, distressed paint chips, dense ornament, glossy digital rendering, vector-perfect outlines, high-saturation candy colors, purple-dominant palettes, and complex machinery.

## Acceptance Checklist

### Mechanic Accuracy

- The sheet contains no nine-slot tray, no color-filter cartridges, and no visible red / blue / yellow default fragment set.
- The assembly plate is empty and does not reveal the final-answer outline.
- The target evidence appears only as a side reference diagram, not as colored evidence baked onto the assembly plate.
- The side reference diagram reads as one coherent completed pattern, not scattered clue badges.
- Target evidence shows local two-fragment overlap clues inside that larger pattern.
- No target clue depicts three-layer overlap or a pile of many fragments.
- Hidden fragments use only circle / triangle / hexagon silhouettes.
- Default hidden fragments do not show hidden base colors before interaction.
- Flashlights read as handheld tools, not fixed selector buttons.
- The bottom floor clearly belongs to the fragment-scanning band.
- Bottom-light overlays are state feedback, not answer hints.

### Style And Readability

- Clear ink contours remain visible when the image is viewed at 960x640.
- The palette stays low-saturation and dark-console aligned: deep blue-gray, graphite, old bronze, muted ochre, smoky pale grey, clay red accents, muted green, and restrained purple only for evidence marks.
- The central play area has enough blank space for player-placed fragments.
- Side evidence marks remain legible without labels or numbers while still belonging to one complete target pattern.
- Grey-white fragments are distinguishable from the bottom floor at gameplay scale.
- ToolCard frame leaves clean space for engine-rendered Chinese text.
- No baked-in readable text, numbers, arrows, debug UI, or tutorial labels.

### Extraction Readiness

- Assets are separated with enough padding for clean cropping.
- Background is either true alpha or a flat removable chroma-key color.
- If chroma-keyed, the key color is perfectly uniform and absent from assets.
- Transparent extraction leaves no colored fringe around ink lines.
- Individual sprites can be exported for: assembly plate, reference diagram frame / marks, hidden fragments, flashlights, bottom floor, bottom-light overlays, and ToolCard frame.
- Runtime import can keep `enableArtPreview=false` as the safe greybox path until QA accepts the visual pass.

## Rejection Triggers

Reject the candidate if any of these are true:

- It looks like the old sorter with a nine-slot tray.
- The central plate contains the target evidence or final assembled outline.
- The side target diagram breaks into unrelated standalone clue icons instead of one complete pattern.
- Default fragments are already colored red / yellow / blue.
- The target diagram gives away which fragment IDs or base colors solve the puzzle.
- Evidence marks imply a three-layer intersection.
- The sheet relies on labels or text to explain the mechanic.
- It becomes a dense fantasy machine instead of a simple repair surface.
- It reads as soft watercolor atmosphere with weak lines.
- It ignores the 2026-05-02 console cockpit reference and drifts back to a pale paper UI.
- It becomes a full decorative cockpit scene instead of separated runtime puzzle assets.
- It has noisy white speckles inside mechanical color masses.
- It is not readable in a 960x640 screenshot.

## Import Notes For Task 5

- Keep generated source images under `docs/design/generated-m01-art-slices/` until accepted.
- Put accepted runtime sprites under `assets/resources/art/stage1-m01/runtime-sprites/`.
- Preserve the current greybox path as default.
- Import art behind the existing preview toggle and verify the full real-input M01 preview smoke after Cocos asset refresh.
