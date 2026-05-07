import { describe, expect, it } from "vitest";

import {
  buildM01GreyboxLayout,
  M01_STANDARD_PIECE_DISPLAY_SIZE,
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
    expect(layout.gear.size).toEqual({ width: 430, height: 430 });
    expect(layout.board.size).toEqual({ width: 430, height: 430 });
    expect(layout.flashlights).toHaveLength(3);
    expect(layout.flashlights.map((flashlight) => flashlight.position)).toEqual([
      { x: 420, y: 68 },
      { x: 424, y: 85 },
      { x: 428, y: 102 }
    ]);
    expect(layout.flashlights.map((flashlight) => flashlight.size)).toEqual([
      { width: 18, height: 18 },
      { width: 18, height: 18 },
      { width: 18, height: 18 }
    ]);
    expect(layout.fragments).toHaveLength(config.fragments.length);
    expect(layout.evidence).toHaveLength(config.evidence.length);
    expect(layout.targetPieceSlots).toHaveLength(config.targetPattern?.pieces.length ?? 0);
    expect(layout.board.kind).toBe("board");
    expect(layout.slots).toBeUndefined();
  });

  it("uses each candidate fragment's own color on its standard piece", () => {
    const layout = buildM01GreyboxLayout(config);

    expect(layout.fragments.map((fragment) => ({
      id: fragment.id,
      colorToken: fragment.colorToken
    }))).toEqual(
      config.fragments.map((fragment) => ({
        id: fragment.id,
        colorToken: fragment.hiddenColor
      }))
    );
  });

  it("does not expose complete outline data in evidence nodes", () => {
    const layout = buildM01GreyboxLayout(config);

    for (const evidence of layout.evidence) {
      expect(evidence.tags).toContain("overlap_evidence");
      expect(evidence.tags).not.toContain("complete_outline");
    }
  });

  it("keeps legacy generated overlap targets hidden while composing a manual target", () => {
    const manualLegacyConfig: M01MemoryGearConfig = {
      ...config,
      targetPattern: {
        ...config.targetPattern!,
        locked: false
      },
      evidence: config.evidence.map((evidence) => ({
        ...evidence,
        generatedOverlap: evidence.generatedOverlap
          ? {
              ...evidence.generatedOverlap,
              outline: undefined
            }
          : undefined
      }))
    };
    const layout = buildM01GreyboxLayout(manualLegacyConfig);

    expect(manualLegacyConfig.evidence.every((evidence) => evidence.generatedOverlap?.outline === undefined))
      .toBe(true);
    expect(manualLegacyConfig.targetPattern?.locked).toBe(false);
    expect(layout.evidence).toHaveLength(manualLegacyConfig.evidence.length);
    expect(layout.evidence.every((evidence) => evidence.magnetPolygon === undefined))
      .toBe(true);
  });

  it("hides explicit visual-rescue overlap outlines while composing a manual target", () => {
    const layout = buildM01GreyboxLayout({
      ...config,
      targetPattern: {
        ...config.targetPattern!,
        locked: false,
        pieces: []
      }
    });

    expect(config.evidence.some((evidence) => (evidence.generatedOverlap?.outline?.length ?? 0) >= 3))
      .toBe(true);
    expect(layout.evidenceSnapEnabled).toBe(false);
    expect(layout.evidence.every((evidence) => evidence.magnetPolygon === undefined))
      .toBe(true);
  });

  it("synthesizes visible magnet polygons for locked legacy generated overlap targets", () => {
    const layout = buildM01GreyboxLayout({
      ...config,
      targetPattern: {
        ...config.targetPattern!,
        locked: true
      }
    });

    expect(layout.evidence).toHaveLength(config.evidence.length);
    expect(layout.evidence.every((evidence) => (evidence.magnetPolygon?.length ?? 0) >= 3))
      .toBe(true);
    expect(layout.evidence.map((evidence) => evidence.shapeToken)).toEqual(
      config.evidence.map((evidence) => evidence.targetShape)
    );
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
    expect(layout.fragments.every((fragment) => fragment.size.width === M01_STANDARD_PIECE_DISPLAY_SIZE.width))
      .toBe(true);
    expect(layout.fragments.every((fragment) => fragment.size.height === M01_STANDARD_PIECE_DISPLAY_SIZE.height))
      .toBe(true);
  });

  it("locks the exact exported hand-composed target manifest", () => {
    const layout = buildM01GreyboxLayout(config);

    expect(config.targetPattern).toMatchObject({
      source: "manual_standard_piece_manifest",
      coordinateSpace: "m01_board_local",
      locked: true
    });
    expect(config.targetPattern?.note).toContain("2026-05-07 exact manual target export");
    expect(config.targetPattern?.pieces).toEqual([
      expect.objectContaining({
        id: "target_piece_circle_yellow_1",
        standardPieceId: "standard_circle",
        fragmentId: "fragment_circle_yellow_1",
        position: { x: -38, y: -38.5 },
        rotation: 0
      }),
      expect.objectContaining({
        id: "target_piece_circle_red_2",
        standardPieceId: "standard_circle",
        fragmentId: "fragment_circle_red_2",
        position: { x: -2, y: 14.5 },
        rotation: 0
      }),
      expect.objectContaining({
        id: "target_piece_triangle_blue_1",
        standardPieceId: "standard_triangle",
        fragmentId: "fragment_triangle_blue_1",
        position: { x: 18, y: -40.5 },
        rotation: 90
      }),
      expect.objectContaining({
        id: "target_piece_triangle_yellow_2",
        standardPieceId: "standard_triangle",
        fragmentId: "fragment_triangle_yellow_2",
        position: { x: 36, y: -11.5 },
        rotation: 180
      }),
      expect.objectContaining({
        id: "target_piece_hexagon_blue_1",
        standardPieceId: "standard_hexagon",
        fragmentId: "fragment_hexagon_blue_1",
        position: { x: -33, y: 3.5 },
        rotation: 0
      }),
      expect.objectContaining({
        id: "target_piece_hexagon_red_2",
        standardPieceId: "standard_hexagon",
        fragmentId: "fragment_hexagon_red_2",
        position: { x: 3, y: -62.5 },
        rotation: 90
      })
    ]);
    expect(layout.targetPieceSlots).toHaveLength(6);
    expect(layout.targetPieceSlots.map((slot) => slot.expectedFragmentId)).toEqual([
      "fragment_circle_yellow_1",
      "fragment_circle_red_2",
      "fragment_triangle_blue_1",
      "fragment_triangle_yellow_2",
      "fragment_hexagon_blue_1",
      "fragment_hexagon_red_2"
    ]);
    expect(layout.evidenceSnapEnabled).toBe(true);
  });

  it("uses the exact manual target export as generated evidence with magnetic outlines", () => {
    const layout = buildM01GreyboxLayout(config);

    expect(config.standardPieces).toEqual([
      expect.objectContaining({
        id: "standard_circle",
        shape: "circle",
        size: M01_STANDARD_PIECE_DISPLAY_SIZE
      }),
      expect.objectContaining({
        id: "standard_triangle",
        shape: "triangle",
        size: M01_STANDARD_PIECE_DISPLAY_SIZE
      }),
      expect.objectContaining({
        id: "standard_hexagon",
        shape: "hexagon",
        size: M01_STANDARD_PIECE_DISPLAY_SIZE
      })
    ]);
    expect(config.targetPattern).toMatchObject({
      source: "manual_standard_piece_manifest",
      coordinateSpace: "m01_board_local",
      locked: true
    });
    expect(config.targetPattern?.pieces).toHaveLength(6);
    expect(config.evidence).toHaveLength(6);
    expect(config.evidence.every((evidence) => evidence.id.startsWith("current_manual_target_")))
      .toBe(true);
    expect(config.evidence.map((evidence) => evidence.targetBlendColor)).toEqual([
      "green",
      "orange",
      "orange",
      "purple",
      "green",
      "purple"
    ]);
    expect(config.evidence.every((evidence) => (evidence.generatedOverlap?.outline?.length ?? 0) >= 3))
      .toBe(true);
    expect(layout.evidence.every((evidence) => (evidence.magnetPolygon?.length ?? 0) >= 3))
      .toBe(true);
    expect(layout.targetPieceSlots).toHaveLength(6);
  });

  it("keeps workbench overlap outlines at standard-piece scale while compacting their positions", () => {
    const layout = buildM01GreyboxLayout({
      ...config,
      targetPattern: {
        ...config.targetPattern!,
        locked: true
      }
    });

    for (const evidenceConfig of config.evidence) {
      const evidence = layout.evidence.find((item) => item.controllerId === evidenceConfig.id);
      expect(evidence).toBeDefined();
      expect(evidenceConfig.generatedOverlap?.outline).toBeDefined();
      expect(evidence?.magnetPolygon).toBeDefined();

      const sourceBounds = boundsForPoints(evidenceConfig.generatedOverlap!.outline!);
      const layoutBounds = boundsForPoints(evidence!.magnetPolygon!);

      expect(evidence!.magnetPolygon).toEqual(evidenceConfig.generatedOverlap!.outline);
      expect(layoutBounds.maxX - layoutBounds.minX).toBeCloseTo(
        sourceBounds.maxX - sourceBounds.minX,
        5
      );
      expect(layoutBounds.maxY - layoutBounds.minY).toBeCloseTo(
        sourceBounds.maxY - sourceBounds.minY,
        5
      );
    }
  });

  it("keeps staging evidence inside the large assembly table while target evidence remains a left reference", () => {
    const layout = buildM01GreyboxLayout(config);
    const boardHalfWidth = layout.board.size.width / 2;
    const boardHalfHeight = layout.board.size.height / 2;

    expect(layout.referenceEvidence).toHaveLength(config.evidence.length);
    expect(layout.referencePattern).toMatchObject({
      kind: "reference_pattern",
      shapeToken: "reference_pattern"
    });
    expect(layout.referencePattern?.tags).toEqual(
      expect.arrayContaining(["complete_pattern", "target_pattern", "standard_piece_geometry"])
    );
    expect(layout.evidence.every((evidence) => evidence.tags.includes("snap_zone"))).toBe(true);
    expect(
      layout.evidence.every(
        (evidence) =>
          Math.abs(evidence.position.x - layout.board.position.x) <= boardHalfWidth - 30 &&
          Math.abs(evidence.position.y - layout.board.position.y) <= boardHalfHeight - 30
      )
    ).toBe(true);
    for (const evidence of layout.evidence) {
      for (const fragmentId of Object.keys(evidence.fragmentSnapPositions ?? {})) {
        const snap = resolveM01EvidenceFragmentSnapPosition(evidence, fragmentId);
        expect(Math.abs(snap.x - layout.board.position.x)).toBeLessThanOrEqual(boardHalfWidth);
        expect(Math.abs(snap.y - layout.board.position.y)).toBeLessThanOrEqual(boardHalfHeight);
        expect(Math.hypot(snap.x - layout.board.position.x, snap.y - layout.board.position.y))
          .toBeLessThanOrEqual(150);
      }
    }

    expect(layout.referencePattern?.position.x).toBeLessThan(-250);
    expect(layout.referencePattern?.size.width).toBeLessThanOrEqual(170);
    expect(layout.referencePattern?.size.height).toBeLessThanOrEqual(170);
    expect(
      layout.referenceEvidence.every(
        (evidence) =>
          Math.abs(evidence.position.x - layout.board.position.x) > boardHalfWidth ||
          Math.abs(evidence.position.y - layout.board.position.y) > boardHalfHeight
      )
    ).toBe(true);
    expect(layout.referenceEvidence.every((evidence) => evidence.position.y > -170)).toBe(true);
    expect(layout.referenceEvidence.map((evidence) => evidence.colorToken)).toEqual(
      config.evidence.map((evidence) => evidence.targetBlendColor)
    );

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

function boundsForPoints(points: Array<{ x: number; y: number }>): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  return points.reduce(
    (current, point) => ({
      minX: Math.min(current.minX, point.x),
      maxX: Math.max(current.maxX, point.x),
      minY: Math.min(current.minY, point.y),
      maxY: Math.max(current.maxY, point.y)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );
}
