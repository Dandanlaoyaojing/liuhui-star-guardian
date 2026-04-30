# M01 Overlap Evidence Greybox Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild M01 from the old filter/slot sorter into the new greybox prototype: a configurable pool of hidden-color candidate fragments, a freely switchable three-color flashlight, target overlap evidence, weak magnetic shape snapping, and a bottom-light whole-structure validation pass.

**Architecture:** Keep the existing Cocos greybox pipeline, `DragHandler`, `SnapZone`, ToolCard flow, and scene entry point. Replace the M01-specific domain model and layout semantics from filters/fragments/slots to flashlight/candidate fragments/evidence markers/puzzle board, so the old proven runtime shell can carry the new rules without becoming a new mini-engine.

**Tech Stack:** Cocos Creator 3.8, TypeScript strict mode, JSON puzzle config in `assets/resources/configs/stage1/`, Vitest for domain/layout/scaffold tests.

---

## Context

The authoritative spec is [game-design-spec.md](/Users/danmac/liuhui-star-guardian/docs/design/game-design-spec.md:592). M01 is no longer the old "filter + nine-slot classification" puzzle. The new design requires:

- A configurable pool of candidate fragments, default grey/transparent, hidden base color not visible. First greybox should use a manageable 12-16 candidates; do not hard-code 12 into the engine.
- Three-color flashlight: red / yellow / blue, freely switchable.
- Flashlight reveal uses storybook pigment logic:
  - red + yellow = orange
  - red + blue = purple
  - yellow + blue = green
  - same color remains itself
- A target evidence view that shows only overlap-region shape, target blend color, and relative position.
- No complete final outline, no single-fragment outline, no complete seam lines, no fragment IDs, no hidden-color hints.
- Player uses only the subset required by the target evidence graph. The final used count is derived from the union of all `solution.fragmentIds`, not from a fixed 5-6 requirement.
- Shape/edge match creates weak magnetic snap only; it does not reveal color correctness.
- The central board bottom light is off while the player assembles fragments, so fragments remain grey on the board and the board cannot be used as a real-time color tester.
- The player can click a fragment to pick it up, then click anywhere to place it. Fragments can be arranged freely in the workspace; only near a matching evidence shape should weak magnetic snap occur.
- Once the player forms candidate pairs for every target overlap evidence marker, the bottom light automatically validates the whole hypothesis.
- Wrong complete candidates flash the bottom light for about 2 seconds, briefly revealing the current colors, then go dark again. Correct candidates keep the light on and trigger repair.
- After a wrong validation, snapped fragments remain moveable. The player can click any staged fragment, pick it up, place it elsewhere, or replace the staged pair for that evidence on the next snap.
- The only tutorial affordance for the bottom light is a Machinarium-style hand-drawn note/etching: fragment pieces -> bottom light flashes -> correct stays on / wrong goes dark. Do not add a new button or explanatory UI panel.
- Victory is all overlap evidence reconstructed, not all fragments sorted.

## Current Code To Reuse

- `assets/scripts/interaction/DragHandler.ts`
- `assets/scripts/interaction/SnapZone.ts`
- `assets/scripts/interaction/FilterSystem.ts` can be repurposed or renamed later; first implementation may keep the file and expose flashlight behavior.
- `assets/scripts/cocos/M01GreyboxBootstrap.ts`
- `assets/scripts/cocos/M01GreyboxLayout.ts`
- `assets/scripts/cocos/M01GreyboxDrag.ts`
- `assets/scripts/cocos/M01GreyboxSession.ts`
- `assets/scripts/levels/stage1/M01MemoryGearController.ts`
- `assets/resources/configs/stage1/m01-memory-gear.json`

## Out Of Scope

- Final art generation.
- Replacing old runtime sprite assets.
- Reworking Stage 1 beyond M01.
- Full Cocos visual polish.
- New star-map flow.
- Cloud sync, export, or sharing.

---

## Task 1: Add M01 Color Blending Domain Rules

**Files:**
- Modify: `assets/scripts/levels/stage1/M01MemoryGearController.ts`
- Test: `tests/levels/stage1/M01MemoryGearController.test.ts`

**Step 1: Write failing tests for pigment blending**

Add tests near the M01 controller tests:

```ts
import {
  blendM01PigmentColors,
  revealM01FragmentColor
} from "../../../assets/scripts/levels/stage1/M01MemoryGearController.ts";

it("blends M01 base colors using storybook pigment rules", () => {
  expect(blendM01PigmentColors("red", "yellow")).toBe("orange");
  expect(blendM01PigmentColors("yellow", "red")).toBe("orange");
  expect(blendM01PigmentColors("red", "blue")).toBe("purple");
  expect(blendM01PigmentColors("blue", "yellow")).toBe("green");
  expect(blendM01PigmentColors("red", "red")).toBe("red");
});

it("reveals hidden fragment color under a flashlight color", () => {
  expect(revealM01FragmentColor({ hiddenColor: "blue" }, "red")).toBe("purple");
  expect(revealM01FragmentColor({ hiddenColor: "yellow" }, "blue")).toBe("green");
});
```

**Step 2: Run the targeted test to confirm red**

Run: `npm test -- tests/levels/stage1/M01MemoryGearController.test.ts`

Expected: FAIL because the exported helpers do not exist.

**Step 3: Implement minimal exported helpers**

In `M01MemoryGearController.ts`, add:

```ts
export type M01BaseColor = "red" | "yellow" | "blue";
export type M01BlendColor = M01BaseColor | "orange" | "green" | "purple";

export function blendM01PigmentColors(a: M01BaseColor, b: M01BaseColor): M01BlendColor {
  if (a === b) {
    return a;
  }

  const key = [a, b].sort().join("+");
  const blends: Record<string, M01BlendColor> = {
    "blue+red": "purple",
    "blue+yellow": "green",
    "red+yellow": "orange"
  };

  return blends[key];
}

export function revealM01FragmentColor(
  fragment: { hiddenColor: M01BaseColor },
  flashlightColor: M01BaseColor
): M01BlendColor {
  return blendM01PigmentColors(fragment.hiddenColor, flashlightColor);
}
```

**Step 4: Run targeted test**

Run: `npm test -- tests/levels/stage1/M01MemoryGearController.test.ts`

Expected: PASS for new tests, existing old tests may still pass until later tasks change the config model.

**Step 5: Commit**

```bash
git add assets/scripts/levels/stage1/M01MemoryGearController.ts tests/levels/stage1/M01MemoryGearController.test.ts
git commit -m "test: add M01 pigment blending rules"
```

---

## Task 2: Replace M01 Config Shape With Candidate Fragments And Evidence

**Files:**
- Modify: `assets/resources/configs/stage1/m01-memory-gear.json`
- Modify: `assets/scripts/levels/stage1/M01MemoryGearController.ts`
- Test: `tests/levels/stage1/M01MemoryGearController.test.ts`
- Test: `tests/core/PuzzleConfig.test.ts` if it checks goal shape

**Step 1: Write failing config tests**

Add tests:

```ts
it("loads the new M01 overlap evidence config", () => {
  expect(config.goal.type).toBe("overlap_evidence_reconstructed");
  expect(config.fragments.length).toBeGreaterThanOrEqual(12);
  expect(config.fragments.length).toBeLessThanOrEqual(16);
  expect(config.evidence.length).toBeGreaterThanOrEqual(4);
  expect(config.evidence.length).toBeLessThanOrEqual(6);
  expect(config.goal.params.requiredFragments).toBe("solution_defined");
  expect(config.goal.params.validationLightSeconds).toBe(2);
});

it("derives used fragments from the configured evidence solution graph", () => {
  const usedFragmentIds = new Set(config.evidence.flatMap((evidence) => evidence.solution.fragmentIds));

  expect(usedFragmentIds.size).toBeGreaterThan(0);
  expect(usedFragmentIds.size).toBeLessThan(config.fragments.length);
  for (const evidence of config.evidence) {
    expect(evidence.solution.fragmentIds).toHaveLength(2);
  }
});

it("includes shape-compatible color decoys without leaking target answers", () => {
  expect(config.fragments.some((fragment) => fragment.tags?.includes("decoy"))).toBe(true);
  expect(config.evidence.every((evidence) => evidence.solution.fragmentIds.length === 2)).toBe(true);
  expect(config.goal.params.requiredFragments).toBe("solution_defined");
});

it("keeps target evidence limited to overlap hints only", () => {
  for (const evidence of config.evidence) {
    expect(evidence.targetShape).toBeDefined();
    expect(evidence.targetBlendColor).toMatch(/^(orange|green|purple)$/);
    expect(evidence.fullOutline).toBeUndefined();
    expect(evidence.fragmentIds).toBeUndefined();
    expect(evidence.hiddenColorHint).toBeUndefined();
  }
});
```

**Step 2: Run targeted tests**

Run: `npm test -- tests/levels/stage1/M01MemoryGearController.test.ts`

Expected: FAIL because config still uses `filters`, `slots`, and `all_sorted`.

**Step 3: Update TypeScript interfaces**

Replace old M01-specific config fields with a backward-incompatible v2 model:

```ts
export interface M01FlashlightDef {
  id: string;
  color: M01BaseColor;
  label?: string;
  position?: { x: number; y: number };
}

export interface M01CandidateFragmentDef {
  id: string;
  hiddenColor: M01BaseColor;
  edgeShape: string;
  tags?: string[];
  position?: { x: number; y: number };
}

export interface M01OverlapEvidenceDef {
  id: string;
  targetShape: string;
  targetBlendColor: Exclude<M01BlendColor, M01BaseColor>;
  position: { x: number; y: number };
  tolerance: number;
  shapeTags: string[];
  solution: {
    fragmentIds: [string, string];
  };
}

export interface M01MemoryGearConfig extends PuzzleConfig {
  description?: string;
  colors: M01BaseColor[];
  blendColors: Exclude<M01BlendColor, M01BaseColor>[];
  flashlights: M01FlashlightDef[];
  fragments: M01CandidateFragmentDef[];
  evidence: M01OverlapEvidenceDef[];
  goal: {
    type: "overlap_evidence_reconstructed";
    params: {
      candidateFragments: "config_defined";
      recommendedCandidateRange: [12, 16];
      requiredFragments: "solution_defined";
      evidenceCount: [4, 6];
      maxLayersPerEvidence: 2;
      validationLightSeconds: 2;
      baseColors: M01BaseColor[];
      blendColors: Exclude<M01BlendColor, M01BaseColor>[];
    };
  };
  toolCard: ToolCardDraft;
  entities?: unknown[];
  repairSequence?: unknown;
}
```

**Step 4: Update JSON config**

Replace old fields with the new shape. Use deterministic IDs for the first greybox. This skeleton should be complete enough to paste as the initial fixture:

```json
{
  "id": "m01",
  "name": "记忆齿轮的卡顿",
  "stage": 1,
  "cognitiveSkill": "分类与归纳",
  "wisdomCrystal": "秩序，不在碎片本身，而在它们终于显现的关系里。",
  "description": "记忆齿轮旁漂浮着一组灰白碎片。玩家用三色手电探测隐藏本色，再从局部交叠证据反推出应使用的碎片组合。",
  "colors": ["red", "yellow", "blue"],
  "blendColors": ["orange", "green", "purple"],
  "goal": {
    "type": "overlap_evidence_reconstructed",
    "params": {
      "candidateFragments": "config_defined",
      "recommendedCandidateRange": [12, 16],
      "requiredFragments": "solution_defined",
      "evidenceCount": [4, 6],
      "maxLayersPerEvidence": 2,
      "validationLightSeconds": 2,
      "baseColors": ["red", "yellow", "blue"],
      "blendColors": ["orange", "green", "purple"]
    }
  },
  "flashlights": [
    { "id": "flashlight_red", "color": "red", "label": "红光手电", "position": { "x": -420, "y": 140 } },
    { "id": "flashlight_yellow", "color": "yellow", "label": "黄光手电", "position": { "x": -420, "y": 70 } },
    { "id": "flashlight_blue", "color": "blue", "label": "蓝光手电", "position": { "x": -420, "y": 0 } }
  ],
  "fragments": [
    { "id": "fragment_a", "hiddenColor": "red", "edgeShape": "arc_hook", "tags": ["fragment", "arc_hook"], "position": { "x": -260, "y": 170 } },
    { "id": "fragment_b", "hiddenColor": "blue", "edgeShape": "arc_socket", "tags": ["fragment", "arc_socket"], "position": { "x": -180, "y": 170 } },
    { "id": "fragment_c", "hiddenColor": "yellow", "edgeShape": "notch_hook", "tags": ["fragment", "notch_hook"], "position": { "x": -100, "y": 170 } },
    { "id": "fragment_d", "hiddenColor": "blue", "edgeShape": "notch_socket", "tags": ["fragment", "notch_socket"], "position": { "x": -20, "y": 170 } },
    { "id": "fragment_e", "hiddenColor": "red", "edgeShape": "crescent_left", "tags": ["fragment", "crescent_left"], "position": { "x": 60, "y": 170 } },
    { "id": "fragment_f", "hiddenColor": "yellow", "edgeShape": "crescent_right", "tags": ["fragment", "crescent_right"], "position": { "x": 140, "y": 170 } },
    { "id": "fragment_g", "hiddenColor": "red", "edgeShape": "branch_left", "tags": ["fragment", "branch_left"], "position": { "x": 220, "y": 170 } },
    { "id": "fragment_h", "hiddenColor": "blue", "edgeShape": "branch_right", "tags": ["fragment", "branch_right"], "position": { "x": 300, "y": 170 } },
    { "id": "fragment_i", "hiddenColor": "yellow", "edgeShape": "arc_socket", "tags": ["fragment", "arc_socket", "decoy"], "position": { "x": -220, "y": -180 } },
    { "id": "fragment_j", "hiddenColor": "red", "edgeShape": "notch_socket", "tags": ["fragment", "notch_socket", "decoy"], "position": { "x": -120, "y": -180 } },
    { "id": "fragment_k", "hiddenColor": "blue", "edgeShape": "decoy_branch", "tags": ["fragment", "decoy_branch"], "position": { "x": -20, "y": -180 } },
    { "id": "fragment_l", "hiddenColor": "yellow", "edgeShape": "decoy_crescent", "tags": ["fragment", "decoy_crescent"], "position": { "x": 80, "y": -180 } }
  ],
  "evidence": [
    {
      "id": "evidence_purple_arc",
      "targetShape": "arc_lens",
      "targetBlendColor": "purple",
      "position": { "x": -90, "y": 50 },
      "tolerance": 42,
      "shapeTags": ["arc_hook", "arc_socket"],
      "solution": { "fragmentIds": ["fragment_a", "fragment_b"] }
    },
    {
      "id": "evidence_green_notch",
      "targetShape": "notch_lens",
      "targetBlendColor": "green",
      "position": { "x": 10, "y": 72 },
      "tolerance": 42,
      "shapeTags": ["notch_hook", "notch_socket"],
      "solution": { "fragmentIds": ["fragment_c", "fragment_d"] }
    },
    {
      "id": "evidence_orange_crescent",
      "targetShape": "crescent_overlap",
      "targetBlendColor": "orange",
      "position": { "x": 92, "y": -18 },
      "tolerance": 42,
      "shapeTags": ["crescent_left", "crescent_right"],
      "solution": { "fragmentIds": ["fragment_e", "fragment_f"] }
    },
    {
      "id": "evidence_purple_branch",
      "targetShape": "branch_lens",
      "targetBlendColor": "purple",
      "position": { "x": -24, "y": -94 },
      "tolerance": 42,
      "shapeTags": ["branch_left", "branch_right"],
      "solution": { "fragmentIds": ["fragment_g", "fragment_h"] }
    }
  ],
  "toolCard": {
    "puzzleId": "m01",
    "stage": 1,
    "front": {
      "toolName": "分类与归纳",
      "scene": "stage1/m01/toolcards/classification-thumbnail",
      "wisdomCrystal": "秩序，不在碎片本身，而在它们终于显现的关系里。"
    },
    "back": {
      "coreAction": "在多维线索中找出真正起作用的分类关系。",
      "whenToUse": ["当线索混杂、单个特征不够可靠时"],
      "realLifeExamples": ["整理一组互相重叠但来源不同的记忆"],
      "commonTraps": "只按一个显眼特征分类，容易忽略关系中的第二维度。"
    }
  }
}
```

Keep each evidence as exactly two fragments, avoid triple-overlap evidence, and let the final used fragment count come from the unique IDs referenced by all evidence solutions. The first greybox uses 12 candidates, 4 evidence markers, and 8 solution fragments; the implementation must also accept a slightly larger configured candidate pool.

**Step 5: Run targeted tests**

Run: `npm test -- tests/levels/stage1/M01MemoryGearController.test.ts tests/core/PuzzleConfig.test.ts`

Expected: PASS after updating tests that asserted old `all_sorted`.

**Step 6: Commit**

```bash
git add assets/resources/configs/stage1/m01-memory-gear.json assets/scripts/levels/stage1/M01MemoryGearController.ts tests/levels/stage1/M01MemoryGearController.test.ts tests/core/PuzzleConfig.test.ts
git commit -m "feat: define M01 overlap evidence config"
```

---

## Task 3: Implement Candidate Structure And Bottom-Light Validation Controller

**Files:**
- Modify: `assets/scripts/levels/stage1/M01MemoryGearController.ts`
- Test: `tests/levels/stage1/M01MemoryGearController.test.ts`

**Step 1: Write failing controller tests**

Add tests:

```ts
const CORRECT_EVIDENCE_PAIRS: Array<[string, [string, string]]> = [
  ["evidence_purple_arc", ["fragment_a", "fragment_b"]],
  ["evidence_green_notch", ["fragment_c", "fragment_d"]],
  ["evidence_orange_crescent", ["fragment_e", "fragment_f"]],
  ["evidence_purple_branch", ["fragment_g", "fragment_h"]]
];

function stageCorrectCandidate(controller: M01MemoryGearController): void {
  for (const [evidenceId, fragmentIds] of CORRECT_EVIDENCE_PAIRS) {
    controller.stageEvidencePair(evidenceId, fragmentIds);
  }
}

function stageWrongColorCompleteCandidate(controller: M01MemoryGearController): void {
  controller.stageEvidencePair("evidence_purple_arc", ["fragment_a", "fragment_i"]);
  for (const [evidenceId, fragmentIds] of CORRECT_EVIDENCE_PAIRS.slice(1)) {
    controller.stageEvidencePair(evidenceId, fragmentIds);
  }
}

it("reveals candidate fragments without making hidden colors visible by default", () => {
  const controller = M01MemoryGearController.fromConfig(config);
  const fragment = controller.getFragmentState("fragment_a");

  expect(fragment?.hiddenColorVisible).toBe(false);
  expect(controller.revealFragmentWithFlashlight("fragment_a", "blue")).toEqual({
    accepted: true,
    fragmentId: "fragment_a",
    flashlightColor: "blue",
    revealedColor: "purple"
  });
});

it("stages a shape-compatible overlap without completing evidence immediately", () => {
  const controller = M01MemoryGearController.fromConfig(config);

  expect(controller.stageEvidencePair("evidence_purple_arc", ["fragment_a", "fragment_b"])).toMatchObject({
    accepted: true,
    evidenceId: "evidence_purple_arc",
    colorRevealed: false
  });

  expect(controller.getCompletionState().reconstructedEvidenceCount).toBe(0);
});

it("flashes the bottom light for two seconds when a complete candidate is not fully correct", () => {
  const controller = M01MemoryGearController.fromConfig(config);
  stageWrongColorCompleteCandidate(controller);

  expect(controller.validateCandidateStructure()).toMatchObject({
    accepted: false,
    reason: "wrong_blend_color",
    bottomLight: "flash_then_off",
    validationLightSeconds: 2,
    completed: false
  });
});

it("keeps the bottom light on only when all staged evidence pairs are correct", () => {
  const controller = M01MemoryGearController.fromConfig(config);
  stageCorrectCandidate(controller);

  expect(controller.validateCandidateStructure()).toMatchObject({
    accepted: true,
    bottomLight: "steady_on",
    completed: true
  });
});

it("lets a failed staged pair be replaced by a later snap", () => {
  const controller = M01MemoryGearController.fromConfig(config);

  controller.stageEvidencePair("evidence_purple_arc", ["fragment_a", "fragment_i"]);

  expect(controller.stageEvidencePair("evidence_purple_arc", ["fragment_a", "fragment_b"])).toMatchObject({
    accepted: true,
    evidenceId: "evidence_purple_arc",
    fragmentIds: ["fragment_a", "fragment_b"]
  });
});
```

**Step 2: Run targeted test**

Run: `npm test -- tests/levels/stage1/M01MemoryGearController.test.ts`

Expected: FAIL because staging and bottom-light validation methods do not exist.

**Step 3: Implement state and methods**

Add result types:

```ts
export type M01RevealResult =
  | { accepted: true; fragmentId: string; flashlightColor: M01BaseColor; revealedColor: M01BlendColor }
  | { accepted: false; reason: "invalid_fragment"; fragmentId: string };

export type M01EvidenceStageResult =
  | {
      accepted: true;
      evidenceId: string;
      fragmentIds: [string, string];
      colorRevealed: false;
    }
  | {
      accepted: false;
      reason: "invalid_evidence" | "invalid_fragment" | "wrong_shape";
      evidenceId: string;
      fragmentIds: string[];
    };

export type M01CandidateValidationResult =
  | {
      accepted: true;
      bottomLight: "steady_on";
      validationLightSeconds: null;
      completed: true;
      reconstructedEvidenceIds: string[];
    }
  | {
      accepted: false;
      reason: "incomplete_candidate" | "wrong_blend_color" | "wrong_fragment_set";
      bottomLight: "flash_then_off";
      validationLightSeconds: 2;
      completed: false;
      revealedEvidence: Array<{ evidenceId: string; actualBlendColor: M01BlendColor; expectedBlendColor: M01BlendColor }>;
    };
```

Implement controller state:

```ts
private readonly evidenceById = new Map<string, M01OverlapEvidenceDef>();
private readonly reconstructedEvidenceIds = new Set<string>();
private readonly stagedEvidencePairs = new Map<string, [string, string]>();

revealFragmentWithFlashlight(fragmentId: string, flashlightColor: M01BaseColor): M01RevealResult {
  const fragment = this.fragmentsById.get(fragmentId);
  if (!fragment) {
    return { accepted: false, reason: "invalid_fragment", fragmentId };
  }

  return {
    accepted: true,
    fragmentId,
    flashlightColor,
    revealedColor: revealM01FragmentColor(fragment, flashlightColor)
  };
}
```

Implement `stageEvidencePair` by checking shape only:

- evidence exists
- both fragments exist
- pair has both required `shapeTags`
- store the pair in `stagedEvidencePairs`
- if the evidence already has a staged pair, replace it with the new pair; do not reject merely because the evidence was previously staged
- do not reveal hidden color
- do not mark evidence reconstructed

Implement `validateCandidateStructure` by checking the complete staged hypothesis:

- all evidence markers have staged pairs
- each staged pair uses exactly two fragments
- each staged pair blends to the evidence `targetBlendColor`
- the staged unique fragment set matches the expected solution set derived from all configured `solution.fragmentIds`
- validation reason precedence is: `incomplete_candidate` first, then `wrong_blend_color`, then `wrong_fragment_set`; this keeps a complete shape-compatible but color-wrong decoy from being reported only as a set mismatch
- if anything is wrong, return `bottomLight: "flash_then_off"` and `validationLightSeconds: 2`
- on failure, leave staged pairs and fragment positions moveable so the player can pick up, move, or replace pieces directly
- if everything is correct, mark all evidence reconstructed, return `bottomLight: "steady_on"`, and allow ToolCard completion

**Step 4: Update completion and ToolCard**

`getCompletionState()` should return evidence progress:

```ts
export interface M01CompletionState {
  completed: boolean;
  reconstructedEvidenceCount: number;
  totalEvidenceCount: number;
  usedFragmentCount: number;
  bottomLight: "off" | "flash_then_off" | "steady_on";
}
```

`isComplete()` should use `reconstructedEvidenceIds.size === config.evidence.length`, and evidence IDs should only enter `reconstructedEvidenceIds` after a successful bottom-light validation.

**Step 5: Run tests**

Run: `npm test -- tests/levels/stage1/M01MemoryGearController.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add assets/scripts/levels/stage1/M01MemoryGearController.ts tests/levels/stage1/M01MemoryGearController.test.ts
git commit -m "feat: validate M01 overlap evidence structure"
```

---

## Task 4: Rebuild Greybox Layout For Flashlight And Evidence

**Files:**
- Modify: `assets/scripts/cocos/M01GreyboxLayout.ts`
- Test: `tests/cocos/M01GreyboxLayout.test.ts`

**Step 1: Write failing layout tests**

Replace old filter/slot assumptions:

```ts
it("builds flashlight, candidate fragment, evidence, and board nodes", () => {
  const layout = buildM01GreyboxLayout(config);

  expect(layout.flashlights).toHaveLength(3);
  expect(layout.fragments).toHaveLength(config.fragments.length);
  expect(layout.evidence).toHaveLength(config.evidence.length);
  expect(layout.board.kind).toBe("board");
  expect(layout.slots).toBeUndefined();
});

it("keeps candidate fragments visually hidden-color by default", () => {
  const layout = buildM01GreyboxLayout(config);
  expect(layout.fragments.every((fragment) => fragment.colorToken === "hidden")).toBe(true);
});

it("does not expose complete outline data in evidence nodes", () => {
  const layout = buildM01GreyboxLayout(config);
  for (const evidence of layout.evidence) {
    expect(evidence.tags).toContain("overlap_evidence");
    expect(evidence.tags).not.toContain("complete_outline");
  }
});
```

**Step 2: Run layout tests**

Run: `npm test -- tests/cocos/M01GreyboxLayout.test.ts`

Expected: FAIL because layout still returns `filters` and `slots`.

**Step 3: Update layout types**

Use new node kinds:

```ts
export type M01GreyboxNodeKind =
  | "gear"
  | "board"
  | "flashlight"
  | "fragment"
  | "evidence"
  | "label";

export interface M01GreyboxLayout {
  canvas: M01GreyboxSize;
  statusText: string;
  gear: M01GreyboxTokenNode;
  board: M01GreyboxTokenNode;
  flashlights: M01GreyboxTokenNode[];
  fragments: M01GreyboxTokenNode[];
  evidence: M01GreyboxTokenNode[];
}
```

Build:

- `flashlights` from `config.flashlights`
- `fragments` with `colorToken: "hidden"`
- `evidence` with `colorToken: evidence.targetBlendColor`, `shapeToken: evidence.targetShape`
- `board` at center

**Step 4: Run layout tests**

Run: `npm test -- tests/cocos/M01GreyboxLayout.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add assets/scripts/cocos/M01GreyboxLayout.ts tests/cocos/M01GreyboxLayout.test.ts
git commit -m "feat: layout M01 overlap evidence greybox"
```

---

## Task 5: Replace Drop Resolution With Weak Magnetic Evidence Snapping

**Files:**
- Modify: `assets/scripts/cocos/M01GreyboxDrag.ts`
- Test: `tests/cocos/M01GreyboxDrag.test.ts`

**Step 1: Write failing drag tests**

New resolver outcomes:

```ts
it("selects a flashlight when dropped or clicked", () => {
  const flashlight = layout.flashlights.find((item) => item.controllerId === "flashlight_red")!;

  expect(resolveM01GreyboxDrop(layout, flashlight, flashlight.position)).toEqual({
    type: "select_flashlight",
    flashlightId: "flashlight_red"
  });
});

it("weak-snaps a fragment near matching evidence shape without completing it", () => {
  const fragment = layout.fragments.find((item) => item.controllerId === "fragment_a")!;
  const evidence = layout.evidence.find((item) => item.controllerId === "evidence_purple_arc")!;

  expect(resolveM01GreyboxDrop(layout, fragment, evidence.position)).toEqual({
    type: "weak_snap_fragment",
    fragmentId: "fragment_a",
    evidenceId: "evidence_purple_arc"
  });
});

it("does not weak-snap a shape-mismatched fragment even when it is near evidence", () => {
  const fragment = layout.fragments.find((item) => item.controllerId === "fragment_k")!;
  const evidence = layout.evidence.find((item) => item.controllerId === "evidence_purple_arc")!;

  expect(resolveM01GreyboxDrop(layout, fragment, evidence.position)).toEqual({
    type: "place_fragment_freely",
    fragmentId: "fragment_k"
  });
});

it("returns a fragment to free placement when no evidence shape is nearby", () => {
  const fragment = layout.fragments.find((item) => item.controllerId === "fragment_a")!;

  expect(resolveM01GreyboxDrop(layout, fragment, { x: 420, y: -260 })).toEqual({
    type: "place_fragment_freely",
    fragmentId: "fragment_a"
  });
});
```

**Step 2: Run drag tests**

Run: `npm test -- tests/cocos/M01GreyboxDrag.test.ts`

Expected: FAIL because old actions are filter/slot oriented.

**Step 3: Update drop action union**

Replace with:

```ts
export type M01GreyboxDropAction =
  | { type: "select_flashlight"; flashlightId: string }
  | { type: "weak_snap_fragment"; fragmentId: string; evidenceId: string }
  | { type: "place_fragment_freely"; fragmentId: string; position?: M01GreyboxPoint }
  | { type: "return_to_origin"; reason: "no_zone" | "wrong_token_kind" };
```

Weak snap should use evidence bounds/tolerance from layout and require shape-tag compatibility. Proximity alone must not snap, because that would erase the shape-reasoning puzzle. It must not decide color correctness; that belongs to the session/controller after a second fragment completes an evidence pair. Free placement should preserve the clicked/dropped screen position so the player can organize fragments anywhere in the workspace.

**Step 4: Run drag tests**

Run: `npm test -- tests/cocos/M01GreyboxDrag.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add assets/scripts/cocos/M01GreyboxDrag.ts tests/cocos/M01GreyboxDrag.test.ts
git commit -m "feat: add weak magnetic evidence snapping"
```

---

## Task 6: Update Greybox Session For Flashlight, Reveal, Staging, And Bottom-Light Validation

**Files:**
- Modify: `assets/scripts/cocos/M01GreyboxSession.ts`
- Modify: `assets/scripts/cocos/M01GreyboxText.ts`
- Test: `tests/cocos/M01GreyboxSession.test.ts`

**Step 1: Write failing session tests**

Add:

```ts
const CORRECT_EVIDENCE_PAIRS: Array<[string, [string, string]]> = [
  ["evidence_purple_arc", ["fragment_a", "fragment_b"]],
  ["evidence_green_notch", ["fragment_c", "fragment_d"]],
  ["evidence_orange_crescent", ["fragment_e", "fragment_f"]],
  ["evidence_purple_branch", ["fragment_g", "fragment_h"]]
];

function submitCorrectCandidate(session: M01GreyboxSession): void {
  for (const [evidenceId, fragmentIds] of CORRECT_EVIDENCE_PAIRS) {
    session.submitEvidencePair(evidenceId, fragmentIds);
  }
}

function submitWrongColorCompleteCandidate(session: M01GreyboxSession): void {
  session.submitEvidencePair("evidence_purple_arc", ["fragment_a", "fragment_i"]);
  for (const [evidenceId, fragmentIds] of CORRECT_EVIDENCE_PAIRS.slice(1)) {
    session.submitEvidencePair(evidenceId, fragmentIds);
  }
}

it("selects a flashlight and reveals a fragment color", () => {
  const session = M01GreyboxSession.fromConfig(config);

  expect(session.selectFlashlight("flashlight_red")).toMatchObject({
    accepted: true,
    activeFlashlightColor: "red"
  });

  expect(session.revealFragment("fragment_b")).toMatchObject({
    accepted: true,
    fragmentId: "fragment_b",
    revealedColor: "purple"
  });
});

it("keeps shape-only weak snaps separate from color validation", () => {
  const session = M01GreyboxSession.fromConfig(config);

  expect(session.weakSnapFragmentToEvidence("fragment_a", "evidence_purple_arc")).toMatchObject({
    accepted: true,
    completedEvidenceCount: 0,
    bottomLight: "off"
  });
});

it("flashes bottom light when the submitted candidate is wrong", () => {
  const session = M01GreyboxSession.fromConfig(config);
  submitWrongColorCompleteCandidate(session);

  expect(session.validateCandidateStructure()).toMatchObject({
    accepted: false,
    reason: "wrong_blend_color",
    bottomLight: "flash_then_off",
    validationLightSeconds: 2,
    completed: false
  });
});

it("keeps bottom light steady only after the whole candidate structure is correct", () => {
  const session = M01GreyboxSession.fromConfig(config);
  submitCorrectCandidate(session);

  expect(session.validateCandidateStructure()).toMatchObject({
    accepted: true,
    bottomLight: "steady_on",
    completed: true
  });
});

it("supports click-pick and click-place so staged fragments can be corrected", () => {
  const session = M01GreyboxSession.fromConfig(config);

  expect(session.pickFragment("fragment_a")).toMatchObject({
    accepted: true,
    heldFragmentId: "fragment_a"
  });

  expect(session.placeHeldFragment({ x: 320, y: -180 })).toMatchObject({
    accepted: true,
    fragmentId: "fragment_a",
    placement: "free"
  });

  session.submitEvidencePair("evidence_purple_arc", ["fragment_a", "fragment_i"]);

  expect(session.submitEvidencePair("evidence_purple_arc", ["fragment_a", "fragment_b"])).toMatchObject({
    accepted: true,
    bottomLight: "off"
  });
});
```

**Step 2: Run session tests**

Run: `npm test -- tests/cocos/M01GreyboxSession.test.ts`

Expected: FAIL because methods do not exist.

**Step 3: Implement session API**

Add methods:

```ts
selectFlashlight(flashlightId: string): {
  accepted: boolean;
  activeFlashlightId?: string;
  activeFlashlightColor?: M01BaseColor;
  status: string;
}

revealFragment(fragmentId: string): {
  accepted: boolean;
  fragmentId: string;
  revealedColor?: M01BlendColor;
  status: string;
}

pickFragment(fragmentId: string): {
  accepted: boolean;
  heldFragmentId?: string;
  status: string;
}

placeHeldFragment(position: M01GreyboxPoint): {
  accepted: boolean;
  fragmentId?: string;
  placement?: "free" | "weak_snap";
  evidenceId?: string;
  status: string;
}

weakSnapFragmentToEvidence(fragmentId: string, evidenceId: string): {
  accepted: boolean;
  fragmentId: string;
  evidenceId: string;
  completedEvidenceCount: number;
  status: string;
}

submitEvidencePair(evidenceId: string, fragmentIds: [string, string]): {
  accepted: boolean;
  replacedPreviousPair?: boolean;
  reason?: string;
  completedEvidenceCount: number;
  bottomLight: "off";
  completed: false;
  status: string;
}

validateCandidateStructure(): {
  accepted: boolean;
  reason?: string;
  completedEvidenceCount: number;
  bottomLight: "flash_then_off" | "steady_on";
  validationLightSeconds: 2 | null;
  completed: boolean;
  status: string;
}
```

Update text keys:

- `flashlightSelected`
- `fragmentRevealed`
- `fragmentPickedUp`
- `fragmentPlacedFreely`
- `weakSnapHint`
- `candidateStructureReady`
- `validationLightFlash`
- `validationLightSteady`
- `evidenceCompleted`
- `evidenceRejected`
- `repairCompleted`

**Step 4: Preserve ToolCard unlock**

Only `validateCandidateStructure()` may complete the puzzle. When it returns steady-on success, call `completeRepairAndUnlockToolCard()` exactly once and expose `getLastToolCard()`.

**Step 5: Run session tests**

Run: `npm test -- tests/cocos/M01GreyboxSession.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add assets/scripts/cocos/M01GreyboxSession.ts assets/scripts/cocos/M01GreyboxText.ts tests/cocos/M01GreyboxSession.test.ts
git commit -m "feat: drive M01 bottom-light validation session"
```

---

## Task 7: Adapt Bootstrap Rendering And Input Wiring

**Files:**
- Modify: `assets/scripts/cocos/M01GreyboxBootstrap.ts`
- Modify: `assets/scripts/cocos/cc-shim.d.ts` if needed
- Test: `tests/cocosProjectScaffold.test.ts`

**Step 1: Write scaffold tests for required wiring**

Add tests that assert source contains the new paths:

```ts
it("wires M01 flashlight and evidence actions in the Cocos bootstrap", () => {
  const source = readFileSync("assets/scripts/cocos/M01GreyboxBootstrap.ts", "utf8");

  expect(source).toContain("select_flashlight");
  expect(source).toContain("weak_snap_fragment");
  expect(source).toContain("selectFlashlight");
  expect(source).toContain("revealFragment");
  expect(source).toContain("submitEvidencePair");
  expect(source).toContain("validateCandidateStructure");
  expect(source).toContain("validationLightSeconds");
});

it("does not depend on old M01 slot placement actions", () => {
  const source = readFileSync("assets/scripts/cocos/M01GreyboxBootstrap.ts", "utf8");

  expect(source).not.toContain("placeSelectedFragment");
  expect(source).not.toContain("activateFilter");
});
```

**Step 2: Run scaffold tests**

Run: `npm test -- tests/cocosProjectScaffold.test.ts`

Expected: FAIL until bootstrap is updated.

**Step 3: Update rendering responsibilities**

Bootstrap should render:

- Gear and central board.
- Three flashlight buttons/tokens.
- Config-defined grey candidate fragments.
- Evidence markers as colored local overlap hints, not complete outlines.
- A small hand-drawn note/etching near the board explaining the bottom-light validation loop without a new UI facility.
- Optional debug text showing active flashlight and revealed color.

Fragment presentation:

- Default: grey/transparent.
- Revealed: temporary tint matching `revealFragment()`.
- Weak snapped: subtle outline / low-alpha attachment line.
- Board bottom light off: fragments remain grey while arranged on the board.
- Validation flash: wrong complete candidates briefly reveal current colors, then return to grey after `validationLightSeconds`.
- Validation steady-on: correct complete candidates keep overlap markers lit in target colors.

**Step 4: Update input actions**

Map old actions to new session:

- `select_flashlight` -> `session.selectFlashlight()`
- dragging flashlight over fragment or clicking reveal affordance -> `session.revealFragment(fragmentId)`
- click a fragment while none is held -> `session.pickFragment(fragmentId)`
- click anywhere while holding a fragment -> `session.placeHeldFragment(position)`; if the position is not a valid weak snap, leave the fragment freely placed there
- `weak_snap_fragment` -> `session.weakSnapFragmentToEvidence(fragmentId, evidenceId)`
- when a second fragment is weak-snapped to the same evidence -> `session.submitEvidencePair(evidenceId, [firstId, secondId])`, replacing any previous pair for that evidence and still keeping the bottom light off
- when all evidence markers have staged pairs -> `session.validateCandidateStructure()`

Keep this simple in greybox: store the current weak-snapped fragments per evidence in a local `Map<string, string[]>`, replace the pair when the player snaps a new candidate onto the same evidence, and call validation automatically once every evidence marker has a staged pair. Do not add a button or other facility.

**Step 5: Run scaffold and typecheck**

Run: `npm test -- tests/cocosProjectScaffold.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

**Step 6: Commit**

```bash
git add assets/scripts/cocos/M01GreyboxBootstrap.ts assets/scripts/cocos/cc-shim.d.ts tests/cocosProjectScaffold.test.ts
git commit -m "feat: render M01 overlap evidence greybox"
```

---

## Task 8: Update Art Preview Contract To Stop Loading Old Slot/Filter Art By Default

**Files:**
- Modify: `assets/scripts/cocos/M01GreyboxArt.ts`
- Test: `tests/cocos/M01GreyboxArt.test.ts`

**Step 1: Write failing art tests**

Add:

```ts
it("marks existing M01 runtime art as legacy sorter calibration assets", () => {
  expect(M01_GREYBOX_ART_SOURCE_SHEET).toContain("candidate-v2");
  expect(buildM01GreyboxTokenArtPlan(buildM01GreyboxLayout(config)).tokens).toEqual([]);
});
```

Or if keeping art plan active for gear only:

```ts
expect(buildM01GreyboxTokenArtPlan(layout).tokens.every((token) => token.role !== "filter_token")).toBe(true);
```

**Step 2: Run art tests**

Run: `npm test -- tests/cocos/M01GreyboxArt.test.ts`

Expected: FAIL if old fragment/filter token plan still attaches to new fragments.

**Step 3: Update art plan**

For the new greybox:

- Keep gear art optional if harmless.
- Do not attach old red/blue/yellow shape sprites to candidate fragments, because new fragments must be hidden-color grey.
- Do not attach old filter art as gameplay filters; flashlight art is a new future asset.
- Add comments and names that these are legacy calibration assets.

**Step 4: Run art tests**

Run: `npm test -- tests/cocos/M01GreyboxArt.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add assets/scripts/cocos/M01GreyboxArt.ts tests/cocos/M01GreyboxArt.test.ts
git commit -m "chore: quarantine legacy M01 sorter art"
```

---

## Task 9: Update ToolCard And Visible Text

**Files:**
- Modify: `assets/resources/configs/stage1/m01-memory-gear.json`
- Modify: `assets/scripts/cocos/M01GreyboxText.ts`
- Test: `tests/core/ToolCard.test.ts`
- Test: `tests/ui/ToolCardView.test.ts`

**Step 1: Write failing ToolCard expectation**

Ensure M01 wisdom and card language reflect the new relation-based mechanic:

```ts
expect(config.wisdomCrystal).toBe("秩序，不在碎片本身，而在它们终于显现的关系里。");
expect(config.toolCard.front.wisdomCrystal).toBe(config.wisdomCrystal);
expect(config.toolCard.back.coreAction).toContain("关系");
```

**Step 2: Run tests**

Run: `npm test -- tests/core/ToolCard.test.ts tests/ui/ToolCardView.test.ts`

Expected: FAIL until JSON text is updated.

**Step 3: Update copy**

Recommended ToolCard back:

```json
{
  "coreAction": "从局部证据中找出能彼此成立的关系，再把相关碎片归成结构。",
  "whenToUse": [
    "面对一堆线索却不知道哪些真正相关时",
    "需要从局部证据复原整体结构时",
    "整理材料时发现单个标签不足以分类时"
  ],
  "realLifeExamples": [
    "做访谈分析时，把彼此能解释的片段归成同一主题",
    "整理创作素材时，先找能互相呼应的片段，而不是按表面颜色分堆"
  ],
  "commonTraps": "只看单个碎片的表面特征，忽略它和其他碎片放在一起时才显现的关系。"
}
```

**Step 4: Run tests**

Run: `npm test -- tests/core/ToolCard.test.ts tests/ui/ToolCardView.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add assets/resources/configs/stage1/m01-memory-gear.json assets/scripts/cocos/M01GreyboxText.ts tests/core/ToolCard.test.ts tests/ui/ToolCardView.test.ts
git commit -m "docs: update M01 tool card copy"
```

---

## Task 10: Full Verification And Manual Cocos Smoke

**Files:**
- No source changes expected unless verification finds a bug.
- Update: `production/active.md`

**Step 1: Run automated verification**

Run:

```bash
npm run typecheck
npm test
npm audit --audit-level=moderate
```

Expected:

- Typecheck passes.
- Vitest suite passes.
- `npm audit` reports 0 moderate+ vulnerabilities, or any findings are documented.

**Step 2: Run local Cocos preview smoke**

Use existing Cocos preview path if running:

- Open `http://127.0.0.1:7456/`.
- Confirm M01 scene loads.
- Select red/yellow/blue flashlight tokens.
- Reveal at least one hidden fragment with each light.
- Drag two shape-compatible fragments near one evidence marker and observe weak magnetic alignment with no color reveal.
- Stage a wrong complete candidate structure and confirm the board bottom light flashes for about 2 seconds, briefly reveals colors, then turns off and returns fragments to grey.
- Stage the correct complete candidate structure and confirm the board bottom light stays on, evidence markers light up, and ToolCard unlocks.

**Step 3: Update active state**

Add to `production/active.md`:

- New M01 overlap evidence greybox implementation status.
- Automated test evidence.
- Cocos smoke evidence, including screenshot path if taken.
- Remaining blockers: art assets for grey fragments, flashlight beam, and evidence markers.

**Step 4: Commit**

```bash
git add production/active.md
git commit -m "docs: record M01 overlap evidence verification"
```

---

## Implementation Notes

- Prefer renaming concepts in code only when the tests are already green. The first implementation can keep `FilterSystem` as the light/reveal system if that reduces churn.
- Do not delete legacy art assets in this plan. Quarantine them through plan/build functions and active notes.
- Keep the first evidence set readable: 4-6 evidence markers and about 12-16 candidate fragments. The used-fragment count is not a authored min/max; it is derived from the evidence solution graph.
- The target evidence display must never become a full answer outline. Add tests around this because future art work will be tempted to over-explain.

## Done Definition

- M01 config uses `overlap_evidence_reconstructed`.
- All old slot/filter completion behavior is gone from the active M01 code path.
- Player can freely select flashlight colors and reveal hidden fragment colors.
- Shape proximity creates weak magnetic snap.
- Shape mismatch near an evidence marker does not weak-snap.
- Click-pick / click-place lets players arrange fragments anywhere and correct failed staged pairs without a reset button.
- Fragments placed on the board remain grey while the bottom light is off.
- Wrong complete candidate structures flash the bottom light for about 2 seconds, reveal colors briefly, then return to grey.
- Correct complete candidate structures keep the bottom light on and light evidence markers.
- All evidence markers completed unlocks the M01 ToolCard once.
- `npm run typecheck`, `npm test`, and dependency audit pass or documented blockers exist.
