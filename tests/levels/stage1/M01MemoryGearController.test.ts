import { describe, expect, it } from "vitest";
import {
  M01MemoryGearController,
  blendM01PigmentColors,
  revealM01FragmentColor,
  type M01MemoryGearConfig
} from "../../../assets/scripts/levels/stage1/M01MemoryGearController.ts";
import { createMemoryStorage, createProgressStore } from "../../../assets/scripts/core/ProgressStore.ts";
import { validateToolCard } from "../../../assets/scripts/core/ToolCard.ts";
import m01ConfigJson from "../../../assets/resources/configs/stage1/m01-memory-gear.json" with { type: "json" };

const colors = ["red", "blue", "yellow"] as const;
const shapes = ["circle", "triangle", "hexagon"] as const;
const realM01Config = m01ConfigJson as any;

function makeConfig(): M01MemoryGearConfig {
  const fragments = colors.flatMap((color) =>
    shapes.flatMap((shape) =>
      [1, 2].map((copy) => ({
        id: `fragment_${color}_${shape}_${copy}`,
        color,
        shape
      }))
    )
  );

  return {
    id: "m01",
    name: "记忆齿轮的卡顿",
    stage: 1,
    cognitiveSkill: "分类与归纳",
    wisdomCrystal: "秩序，是为相似之物找到归处。",
    filters: colors.map((color) => ({
      id: `filter_${color}`,
      color
    })),
    fragments,
    slots: colors.flatMap((color) =>
      shapes.map((shape) => ({
        id: `slot_${color}_${shape}`,
        accepts: { color, shape },
        capacity: 2
      }))
    ),
    goal: {
      type: "all_sorted",
      params: {
        dimensions: ["color", "shape"],
        colors: [...colors],
        shapes: [...shapes]
      }
    },
    scene: {
      background: "stage1/m01/background-greybox",
      ambientAudio: "audio/ambient/stage1-memory-gear",
      camera: { position: { x: 0, y: 0 }, zoom: 1 },
      entities: [
        {
          id: "entity_memory_gear",
          type: "animated",
          sprite: "stage1/m01/gear-star-dim",
          position: { x: 0, y: 0 },
          properties: {},
          tags: ["gear", "star", "repair_target"]
        }
      ]
    },
    interactions: [],
    goals: [
      {
        type: "all_sorted",
        params: {
          dimensions: ["color", "shape"],
          colors: [...colors],
          shapes: [...shapes]
        }
      }
    ],
    hints: [],
    repair: { steps: [] },
    toolCard: {
      puzzleId: "m01",
      stage: 1,
      front: {
        toolName: "分类与归纳",
        scene: "stage1/m01/toolcards/classification-thumbnail",
        wisdomCrystal: "秩序，是为相似之物找到归处。"
      },
      back: {
        coreAction: "在杂乱事物中找到共同属性，按属性归组。",
        whenToUse: ["整理一堆笔记不知从何下手时"],
        realLifeExamples: ["整理书架：按主题、作者或使用频率归位"],
        commonTraps:
          "分类维度选错会制造假秩序；关键不是怎么分最漂亮，而是这次分类要服务什么目的。"
      }
    }
  } as unknown as M01MemoryGearConfig;
}

function makeRealConfig(): M01MemoryGearConfig {
  return m01ConfigJson as unknown as M01MemoryGearConfig;
}

function sortAll(controller: M01MemoryGearController, config: M01MemoryGearConfig) {
  for (const color of colors) {
    controller.insertFilter(`filter_${color}`);
    for (const fragment of config.fragments.filter((item) => item.color === color)) {
      const result = controller.placeFragmentInSlot(
        fragment.id,
        `slot_${fragment.color}_${fragment.shape}`
      );
      expect(result.accepted).toBe(true);
    }
  }
}

const CORRECT_EVIDENCE_PAIRS: Array<[string, [string, string]]> = [
  ["current_manual_target_green_circle_hexagon_1", ["fragment_circle_yellow_1", "fragment_hexagon_blue_1"]],
  ["current_manual_target_orange_circle_hexagon_1", ["fragment_circle_yellow_1", "fragment_hexagon_red_2"]],
  ["current_manual_target_orange_circle_triangle_1", ["fragment_circle_red_2", "fragment_triangle_yellow_2"]],
  ["current_manual_target_purple_circle_hexagon_1", ["fragment_circle_red_2", "fragment_hexagon_blue_1"]],
  ["current_manual_target_green_triangle_triangle_1", ["fragment_triangle_blue_1", "fragment_triangle_yellow_2"]],
  ["current_manual_target_purple_triangle_hexagon_1", ["fragment_triangle_blue_1", "fragment_hexagon_red_2"]]
];

function stageCorrectCandidate(controller: M01MemoryGearController): void {
  for (const [evidenceId, fragmentIds] of CORRECT_EVIDENCE_PAIRS) {
    controller.stageEvidencePair(evidenceId, fragmentIds);
  }
}

function stageWrongColorCompleteCandidate(controller: M01MemoryGearController): void {
  controller.stageEvidencePair("current_manual_target_green_circle_hexagon_1", [
    "fragment_circle_red_2",
    "fragment_hexagon_blue_1"
  ]);
  for (const [evidenceId, fragmentIds] of CORRECT_EVIDENCE_PAIRS.slice(1)) {
    controller.stageEvidencePair(evidenceId, fragmentIds);
  }
}

function stageWrongFragmentSetCompleteCandidate(controller: M01MemoryGearController): void {
  controller.stageEvidencePair("current_manual_target_green_circle_hexagon_1", [
    "fragment_circle_blue_1",
    "fragment_hexagon_yellow_1"
  ]);
  for (const [evidenceId, fragmentIds] of CORRECT_EVIDENCE_PAIRS.slice(1)) {
    controller.stageEvidencePair(evidenceId, fragmentIds);
  }
}

describe("M01MemoryGearController", () => {
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

  it("loads the new M01 overlap evidence config", () => {
    expect(realM01Config.goal.type).toBe("overlap_evidence_reconstructed");
    expect(realM01Config.fragments.length).toBeGreaterThanOrEqual(12);
    expect(realM01Config.fragments.length).toBeLessThanOrEqual(16);
    expect(realM01Config.evidence.length).toBeGreaterThanOrEqual(4);
    expect(realM01Config.evidence.length).toBeLessThanOrEqual(6);
    expect(realM01Config.goal.params.requiredFragments).toBe("solution_defined");
    expect(realM01Config.goal.params.validationLightSeconds).toBe(2);
  });

  it("derives used fragments from the configured evidence solution graph", () => {
    const usedFragmentIds = new Set(
      realM01Config.evidence.flatMap(
        (evidence: { solution: { fragmentIds: string[] } }) => evidence.solution.fragmentIds
      )
    );

    expect(usedFragmentIds.size).toBeGreaterThan(0);
    expect(usedFragmentIds.size).toBeLessThan(realM01Config.fragments.length);
    for (const evidence of realM01Config.evidence) {
      expect(evidence.solution.fragmentIds).toHaveLength(2);
    }
  });

  it("keeps candidate fragments limited to circle, triangle, and hexagon shapes", () => {
    const allowedShapes = new Set(["circle", "triangle", "hexagon"]);
    const colorsByShape = new Map<string, Set<string>>();

    for (const fragment of realM01Config.fragments) {
      const shape = fragment.shape ?? fragment.edgeShape;
      expect(allowedShapes.has(shape)).toBe(true);
      expect(fragment.edgeShape).toBe(shape);
      const colors = colorsByShape.get(shape) ?? new Set<string>();
      colors.add(fragment.hiddenColor);
      colorsByShape.set(shape, colors);
    }

    expect([...colorsByShape.keys()].sort()).toEqual(["circle", "hexagon", "triangle"]);
    for (const colorsForShape of colorsByShape.values()) {
      expect(colorsForShape.size).toBeGreaterThanOrEqual(2);
    }
  });

  it("includes same-shape different-color decoys without leaking target answers", () => {
    const wrongColorDecoy = realM01Config.fragments.find(
      (fragment: { id: string }) => fragment.id === "fragment_hexagon_yellow_1"
    );
    const sameShapeDecoy = realM01Config.fragments.find(
      (fragment: { id: string }) => fragment.id === "fragment_hexagon_red_2"
    );

    expect(wrongColorDecoy).toMatchObject({
      hiddenColor: "yellow",
      edgeShape: "hexagon",
      shape: "hexagon"
    });
    expect(sameShapeDecoy).toMatchObject({
      hiddenColor: "red",
      edgeShape: "hexagon",
      shape: "hexagon"
    });
    expect(
      realM01Config.evidence.every(
        (evidence: { solution: { fragmentIds: string[] } }) =>
          evidence.solution.fragmentIds.length === 2
      )
    ).toBe(true);
    expect(
      realM01Config.evidence.some(
        (evidence: { solution: { fragmentIds: string[] } }) =>
          evidence.solution.fragmentIds.includes("fragment_hexagon_yellow_1")
      )
    ).toBe(false);
    expect(
      realM01Config.evidence.some(
        (evidence: { solution: { fragmentIds: string[] } }) =>
          evidence.solution.fragmentIds.includes("fragment_hexagon_blue_2")
      )
    ).toBe(false);
    const solutionFragmentIds = new Set(
      realM01Config.evidence.flatMap(
        (evidence: { solution: { fragmentIds: string[] } }) => evidence.solution.fragmentIds
      )
    );
    const solutionFragmentsTaggedAsDecoys = realM01Config.fragments
      .filter((fragment: { id: string; tags?: string[] }) => solutionFragmentIds.has(fragment.id))
      .filter((fragment: { tags?: string[] }) => fragment.tags?.includes("decoy"));

    expect(solutionFragmentsTaggedAsDecoys).toEqual([]);
    expect(realM01Config.goal.params.requiredFragments).toBe("solution_defined");
  });

  it("keeps target evidence limited to overlap hints only", () => {
    for (const evidence of realM01Config.evidence) {
      expect(evidence.targetShape).toBeDefined();
      expect(evidence.targetBlendColor).toMatch(/^(orange|green|purple)$/);
      expect(evidence.shapeTags).toEqual(
        evidence.generatedOverlap.sourceShapes.map((shape: string) => `shape:${shape}`)
      );
      expect(evidence.generatedOverlap).toMatchObject({
        areaRatio: expect.any(Number),
        offset: { x: expect.any(Number), y: expect.any(Number) }
      });
      expect(evidence.fullOutline).toBeUndefined();
      expect(evidence.fragmentIds).toBeUndefined();
      expect(evidence.hiddenColorHint).toBeUndefined();
    }
  });

  it("reveals candidate fragments without making hidden colors visible by default", () => {
    const controller = M01MemoryGearController.fromConfig(makeRealConfig());
    const fragment = controller.getFragmentState("fragment_circle_red_1");

    expect(fragment?.hiddenColorVisible).toBe(false);
    expect(controller.revealFragmentWithFlashlight("fragment_circle_red_1", "blue")).toEqual({
      accepted: true,
      fragmentId: "fragment_circle_red_1",
      flashlightColor: "blue",
      revealedColor: "purple"
    });
    expect(controller.getFragmentState("fragment_circle_red_1")?.hiddenColorVisible).toBe(false);
  });

  it("stages shape-compatible fixed-shape fragments against a generated overlap target without completing evidence immediately", () => {
    const controller = M01MemoryGearController.fromConfig(makeRealConfig());

    expect(
      controller.stageEvidencePair("current_manual_target_green_circle_hexagon_1", [
        "fragment_hexagon_blue_1",
        "fragment_circle_red_1"
      ])
    ).toMatchObject({
      accepted: true,
      evidenceId: "current_manual_target_green_circle_hexagon_1",
      colorRevealed: false
    });

    expect(controller.getCompletionState()).toMatchObject({
      completed: false,
      reconstructedEvidenceCount: 0,
      totalEvidenceCount: 6,
      bottomLight: "off"
    });
  });

  it("flashes the bottom light for two seconds when a complete candidate is not fully correct", () => {
    const controller = M01MemoryGearController.fromConfig(makeRealConfig());
    stageWrongColorCompleteCandidate(controller);

    expect(controller.validateCandidateStructure()).toMatchObject({
      accepted: false,
      reason: "wrong_blend_color",
      bottomLight: "flash_then_off",
      validationLightSeconds: 2,
      completed: false
    });
    expect(controller.getCompletionState()).toMatchObject({
      completed: false,
      reconstructedEvidenceCount: 0,
      bottomLight: "flash_then_off"
    });
  });

  it("rejects validation while the candidate is still incomplete", () => {
    const controller = M01MemoryGearController.fromConfig(makeRealConfig());
    controller.stageEvidencePair("current_manual_target_green_circle_hexagon_1", [
      "fragment_circle_red_1",
      "fragment_triangle_blue_1"
    ]);

    expect(controller.validateCandidateStructure()).toMatchObject({
      accepted: false,
      reason: "incomplete_candidate",
      bottomLight: "flash_then_off",
      validationLightSeconds: 2,
      completed: false
    });
  });

  it("turns the bottom light off after the failed validation flash window", () => {
    let now = 10_000;
    const controller = M01MemoryGearController.fromConfig(makeRealConfig(), {
      now: () => now
    });
    stageWrongColorCompleteCandidate(controller);

    controller.validateCandidateStructure();

    expect(controller.getCompletionState().bottomLight).toBe("flash_then_off");

    now += 1_999;
    expect(controller.getCompletionState().bottomLight).toBe("flash_then_off");

    now += 1;
    expect(controller.getCompletionState().bottomLight).toBe("off");
  });

  it("keeps the bottom light on only when all staged evidence pairs are correct", () => {
    const controller = M01MemoryGearController.fromConfig(makeRealConfig());
    stageCorrectCandidate(controller);

    expect(controller.validateCandidateStructure()).toMatchObject({
      accepted: true,
      bottomLight: "steady_on",
      completed: true,
      reconstructedEvidenceIds: CORRECT_EVIDENCE_PAIRS.map(([evidenceId]) => evidenceId)
    });
    expect(controller.isComplete()).toBe(true);

    const unlock = controller.completeRepairAndUnlockToolCard();
    expect(unlock).toMatchObject({
      completed: true,
      newlyUnlocked: true
    });
  });

  it("reports wrong fragment set when a decoy pair produces the right blend color", () => {
    const controller = M01MemoryGearController.fromConfig(makeRealConfig());
    stageWrongFragmentSetCompleteCandidate(controller);

    expect(controller.validateCandidateStructure()).toMatchObject({
      accepted: false,
      reason: "wrong_fragment_set",
      bottomLight: "flash_then_off",
      validationLightSeconds: 2,
      completed: false
    });
  });

  it("rejects correct colors when the pair is assigned to the wrong generated overlap target", () => {
    const controller = M01MemoryGearController.fromConfig(makeRealConfig());
    controller.stageEvidencePair("current_manual_target_green_circle_hexagon_1", [
      "fragment_circle_blue_1",
      "fragment_hexagon_yellow_1"
    ]);
    controller.stageEvidencePair("current_manual_target_orange_circle_hexagon_1", [
      "fragment_circle_red_2",
      "fragment_hexagon_yellow_1"
    ]);
    controller.stageEvidencePair("current_manual_target_orange_circle_triangle_1", [
      "fragment_circle_yellow_1",
      "fragment_triangle_red_1"
    ]);
    controller.stageEvidencePair("current_manual_target_purple_circle_hexagon_1", [
      "fragment_circle_blue_1",
      "fragment_hexagon_red_1"
    ]);
    controller.stageEvidencePair("current_manual_target_green_triangle_triangle_1", [
      "fragment_triangle_yellow_1",
      "fragment_triangle_blue_1"
    ]);
    controller.stageEvidencePair("current_manual_target_purple_triangle_hexagon_1", [
      "fragment_triangle_red_1",
      "fragment_hexagon_blue_2"
    ]);

    expect(controller.validateCandidateStructure()).toMatchObject({
      accepted: false,
      reason: "wrong_fragment_set",
      bottomLight: "flash_then_off",
      validationLightSeconds: 2,
      completed: false
    });
  });

  it("lets a failed staged pair be replaced by a later snap", () => {
    const controller = M01MemoryGearController.fromConfig(makeRealConfig());

    controller.stageEvidencePair("current_manual_target_green_circle_hexagon_1", [
      "fragment_hexagon_blue_2",
      "fragment_circle_blue_1"
    ]);

    expect(
      controller.stageEvidencePair("current_manual_target_green_circle_hexagon_1", [
        "fragment_hexagon_blue_1",
        "fragment_circle_red_1"
      ])
    ).toMatchObject({
      accepted: true,
      evidenceId: "current_manual_target_green_circle_hexagon_1",
      fragmentIds: ["fragment_hexagon_blue_1", "fragment_circle_red_1"]
    });
  });

  it("removes staged evidence when a fragment is moved away again", () => {
    const controller = M01MemoryGearController.fromConfig(makeRealConfig());
    stageCorrectCandidate(controller);

    expect(controller.unstageFragment("fragment_hexagon_blue_1")).toEqual([
      "current_manual_target_green_circle_hexagon_1",
      "current_manual_target_purple_circle_hexagon_1"
    ]);
    expect(controller.isEvidenceStaged("current_manual_target_green_circle_hexagon_1")).toBe(false);

    expect(controller.validateCandidateStructure()).toMatchObject({
      accepted: false,
      reason: "incomplete_candidate",
      bottomLight: "flash_then_off",
      validationLightSeconds: 2,
      completed: false
    });
  });

  it("sorts all fragments by active color filter and unlocks the M01 ToolCard", () => {
    const config = makeConfig();
    const controller = M01MemoryGearController.fromConfig(config);

    sortAll(controller, config);

    expect(controller.isComplete()).toBe(true);
    expect(controller.getCompletionState()).toMatchObject({
      completed: true,
      sortedCount: 18,
      totalFragments: 18
    });
    const unlock = controller.completeRepairAndUnlockToolCard();
    expect(unlock.completed).toBe(true);
    if (unlock.completed) {
      expect(unlock.newlyUnlocked).toBe(true);
      expect(unlock.toolCard.puzzleId).toBe("m01");
      expect(validateToolCard(unlock.toolCard).ok).toBe(true);
    }
    expect(controller.getToolCardUnlock()?.toolCard.front.toolName).toBe("分类与归纳");
  });

  it("rejects a fragment placed into a slot with the wrong shape or color", () => {
    const controller = M01MemoryGearController.fromConfig(makeConfig());
    controller.insertFilter("filter_red");

    const result = controller.placeFragmentInSlot(
      "fragment_red_circle_1",
      "slot_red_triangle"
    );

    expect(result).toEqual({
      accepted: false,
      reason: "wrong_slot",
      fragmentId: "fragment_red_circle_1",
      slotId: "slot_red_triangle"
    });
    expect(controller.getFragmentState("fragment_red_circle_1")).toMatchObject({
      slotId: null,
      sorted: false
    });
    expect(controller.isComplete()).toBe(false);
  });

  it("only exposes unsorted fragments matching the inserted active filter as draggable", () => {
    const controller = M01MemoryGearController.fromConfig(makeConfig());

    expect(controller.getDraggableFragmentIds()).toEqual([]);
    expect(controller.isFragmentDraggable("fragment_red_circle_1")).toBe(false);

    controller.insertFilter("filter_red");

    expect(controller.isFragmentDraggable("fragment_red_circle_1")).toBe(true);
    expect(controller.isFragmentDraggable("fragment_blue_circle_1")).toBe(false);
    expect(controller.getDraggableFragmentIds()).toHaveLength(6);

    const rejected = controller.placeFragmentInSlot(
      "fragment_blue_circle_1",
      "slot_blue_circle"
    );

    expect(rejected.accepted).toBe(false);
    if (!rejected.accepted) {
      expect(rejected.reason).toBe("inactive_filter");
    }
  });

  it("does not complete until every duplicate fragment is sorted", () => {
    const config = makeConfig();
    const controller = M01MemoryGearController.fromConfig(config);

    for (const color of colors) {
      controller.insertFilter(`filter_${color}`);
      for (const fragment of config.fragments.filter(
        (item) => item.color === color && item.id.endsWith("_1")
      )) {
        controller.placeFragmentInSlot(fragment.id, `slot_${fragment.color}_${fragment.shape}`);
      }
    }

    expect(controller.getCompletionState()).toMatchObject({
      completed: false,
      sortedCount: 9,
      totalFragments: 18
    });
    expect(controller.getToolCardUnlock()).toBeNull();
  });

  it("completes and persists the real overlap evidence M01 JSON", () => {
    const config = makeRealConfig();
    const progressStore = createProgressStore({
      storage: createMemoryStorage(),
      now: () => 12345
    });
    const controller = M01MemoryGearController.fromConfig(config, {
      progressStore,
      now: () => 12345
    });

    expect(config.goal.type).toBe("overlap_evidence_reconstructed");
    expect(controller.getCompletionState()).toMatchObject({
      completed: false,
      reconstructedEvidenceCount: 0,
      totalEvidenceCount: config.evidence.length,
      usedFragmentCount: 6,
      bottomLight: "off"
    });

    stageCorrectCandidate(controller);
    expect(controller.validateCandidateStructure()).toMatchObject({
      accepted: true,
      completed: true,
      bottomLight: "steady_on"
    });

    const firstUnlock = controller.completeRepairAndUnlockToolCard();
    const secondUnlock = controller.completeRepairAndUnlockToolCard();

    expect(firstUnlock).toMatchObject({
      completed: true,
      newlyUnlocked: true
    });
    expect(secondUnlock).toMatchObject({
      completed: true,
      newlyUnlocked: false
    });
    expect(progressStore.isPuzzleCompleted("m01")).toBe(true);
    expect(progressStore.hasToolCard("m01")).toBe(true);
  });
});
