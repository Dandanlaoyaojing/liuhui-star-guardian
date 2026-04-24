# M01 Prototype Project Plan — 记忆齿轮的卡顿

> Date: 2026-04-24  
> Status: Drafted for implementation  
> Scope: First playable prototype for M01 only  
> Source of truth: `docs/design/game-design-spec.md` §5.2, §6.5, §七, and `production/active.md`

---

## 1. Reframe

Surface request: write the project plan for the first level.

Real task: turn M01 from a frozen design paragraph into an executable prototype plan that a coding session can follow without reopening broad design questions.

Smallest useful outcome: a plan that gets M01 to a playable greybox first, then adds the first art-calibrated slice against the four active style references.

This is a lake, not an ocean. It should not redesign Stage 1, expand M02-M10, or build the whole game shell beyond what M01 needs.

---

## 2. Objective

Build a complete M01 prototype that proves the core Stage 1 pipeline:

- data-driven `PuzzleConfig`
- drag-and-drop interaction
- color filter state
- snap-zone sorting
- double-axis classification by color and shape
- victory detection
- repair sequence
- one unlocked ToolCard
- minimal Journal / Toolkit confirmation path

M01 succeeds if the player can understand the cognitive action through play: first isolate a color, then sort visible fragments by shape, then repeat until a messy gear becomes ordered.

---

## 3. Product Decisions

### Recommended Approach

Use a two-layer delivery:

1. **Greybox playable**: simple shapes, flat colors, no final scene art. Validate rules, input, feedback, completion, and ToolCard unlock.
2. **Art-calibrated slice**: replace the core gear, fragments, filters, and card thumbnail with assets or paintovers aligned to the four active references.

This keeps the prototype honest. If the classification interaction is not fun or readable in greybox, polished art will only hide the problem.

### Alternatives Considered

**Art-first vertical slice**  
Looks closer to the final vision, but risks spending most of the first milestone on asset preparation before verifying the actual interaction.

**Full Stage 1 framework first**  
Good long-term architecture, but too broad right now. M01 needs enough reusable framework to avoid throwaway code, not a general engine for all 33 levels.

**Single hardcoded M01 scene**  
Fastest to see something move, but it violates the spec's data-driven direction and would make M02/M03 reuse harder.

---

## 4. Player Experience

The player sees a large gear-star that cannot turn because its memory fragments are mixed together. Three color filters float nearby. The player inserts a filter, the scene responds by dimming non-matching fragments, and the currently relevant pieces become easier to act on.

The main interaction is simple: use the ship's suction tool to pick up a highlighted fragment and place it into the correct slot in the central tray. Slots are organized by color and shape: red, blue, yellow crossed with circle, triangle, hexagon. Correct placement gives a small tactile snap. Wrong placement gives a gentle rejection and keeps the fragment in play.

The cognitive beat should be legible without explanation:

- filter to choose one dimension
- group by shared attributes
- notice that one pile can be sorted by more than one rule
- complete the structure by filling all nine categories

At completion, the gear turns again, the star regains a quiet glow, and the player receives the first ToolCard: **分类与归纳**.

---

## 5. In Scope

- Cocos Creator project scaffold sufficient to run one scene.
- Core TypeScript interfaces for `PuzzleConfig`, `EntityDef`, `InteractionDef`, `GoalDef`, `HintDef`, and `ToolCard`.
- M01 JSON config under a stable stage-1 path.
- Reusable interaction components:
  - `DragHandler`
  - `SnapZone`
  - `FilterSystem`
- M01-specific orchestration script only where config is not enough.
- Minimal puzzle scene UI:
  - level title
  - hint button placeholder
  - pause button placeholder
  - success flow
- Minimal ToolCard unlock data and display.
- Local progress save for M01 completion.
- Greybox visual assets.
- First art-calibrated pass for the gear-star, fragments, filters, and ToolCard thumbnail.

---

## 6. Out Of Scope

- M02-M10 implementation.
- Full star-map navigation beyond a minimal entry point into M01.
- Final animation polish.
- Final audio mix.
- Anki / PDF export.
- PNG sharing.
- Cloud sync.
- Mobile store publishing.
- WeChat Mini Game adaptation.
- Reopening the 33-level structure or Stage 5 design.

---

## 7. Implementation Work Packages

### WP0 — Project Scaffold

Goal: get the repo into a runnable Cocos Creator 3.8+ shape.

Deliverables:

- Cocos project structure.
- TypeScript strict mode baseline.
- One boot scene that loads M01 directly.
- Simple asset folder structure:
  - `assets/resources/configs/stage1/`
  - `assets/scripts/core/`
  - `assets/scripts/interaction/`
  - `assets/scripts/levels/stage1/`
  - `assets/scripts/ui/`

Acceptance:

- Project opens in Cocos Creator.
- M01 scene can be launched from editor preview.
- No design content is hardcoded into the boot layer.

### WP1 — Data Contracts

Goal: define the minimum typed contracts needed for one data-driven level.

Deliverables:

- `PuzzleConfig.ts`
- `ToolCard.ts`
- goal and hint type definitions
- runtime config loader

Acceptance:

- M01 config can be loaded and validated at scene start.
- Invalid config reports a readable error.
- ToolCard data can be constructed from config plus completion metadata.

### WP2 — M01 Config

Goal: encode M01 in JSON before building special-case logic.

Core config values:

- `id`: `m01`
- `name`: `记忆齿轮的卡顿`
- `stage`: `1`
- `cognitiveSkill`: `分类与归纳`
- `wisdomCrystal`: `秩序，是为相似之物找到归处。`
- colors: `red`, `blue`, `yellow`
- shapes: `circle`, `triangle`, `hexagon`
- fragment count: start with 18 for greybox, target 24 for tuned version
- goal: `all_sorted`
- dimensions: `color`, `shape`

Acceptance:

- Fragment data is generated from config, not duplicated in scene code.
- Slot identities are data-driven.
- Designers can change counts and colors without editing TypeScript.

### WP3 — Core Interactions

Goal: make the puzzle playable without final art.

Deliverables:

- `DragHandler`: pointer down, drag, release, cancel.
- `SnapZone`: accepts/rejects draggable entities by tag.
- `FilterSystem`: active filter state, dimming, eligibility highlighting.
- M01 controller:
  - filter insertion
  - fragment pickup enable/disable
  - placement result
  - completion check

Acceptance:

- Player can drag one of three filters into the gear slot.
- Only matching color fragments are highlighted.
- Player can drag highlighted fragments into matching slots.
- Correct slot snaps; wrong slot rejects.
- All fragments sorted triggers success once, not repeatedly.

### WP4 — Feedback, Hints, and Repair

Goal: make the prototype understandable enough to test.

Deliverables:

- correct placement feedback
- wrong placement feedback
- inactive fragment feedback
- three hint levels:
  - Level 1: relevant filter glows
  - Level 2: matching fragments pulse
  - Level 3: target slot outline appears for one held fragment
- repair sequence placeholder:
  - gear starts rotating
  - particles flow outward
  - star glow increases

Acceptance:

- A tester can recover after confusion without external explanation.
- Hints do not solve the whole puzzle at level 1.
- Repair sequence clearly marks completion.

### WP5 — ToolCard Unlock

Goal: prove "修复即提炼" with the first card.

M01 ToolCard content:

- `toolName`: `分类与归纳`
- `wisdomCrystal`: `秩序，是为相似之物找到归处。`
- `coreAction`: `在杂乱事物中找到共同属性，按属性归组。`
- `whenToUse`:
  - `整理一堆笔记不知从何下手时`
  - `需要把大量信息压缩总结时`
  - `面对多个选项想不清它们关系时`
- `realLifeExamples`:
  - `整理书架：按主题、作者或使用频率归位`
  - `做年度复盘：按项目、月份或情绪线索分组`
- `commonTraps`: `分类维度选错会制造假秩序；关键不是怎么分最漂亮，而是这次分类要服务什么目的。`

Acceptance:

- Completion unlocks exactly one M01 card.
- Card appears after repair sequence.
- Progress persists locally after refresh/restart.

### WP6 — First Art-Calibrated Slice

Goal: replace only the highest-signal greybox pieces with style-aligned art.

Use the four active references:

- `docs/design/style-references/2026-04-22-unified-handdrawn-style-anchor.png`
- `docs/design/style-references/2026-04-23-game-interface-style-reference.png`
- `docs/design/style-references/2026-04-23-game-ui-board-style-reference.png`
- `docs/design/style-references/2026-04-24-lemmy-rabbit-style-reference.png`

Art targets:

- gear-star body
- nine-slot central tray
- memory fragments
- three filters
- ToolCard thumbnail

Rules:

- clear hand-drawn ink contours
- low-saturation color
- large quiet planes
- no dense machinery
- no generic app-screen feeling
- no white speckle inside mechanical bodies

Acceptance:

- Greybox remains playable if art assets are disabled.
- Art pass improves clarity, not just atmosphere.
- Slot identities remain readable at gameplay scale.

---

## 8. Expected Files

This plan does not require exact filenames to be final, but implementation should stay close to this structure:

```text
assets/
  resources/
    configs/
      stage1/
        m01-memory-gear.json
  scripts/
    core/
      PuzzleConfig.ts
      PuzzleRuntime.ts
      GoalEvaluator.ts
      ProgressStore.ts
      ToolCard.ts
    interaction/
      DragHandler.ts
      SnapZone.ts
      FilterSystem.ts
    levels/
      stage1/
        M01MemoryGearController.ts
    ui/
      PuzzleHud.ts
      ToolCardView.ts
```

---

## 9. Tuning Parameters

Keep these configurable:

| Parameter | Greybox Start | Target Range | Purpose |
| --- | ---: | ---: | --- |
| fragment count | 18 | 18-24 | difficulty and duration |
| colors | 3 | 3 | M01 concept clarity |
| shapes | 3 | 3 | double-axis classification |
| snap radius | 36 px | 28-48 px | input forgiveness |
| wrong-slot bounce distance | 16 px | 8-24 px | correction feedback |
| hint delays | 30/60/90s | 20-120s | pacing |
| repair duration | 2.5s | 1.5-4s | completion reward |

---

## 10. Test Plan

### Automated / Scripted Checks

- Config loads and required fields exist.
- Fragment generation produces valid color/shape combinations.
- Goal evaluator returns false with unsorted fragments.
- Goal evaluator returns true only when all fragments are in matching slots.
- ToolCard data contains front and back content.

### Manual QA

- Start M01 from boot scene.
- Insert each filter and confirm matching fragments are highlighted.
- Attempt to drag a non-matching fragment and confirm feedback.
- Place a fragment in a wrong slot and confirm rejection.
- Complete all categories and confirm one success event.
- Refresh/restart and confirm M01 completion persists.
- Confirm ToolCard can be viewed after completion.

### Visual QA

- Text does not overlap HUD controls.
- Slots are readable on desktop preview and mobile aspect preview.
- Art-calibrated slice keeps linework visible at gameplay scale.
- No required information relies on color alone; shape remains readable.

---

## 11. Risks

| Risk | Why It Matters | Mitigation |
| --- | --- | --- |
| Sorting becomes busy work | Player may feel like doing inventory cleanup, not cognition | Keep count low in greybox, emphasize filter-first insight |
| Color-only filtering hides shape learning | Player may only think "sort by color" | Central tray must require shape + color |
| ToolCard feels like reward text, not a tool | Core premise weakens | Make card unlock short, concrete, and tied to the exact action played |
| Art reduces readability | Beautiful but unclear assets can bury the rules | Greybox first; compare readability before and after art |
| Reusable components overgrow | M01 becomes a framework rewrite | Build only interfaces proven by M01 and spec |

---

## 12. Milestones

### Milestone A — Greybox M01 Playable

Done when:

- M01 launches directly.
- Filters work.
- Fragments sort into slots.
- Victory triggers.
- ToolCard unlocks.
- Local completion persists.

Recommended duration: 2-4 focused implementation sessions.

### Milestone B — First Art-Calibrated Slice

Done when:

- M01's main gear, fragments, filters, tray, and card thumbnail are replaced or paintover-ready.
- Readability is equal to or better than greybox.
- Style matches the four active references.

Recommended duration: 1-2 focused art / integration sessions after Milestone A.

### Milestone C — Prototype Review Gate

Done when:

- A tester can finish M01 without external help.
- The ToolCard feels earned rather than pasted on.
- The team can decide whether to proceed to M30 or adjust the M01 pipeline first.

---

## 13. Definition Of Done

M01 is done for prototype purposes when:

- It is playable from launch to completion.
- It uses data-driven config for puzzle identity, fragments, slots, goals, hints, and ToolCard content.
- Its interaction components are reusable enough for later Stage 1 levels.
- Completion produces the wisdom crystal and M01 ToolCard.
- Local progress records completion.
- A documented QA pass confirms the interaction is understandable.
- The art direction path is clear: either greybox-only accepted for logic validation, or first art-calibrated slice approved against the four active references.

---

## 14. Next Immediate Step

Create the Cocos project scaffold and implement only the minimum runtime needed to load `m01-memory-gear.json` into a greybox M01 scene.
