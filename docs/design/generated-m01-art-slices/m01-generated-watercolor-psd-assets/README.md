# Generated Watercolor PSD Assets

This directory contains generated M01 art parts. The 2026-04-22 watercolor gear image is used as a style reference, not as a crop source.

- `source/m01-watercolor-generated-source-sheet-v1.png` and `.psd`: generated source sheet on chroma-key green.
- `source/m01-locked-knot-target-reference-source.png` and `.psd`: user-approved locked knot target structure. This overrides the loose generated target card from the source sheet.
- `source/m01-locked-knot-target-watercolor-paintover-v2.png` and `.psd`: locked knot target with watercolor paper / pigment treatment applied without changing geometry.
- `source/m01-locked-knot-target-watercolor-imagegen-v1.png` and `.psd`: image-generated watercolor paintover of the locked knot target. This is the current target-card art source.
- `source/m01-locked-knot-target-clue-only-watercolor-imagegen-v1.png` and `.psd`: approved clue-only target card. Full standard-piece outlines are removed; only colored overlap clues and their local ink boundaries remain.
- `source/m01-handdrawn-flashlight-lemmy-style-v1-source.png`: generated chroma-key source for the current hand-drawn single flashlight, using the Lemmy rabbit reference as style guidance.
- `parts/flashlight_single_three_buttons-lemmy-pink-v3.png`: review export for the earlier pink hand-drawn flashlight colorway.
- `parts/flashlight_single_three_buttons.png`: current production-sized export, selected from `../m01-flashlight-round-lines-hard-palette-v1/m01-flashlight-round-lines-hard-palette-v1-c-rice-gray-rim.png`.
- `../m01-fragment-porcelain-watercolor-contact-20260504.png`: current review sheet for the runtime fragment material pass. The accepted direction is one consistent pale grey-white ceramic tile tone across all puzzle pieces, with low-contrast watercolor bloom, soft graphite contour wobble, and hairline crackle; avoid returning to thick red / blue / yellow body fills or separate warm / cool undertones by hidden color.
- `parts/*.png`: transparent review exports after chroma-key removal.
- `parts/*.psd`: one PSD file per individual part.
- `m01-generated-watercolor-parts-contact-sheet-v4-clue-only-target.png` and `.psd`: current approved review contact sheet with the clue-only watercolor target card.
- `m01-generated-watercolor-parts-contact-sheet-v3-imagegen-target.png` and `.psd`: current review contact sheet with the image-generated watercolor target card. Use this versioned path to avoid stale preview caching.
- `m01-generated-watercolor-parts-contact-sheet-v2-locked-target-watercolor.png` and `.psd`: current review contact sheet. Use this versioned path to avoid stale preview caching.
- `m01-generated-watercolor-parts-contact-sheet.png` and `.psd`: legacy overwritten review contact sheet; prefer the v2 locked-target file above.

Current output contains 26 individual PSD part files:

- `assembly_gear_empty.psd`
- `target_reference_card.psd`
- `flashlight_single_three_buttons.psd`
- `toolcard_frame_blank.psd`
- `fragment_floor_strip.psd`
- `bottom_light_off_overlay.psd`
- `bottom_light_failed_flash_overlay.psd`
- `bottom_light_steady_on_overlay.psd`
- `flashlight_decal_lens_glow.psd`
- `flashlight_decal_button_red.psd`
- `flashlight_decal_button_yellow.psd`
- `flashlight_decal_button_blue.psd`
- `flashlight_decal_beam_mouth.psd`
- `hidden_fragment_01_circle.psd`
- `hidden_fragment_02_triangle.psd`
- `hidden_fragment_03_hexagon.psd`
- `hidden_fragment_04_circle.psd`
- `hidden_fragment_05_triangle.psd`
- `hidden_fragment_06_hexagon.psd`
- `hidden_fragment_07_circle.psd`
- `hidden_fragment_08_triangle.psd`
- `hidden_fragment_09_hexagon.psd`
- `hidden_fragment_10_circle.psd`
- `hidden_fragment_11_triangle.psd`
- `hidden_fragment_12_hexagon.psd`
- `hidden_fragment_13_circle.psd`

These PSDs are visual-review sources. They are not yet imported as Cocos runtime spriteFrames.

Target-card rule: `parts/target_reference_card.psd` must use `source/m01-locked-knot-target-clue-only-watercolor-imagegen-v1.*`: keep the locked clue positions and watercolor treatment, but hide the full circle / triangle / hexagon outlines and bodies outside the colored overlap evidence. Do not use image generation to freely redesign or rearrange this target pattern.
