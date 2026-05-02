import { describe, expect, it } from "vitest";

import {
  buildM01GreyboxLayout,
  resolveM01EvidenceFragmentSnapPosition
} from "../../assets/scripts/cocos/M01GreyboxLayout.ts";
import type { M01MemoryGearConfig } from "../../assets/scripts/levels/stage1/M01MemoryGearController.ts";
import m01ConfigJson from "../../assets/resources/configs/stage1/m01-memory-gear.json" with { type: "json" };

const config = m01ConfigJson as unknown as M01MemoryGearConfig;

describe("buildM01GreyboxLayout", () => {
  it("builds flashlight, candidate fragment, evidence, and board nodes", () => {
    const layout = buildM01GreyboxLayout(config);

    expect(layout.canvas).toEqual({ width: 960, height: 640 });
    expect(layout.gear.id).toBe("entity_memory_gear");
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

  it("keeps candidate fragments as a compact bottom-floor pool", () => {
    const layout = buildM01GreyboxLayout(config);

    expect(layout.fragments.every((fragment) => fragment.position.y <= -210)).toBe(true);
    expect(Math.max(...layout.fragments.map((fragment) => fragment.position.y))).toBeLessThan(
      layout.board.position.y - layout.board.size.height / 2
    );
  });

  it("uses only circle, triangle, and hexagon as fragment display shapes", () => {
    const layout = buildM01GreyboxLayout(config);
    const shapes = new Set(layout.fragments.map((fragment) => fragment.shapeToken));

    expect([...shapes].sort()).toEqual(["circle", "hexagon", "triangle"]);
    expect(layout.fragments.every((fragment) => fragment.size.width === 48)).toBe(true);
    expect(layout.fragments.every((fragment) => fragment.size.height === 48)).toBe(true);
  });

  it("keeps target evidence as one coherent reference pattern above the floor pool", () => {
    const layout = buildM01GreyboxLayout(config);
    const boardHalfWidth = layout.board.size.width / 2;
    const boardHalfHeight = layout.board.size.height / 2;

    expect(layout.referenceEvidence).toHaveLength(config.evidence.length);
    expect(layout.referencePattern).toMatchObject({
      kind: "reference_pattern",
      shapeToken: "reference_pattern"
    });
    expect(layout.referencePattern?.tags).toEqual(
      expect.arrayContaining(["complete_pattern", "target_pattern"])
    );
    expect(layout.evidence.every((evidence) => evidence.tags.includes("snap_zone"))).toBe(true);
    expect(
      layout.evidence.every(
        (evidence) =>
          Math.abs(evidence.position.x - layout.board.position.x) <= boardHalfWidth &&
          Math.abs(evidence.position.y - layout.board.position.y) <= boardHalfHeight
      )
    ).toBe(true);

    expect(
      layout.referenceEvidence.every(
        (evidence) =>
          Math.abs(evidence.position.x - layout.board.position.x) > boardHalfWidth ||
          Math.abs(evidence.position.y - layout.board.position.y) > boardHalfHeight
      )
    ).toBe(true);
    expect(layout.referenceEvidence.every((evidence) => evidence.position.y > -170)).toBe(true);
    expect(layout.referenceEvidence.map((evidence) => evidence.colorToken)).toEqual([
      "purple",
      "green",
      "orange",
      "purple"
    ]);

    const referenceScale =
      (layout.referenceEvidence[1].position.x - layout.referenceEvidence[0].position.x) /
      (config.evidence[1].position.x - config.evidence[0].position.x);

    for (let i = 0; i < config.evidence.length; i += 1) {
      for (let j = i + 1; j < config.evidence.length; j += 1) {
        const originalDx = config.evidence[j].position.x - config.evidence[i].position.x;
        const originalDy = config.evidence[j].position.y - config.evidence[i].position.y;
        const referenceDx =
          layout.referenceEvidence[j].position.x - layout.referenceEvidence[i].position.x;
        const referenceDy =
          layout.referenceEvidence[j].position.y - layout.referenceEvidence[i].position.y;

        expect(referenceDx).toBeCloseTo(originalDx * referenceScale, 5);
        expect(referenceDy).toBeCloseTo(originalDy * referenceScale, 5);
      }
    }
  });

  it("snaps the two fragments for an evidence pair into partial-overlap poses instead of one pile", () => {
    const layout = buildM01GreyboxLayout(config);
    const evidenceConfig = config.evidence[0];
    const evidence = layout.evidence.find((item) => item.controllerId === evidenceConfig.id);

    expect(evidence).toBeDefined();

    const [firstFragmentId, secondFragmentId] = evidenceConfig.solution.fragmentIds;
    const firstPosition = resolveM01EvidenceFragmentSnapPosition(evidence!, firstFragmentId);
    const secondPosition = resolveM01EvidenceFragmentSnapPosition(evidence!, secondFragmentId);

    expect(firstPosition).not.toEqual(evidence!.position);
    expect(secondPosition).not.toEqual(evidence!.position);
    expect(distance(firstPosition, secondPosition)).toBeGreaterThanOrEqual(32);
    expect(midpoint(firstPosition.x, secondPosition.x)).toBeCloseTo(evidence!.position.x, 5);
    expect(midpoint(firstPosition.y, secondPosition.y)).toBeCloseTo(evidence!.position.y, 5);
  });
});

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: number, b: number): number {
  return (a + b) / 2;
}
