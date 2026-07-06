# Style References

## Active Art-Direction Rule

Use the four global references below as the general project baseline:

1. `2026-04-22-unified-handdrawn-style-anchor.png`
2. `2026-04-23-game-interface-style-reference.png`
3. `2026-04-23-game-ui-board-style-reference.png`
4. `2026-05-28-lemmy-rabbit-canonical.png` (the canonical Lemmy identity — hand-added paws, clean, 2000×2000 transparent; 2026-05-29 final). **2026-06-07 split:** the in-game *animation* identity is now its pencil-outlined derivative `lemmy-rabbit-canonical-pencil.png`; this clean version was renamed `lemmy-rabbit-trademark-master.png` for brand/商标 use — see the dedicated section below.

M01 also has one local runtime-art reference for the current cockpit/control-console pass:

5. `2026-05-02-console-cockpit-style-reference.png` — active for M01 runtime art generation and paintover only, not a blanket replacement for every stage.

The 2026-04-23 interface and board references are now intentionally part of this game's art direction. Treat them as game interface references, not as external tool screens. They define the current target for game panels, cards, menus, journals, puzzle boards, and repair surfaces.

The 2026-05-28 Lemmy canonical reference is the single active character-shape reference for Lemmy. Use it to keep the protagonist small, hand-drawn, vulnerable, and visually unified with the low-saturation red / blue-gray palette. All earlier Lemmy art (the 2026-04-24 paper-backed thumbnail, no-hands drafts, noisy drafts) has been deleted — this canonical is the only source.

Generated Stage 1 scene images (`M02-M10`, and any earlier `M01-M10` batch language) are backup concepts only. They may inform level metaphors and prompt wording, but future production art should be regenerated or repainted against the active references above.

## 2026-05-02 Console Cockpit Style Reference

- Reference image: [2026-05-02-console-cockpit-style-reference.png](2026-05-02-console-cockpit-style-reference.png)
- Asset copy: `assets/art/style-references/console-cockpit-style-reference.png`
- Status: active local reference for the M01 runtime-art generation / paintover pass
- Scope: M01 control-console mood, dark old-metal panel rendering, brass linework, night-window atmosphere, and deep blue-gray / ochre value structure

### Extract These Traits

- Dark blue-gray negative space with soft cloudy atmospheric depth.
- Old bronze / graphite metal panels with confident hand-drawn outlines.
- Subtle screw heads, rings, panel seams, and curved cockpit framing.
- Warm ochre edge highlights against a restrained dark palette.
- Clear empty zones that can hold gameplay pieces without baked-in labels.

### Do Not Overfit These Traits

- Do not turn M01 into a full-screen cockpit background that hides the puzzle.
- Do not bake stars, clouds, or decorative window scenery into every runtime sprite.
- Do not add readable text, UI labels, or fixed button icons into generated art.
- Do not make the target pattern a decorative dashboard panel; it must still serve the M01 overlap-reconstruction mechanic.
- Do not replace Lemmy or future stage references with this local M01 mood unless the operator explicitly expands the style direction.

## Lemmy Canonical (Active Identity Source) — 2026-06-07 split: outlined vs clean

As of 2026-06-07 there are TWO Lemmy masters (same rabbit, different edge treatment):

**A. Game / animation identity — pencil-outlined (outline BAKED IN)**
- Asset: `assets/art/style-references/lemmy-rabbit-canonical-pencil.png` (2000×2000 RGBA, transparent, W5 pencil outline baked in).
- Locked by `LEMMY_APPROVED_IDENTITY_SOURCE` in `assets/scripts/cocos/LemmyActorContract.ts`.
- **Single identity source for all in-game Lemmy animation.** Feed THIS into 即梦 for new motion; generated frames no longer get a per-frame pencil pass (`scripts/lemmy-pencil-outline.py`) — the outline is already in the input. 即梦 gen first frame = `assets/art/characters/lemmy/source-videos/lemmy-firstframe-pencil-white.png` (white-bg twin).

**B. Trademark / logo master — clean (NO outline)**
- Asset: `assets/art/style-references/lemmy-rabbit-trademark-master.png` (2000×2000 RGBA, transparent, clean W1; renamed 2026-06-07 from `lemmy-rabbit-canonical.png`).
- Locked by `LEMMY_CLEAN_MASTER_PATH`. **Brand / logo / 商标 use only — NOT in the game animation pipeline.**
- Dated clean lineage archive: [2026-05-28-lemmy-rabbit-canonical.png](2026-05-28-lemmy-rabbit-canonical.png).

Both share Lemmy proportions, silhouette, face scale, red / blue-gray tinting, and hand-drawn line quality. 2026-05-29 decision still holds — this hand-added-paws, clean, 2000×2000 transparent rabbit is the ONLY approved Lemmy prototype; all earlier versions (2026-04-24 thumbnail, no-hands drafts, noisy drafts, Luma rabbit variants, turnaround sketches) are deleted — do not reference or recreate them.

### Extract These Traits

- Very small dark eye, simple head shape, and long uneven ears.
- Thin charcoal ink contours with slight wobble and hand-made asymmetry.
- Red and blue-gray watercolor blocks that stay inside a restrained palette.
- Slender, vulnerable body proportion that reads as a symbolic traveler rather than a cute mascot.
- Sparse whisker / limb marks that suggest character without over-rendering.

### Do Not Overfit These Traits

- Do not copy the exact pose for every appearance.
- Do not turn Lemmy into a plush toy, chibi mascot, or high-saturation cartoon character.
- Do not add facial detail, glossy eyes, clothing, or expression systems unless a scene specifically needs them.
- Do not make the character linework cleaner than the machinery; the whole world should share the same hand-drawn language.

## 2026-04-23 Game Interface Style References

- Game interface reference: [2026-04-23-game-interface-style-reference.png](2026-04-23-game-interface-style-reference.png)
- Game UI board reference: [2026-04-23-game-ui-board-style-reference.png](2026-04-23-game-ui-board-style-reference.png)
- Asset copies:
  - `assets/art/style-references/game-interface-style-reference.png`
  - `assets/art/style-references/game-ui-board-style-reference.png`
- Status: active primary references for in-game UI, panel design, tool cards, menus, puzzle boards, and future game interface assets

### Why these references were added

These two references are not a replacement for the M01 unified hand-drawn style anchor below or the Lemmy rabbit reference above. Together, the four active references form the current style baseline. The interface references extend the M01 language into **game interface and panel surfaces**:

- richer warm paper tone without becoming high-saturation
- deeper blue-gray sky windows with clear cloud separation
- visible, confident hand-drawn ink lines on panels, controls, cards, and frames
- low-saturation terracotta / ochre / brass accents that support the linework
- text-free composition with clear placeholder zones, so real copy can be layered later
- simplified but believable game UI modules rather than decorative machinery

### Use Them For

- in-game menus and tool cards
- puzzle selection screens
- puzzle panels and repair interfaces
- journal / collection interfaces
- empty states and onboarding screens
- prompt-writing when a generated image starts drifting too pale, too clean, or too text-heavy

### Do Not Overfit These Traits

- Do not import non-game product labels or baked-in text into final assets.
- Do not make every game scene look like a generic app interface; translate the panel language into game-world repair surfaces.
- Do not copy the exact five-panel layout unless the asset is actually a menu or puzzle panel.
- Do not use the sky-window motif everywhere; use it only when it supports the scene.
- Do not smooth the linework into polished vector UI.

## 2026-04-22 Unified Hand-Drawn Style Anchor

- Reference image: [2026-04-22-unified-handdrawn-style-anchor.png](2026-04-22-unified-handdrawn-style-anchor.png)
- Asset copy: `assets/art/style-references/unified-handdrawn-style-anchor.png`
- Status: active global art-direction anchor
- Scope: character, puzzle devices, spaceship, UI, prompt writing, asset review

### Why this image is the anchor

- It matches the new art direction better than the old "watercolor character vs ink world" split.
- It holds the line-first rule: objects still read clearly without relying on color mass.
- It keeps the machinery understandable and stripped down instead of becoming decorative illustration.
- It uses blank space as a design decision, not as unfinished background.
- It preserves a small, vulnerable rabbit against a large but readable mechanism.

### Extract These Traits

- Clear hand-drawn ink contours with slight wobble and thickness variation
- Restrained low-saturation color on top of the linework, not instead of it
- Simple believable mechanical structure with very few parts
- Large blank paper-like breathing room
- Warm gray, clay, dusty blue, muted ochre palette
- Mechanical color depth should come from a few large tonal families inside the same gray-bronze base, not from scattered colorful accents

### Mechanical Tonal Rule

For large mechanical bodies, use layered gray-bronze depth like the M01 anchor image:

- deepest layer: olive-gray, cooler dark gray-bronze
- middle layer: warm gray-bronze, old brass feeling
- brighter layer: rice-gray, pale ochre, washed lighter planes

These relationships must read as broad watercolor massing and tonal undulation:

- use large calm shifts in value
- use overlapping washes in the same hue family
- use edge softness and pooled watercolor variation

Do not fake depth with:

- tiny broken textures
- confetti-like accent colors
- many small dots
- dirty speckle or faux weathering

### Hard Rendering Rule

These are hard constraints for future image generation and review:

- Mechanical bodies, bases, and stairs must not contain white speckle noise or salt-like white particles inside the painted areas.
- Only a very small amount of paper-colored blankness may remain in the background atmosphere; it must not appear as white flecks inside the main mechanical color masses.
- Hand-drawn feeling must come from continuous ink contours plus same-hue watercolor layering.
- Ink lines should be mostly continuous strokes with organic thick-thin variation and slight ink-density shifts.
- Hand-drawn line quality must not be simulated through dotted fragmentation, short broken mini-strokes, or scan-like edge noise.
- Watercolor character must come from broad overlapping washes, tonal pooling, and soft transitions inside large shapes, not from white grain or broken texture.

### Reusable Image Prompt

Use this prompt skeleton for simple puzzle devices, doors, hatches, platform inserts, and other low-detail mechanical props. Replace only the target object sentence.

```text
Create a simpler, rougher hand-painted watercolor version of [TARGET_OBJECT]. Keep the structure: [TARGET_STRUCTURE]. Match this style: children's 2D watercolor game platform, warm muted olive-bronze and parchment colors, uneven pencil/ink outline, visible paper texture, soft watercolor stains and blotches, imperfect hand-drawn edges. Make it much less detailed and less polished than a mechanical illustration: no ornate gears, no crisp 3D metal, no glossy highlights, no tiny precision parts. Only a few rough guide lines and maybe two or four very simple rivet dots. It should look like it belongs inside a rough hand-drawn watercolor gear platform, simple and asset-friendly. Plain off-white background, centered, full object visible, no text, no UI, no character, no perspective.
```

Accepted M01 center-door instance:

```text
Create a simpler, rougher hand-painted watercolor version of the same closed circular sliding door concept. Keep the structure: a flat round center hatch seen from directly above, two left-right sliding panels closed together with one vertical seam in the middle. Match this style: children's 2D watercolor game platform, warm muted olive-bronze and parchment colors, uneven pencil/ink outline, visible paper texture, soft watercolor stains and blotches, imperfect hand-drawn edges. Make it much less detailed and less polished than a mechanical illustration: no ornate gears, no crisp 3D metal, no glossy highlights, no tiny precision parts. Only a few rough curved guide lines and maybe two or four very simple rivet dots. It should look like it belongs inside a rough hand-drawn watercolor gear platform, simple and asset-friendly. Plain off-white background, centered, full object visible, no text, no UI, no character, no perspective, no door opening.
```

### White Speckle Cleanup Method

When an otherwise useful reference or runtime candidate has salt-like white flecks inside painted objects, do not smooth or regenerate the whole image. Use a localized same-hue fill:

- detect only small high-luma, low-saturation flecks that are brighter than nearby watercolor
- fill them with nearby same-hue watercolor colors, biased slightly darker than the local median
- preserve the original ink contours, broad tonal pooling, uneven brush marks, and paper background
- do not blur, airbrush, flatten, or globally denoise the asset

The accepted M01 cleanup example is `2026-04-22-unified-handdrawn-style-anchor-cleaned-v2.png`. Use that method for future reference-image cleanup unless a human reviewer asks for a different treatment.

### Do Not Overfit These Traits

- Do not copy the exact gear silhouette or exact puzzle layout as a template for every level.
- Do not overuse paper grain, dirt, or "aged illustration" effects.
- Do not blur the image into a soft watercolor mood piece.
- Do not increase part count until the machine becomes a dense mechanical illustration.
- Do not fill the background just because the canvas feels empty.
