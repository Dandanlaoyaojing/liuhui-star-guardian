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

function stageWrongFragmentSetCompleteCandidate(controller: M01MemoryGearController): void {
  controller.stageEvidencePair("evidence_purple_arc", ["fragment_a", "fragment_m"]);
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

  it("includes shape-compatible decoys without leaking target answers", () => {
    const wrongColorDecoy = realM01Config.fragments.find(
      (fragment: { id: string }) => fragment.id === "fragment_i"
    );
    const sameColorDecoy = realM01Config.fragments.find(
      (fragment: { id: string }) => fragment.id === "fragment_m"
    );

    expect(wrongColorDecoy).toMatchObject({ hiddenColor: "yellow", edgeShape: "arc_socket" });
    expect(sameColorDecoy).toMatchObject({ hiddenColor: "blue", edgeShape: "arc_socket" });
    expect(
      realM01Config.evidence.every(
        (evidence: { solution: { fragmentIds: string[] } }) =>
          evidence.solution.fragmentIds.length === 2
      )
    ).toBe(true);
    expect(
      realM01Config.evidence.some(
        (evidence: { solution: { fragmentIds: string[] } }) =>
          evidence.solution.fragmentIds.includes("fragment_i")
      )
    ).toBe(false);
    expect(
      realM01Config.evidence.some(
        (evidence: { solution: { fragmentIds: string[] } }) =>
          evidence.solution.fragmentIds.includes("fragment_m")
      )
    ).toBe(false);
    expect(realM01Config.goal.params.requiredFragments).toBe("solution_defined");
  });

  it("keeps target evidence limited to overlap hints only", () => {
    for (const evidence of realM01Config.evidence) {
      expect(evidence.targetShape).toBeDefined();
      expect(evidence.targetBlendColor).toMatch(/^(orange|green|purple)$/);
      expect(evidence.fullOutline).toBeUndefined();
      expect(evidence.fragmentIds).toBeUndefined();
      expect(evidence.hiddenColorHint).toBeUndefined();
    }
  });

  it("reveals candidate fragments without making hidden colors visible by default", () => {
    const controller = M01MemoryGearController.fromConfig(makeRealConfig());
    const fragment = controller.getFragmentState("fragment_a");

    expect(fragment?.hiddenColorVisible).toBe(false);
    expect(controller.revealFragmentWithFlashlight("fragment_a", "blue")).toEqual({
      accepted: true,
      fragmentId: "fragment_a",
      flashlightColor: "blue",
      revealedColor: "purple"
    });
    expect(controller.getFragmentState("fragment_a")?.hiddenColorVisible).toBe(false);
  });

  it("stages a shape-compatible overlap without completing evidence immediately", () => {
    const controller = M01MemoryGearController.fromConfig(makeRealConfig());

    expect(
      controller.stageEvidencePair("evidence_purple_arc", ["fragment_a", "fragment_b"])
    ).toMatchObject({
      accepted: true,
      evidenceId: "evidence_purple_arc",
      colorRevealed: false
    });

    expect(controller.getCompletionState()).toMatchObject({
      completed: false,
      reconstructedEvidenceCount: 0,
      totalEvidenceCount: 4,
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

  it("keeps the bottom light on only when all staged evidence pairs are correct", () => {
    const controller = M01MemoryGearController.fromConfig(makeRealConfig());
    stageCorrectCandidate(controller);

    expect(controller.validateCandidateStructure()).toMatchObject({
      accepted: true,
      bottomLight: "steady_on",
      completed: true,
      reconstructedEvidenceIds: [
        "evidence_purple_arc",
        "evidence_green_notch",
        "evidence_orange_crescent",
        "evidence_purple_branch"
      ]
    });
    expect(controller.isComplete()).toBe(true);

    const unlock = controller.completeRepairAndUnlockToolCard();
    expect(unlock).toMatchObject({
      completed: true,
      newlyUnlocked: true
    });
  });

  it("reports wrong fragment set when a shape-compatible decoy has the right color", () => {
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

  it("lets a failed staged pair be replaced by a later snap", () => {
    const controller = M01MemoryGearController.fromConfig(makeRealConfig());

    controller.stageEvidencePair("evidence_purple_arc", ["fragment_a", "fragment_i"]);

    expect(
      controller.stageEvidencePair("evidence_purple_arc", ["fragment_a", "fragment_b"])
    ).toMatchObject({
      accepted: true,
      evidenceId: "evidence_purple_arc",
      fragmentIds: ["fragment_a", "fragment_b"]
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

  it("loads the real overlap evidence M01 JSON without using the old sort completion path", () => {
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
      usedFragmentCount: 8,
      bottomLight: "off"
    });
    expect(controller.completeRepairAndUnlockToolCard()).toEqual({
      completed: false,
      reason: "not_complete"
    });
    expect(progressStore.isPuzzleCompleted("m01")).toBe(false);
    expect(progressStore.hasToolCard("m01")).toBe(false);
  });
});
