import { describe, expect, it } from "vitest";

import { validatePuzzleConfig } from "../../assets/scripts/core/PuzzleConfig.ts";
import m01Config from "../../assets/resources/configs/stage1/m01-memory-gear.json" with { type: "json" };

const validM01LikeConfig = {
  id: "m01",
  name: "记忆齿轮的卡顿",
  stage: 1,
  cognitiveSkill: "分类与归纳",
  wisdomCrystal: "秩序，是为相似之物找到归处。",
  scene: {
    background: "textures/stars/m01",
    ambientAudio: "audio/ambient/m01",
    camera: {
      position: { x: 0, y: 0 },
      zoom: 1
    },
    entities: [
      {
        id: "fragment_red_circle_1",
        type: "draggable",
        sprite: "textures/fragments/circle",
        position: { x: 12, y: 24 },
        properties: { color: "red", shape: "circle" },
        tags: ["fragment", "red", "circle"]
      }
    ]
  },
  interactions: [
    {
      trigger: "drag:filter_red -> slot:gear_slot_red",
      effect: "highlight:tag:red | dim:tag:!red"
    }
  ],
  goals: [
    {
      type: "all_sorted",
      params: {
        dimensions: ["color", "shape"],
        colors: ["red", "blue", "yellow"],
        shapes: ["circle", "triangle", "hexagon"]
      }
    }
  ],
  hints: [
    { level: 1, delay: 30, text: "filter glows", highlight: ["filter_red"] },
    { level: 2, delay: 60, text: "matching fragments pulse" },
    { level: 3, delay: 90, text: "target slot outline appears" }
  ],
  repair: {
    steps: [
      {
        type: "entity_animate",
        params: { entityId: "memory_gear", animation: "turn" },
        duration: 2.5,
        delay: 0
      }
    ]
  }
};

describe("validatePuzzleConfig", () => {
  it("accepts an M01-like data-driven puzzle config", () => {
    const result = validatePuzzleConfig(validM01LikeConfig);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.goals[0]?.type).toBe("all_sorted");
      expect(result.value.scene.entities[0]?.properties.color).toBe("red");
    }
  });

  it("accepts the real M01 memory gear config", () => {
    const result = validatePuzzleConfig(m01Config);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe("m01");
      expect(result.value.goals[0]?.type).toBe("overlap_evidence_reconstructed");
      expect(result.value.scene.entities.length).toBeGreaterThan(0);
    }
  });

  it("rejects configs with missing required scene data", () => {
    const invalidConfig = {
      ...validM01LikeConfig,
      scene: {
        ...validM01LikeConfig.scene,
        entities: []
      }
    };

    const result = validatePuzzleConfig(invalidConfig);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("scene.entities must include at least one entity");
    }
  });
});
