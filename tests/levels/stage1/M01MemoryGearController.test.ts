import { describe, expect, it } from "vitest";
import {
  M01MemoryGearController,
  type M01MemoryGearConfig
} from "../../../assets/scripts/levels/stage1/M01MemoryGearController.ts";
import { createMemoryStorage, createProgressStore } from "../../../assets/scripts/core/ProgressStore.ts";
import { validateToolCard } from "../../../assets/scripts/core/ToolCard.ts";
import m01ConfigJson from "../../../assets/resources/configs/stage1/m01-memory-gear.json" with { type: "json" };

const colors = ["red", "blue", "yellow"] as const;
const shapes = ["circle", "triangle", "hexagon"] as const;

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
  };
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

describe("M01MemoryGearController", () => {
  it("sorts all fragments by active color filter and unlocks the M01 ToolCard", () => {
    const config = makeConfig();
    const controller = M01MemoryGearController.fromConfig(config);

    sortAll(controller, config);

    expect(controller.isComplete()).toBe(true);
    expect(controller.getCompletionState()).toEqual({
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

    expect(controller.getCompletionState()).toEqual({
      completed: false,
      sortedCount: 9,
      totalFragments: 18
    });
    expect(controller.getToolCardUnlock()).toBeNull();
  });

  it("loads and completes the real M01 JSON through progress and ToolCard integration", () => {
    const config = makeRealConfig();
    const progressStore = createProgressStore({
      storage: createMemoryStorage(),
      now: () => 12345
    });
    const controller = M01MemoryGearController.fromConfig(config, {
      progressStore,
      now: () => 12345
    });

    sortAll(controller, config);

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
