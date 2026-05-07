import { describe, expect, it } from "vitest";

import { resolveM01GreyboxDrop } from "../../assets/scripts/cocos/M01GreyboxDrag.ts";
import { buildM01GreyboxLayout } from "../../assets/scripts/cocos/M01GreyboxLayout.ts";
import {
  deriveM01TargetEvidenceFromPlacements,
  resolveM01TargetEvidenceFromConfig,
  type M01ManualTargetPiecePlacement
} from "../../assets/scripts/cocos/M01TargetPatternGenerator.ts";
import type { M01MemoryGearConfig } from "../../assets/scripts/levels/stage1/M01MemoryGearController.ts";
import m01ConfigJson from "../../assets/resources/configs/stage1/m01-memory-gear.json" with { type: "json" };

const config = m01ConfigJson as unknown as M01MemoryGearConfig;

describe("deriveM01TargetEvidenceFromPlacements", () => {
  it("turns standard-piece intersections into overlap evidence targets", () => {
    const placements: M01ManualTargetPiecePlacement[] = [
      {
        fragmentId: "fragment_circle_red_1",
        position: { x: 0, y: 0 }
      },
      {
        fragmentId: "fragment_circle_blue_1",
        position: { x: 24, y: 0 }
      },
      {
        fragmentId: "fragment_triangle_yellow_1",
        position: { x: 0, y: -100 }
      }
    ];

    const evidence = deriveM01TargetEvidenceFromPlacements(config, placements);

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      id: "target_overlap_purple_circle_circle_1",
      targetShape: "generated_overlap",
      targetBlendColor: "purple",
      shapeTags: ["shape:circle", "shape:circle"],
      generatedOverlap: {
        sourceShapes: ["circle", "circle"],
        offset: { x: 24, y: 0 }
      },
      solution: {
        fragmentIds: ["fragment_circle_red_1", "fragment_circle_blue_1"]
      }
    });
    expect(evidence[0].generatedOverlap?.outline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number)
        })
      ])
    );
    expect(evidence[0].tolerance).toBeGreaterThan(0);
  });

  it("uses generated overlap outlines as the magnetic hit contour", () => {
    const generatedEvidence = deriveM01TargetEvidenceFromPlacements(config, [
      {
        fragmentId: "fragment_circle_red_1",
        position: { x: 0, y: 0 }
      },
      {
        fragmentId: "fragment_circle_blue_1",
        position: { x: 24, y: 0 }
      }
    ]);
    const generatedConfig: M01MemoryGearConfig = {
      ...config,
      targetPattern: {
        ...config.targetPattern!,
        locked: true,
        pieces: []
      },
      evidence: generatedEvidence
    };
    const layout = buildM01GreyboxLayout(generatedConfig);
    const evidence = layout.evidence[0];
    const fragment = layout.fragments.find(
      (candidate) => candidate.controllerId === "fragment_circle_red_1"
    );
    const sameShapeWrongColorFragment = layout.fragments.find(
      (candidate) => candidate.controllerId === "fragment_circle_yellow_1"
    );
    const wrongShapeFragment = layout.fragments.find(
      (candidate) => candidate.controllerId === "fragment_triangle_blue_1"
    );

    expect(evidence.magnetPolygon?.length).toBeGreaterThanOrEqual(3);
    expect(fragment).toBeDefined();
    expect(sameShapeWrongColorFragment).toBeDefined();
    expect(wrongShapeFragment).toBeDefined();
    expect(resolveM01GreyboxDrop(layout, fragment!, evidence.position)).toMatchObject({
      type: "weak_snap_fragment",
      evidenceId: evidence.controllerId
    });
    expect(resolveM01GreyboxDrop(layout, sameShapeWrongColorFragment!, evidence.position)).toMatchObject({
      type: "weak_snap_fragment",
      evidenceId: evidence.controllerId
    });
    expect(resolveM01GreyboxDrop(layout, wrongShapeFragment!, evidence.position)).toEqual({
      type: "place_fragment_freely",
      fragmentId: "fragment_triangle_blue_1",
      position: evidence.position
    });
    expect(
      resolveM01GreyboxDrop(layout, fragment!, {
        x: evidence.position.x + evidence.size.width / 2 - 2,
        y: evidence.position.y + evidence.size.height / 2 - 2
      })
    ).toEqual({
      type: "place_fragment_freely",
      fragmentId: "fragment_circle_red_1",
      position: {
        x: evidence.position.x + evidence.size.width / 2 - 2,
        y: evidence.position.y + evidence.size.height / 2 - 2
      }
    });
  });

  it("derives locked evidence from the current targetPattern pieces instead of stale config evidence", () => {
    const staleEvidenceConfig: M01MemoryGearConfig = {
      ...config,
      targetPattern: {
        ...config.targetPattern!,
        locked: true,
        pieces: [
          {
            id: "target_piece_circle_red_1",
            standardPieceId: "standard_circle",
            fragmentId: "fragment_circle_red_1",
            position: { x: 0, y: 0 },
            rotation: 0
          },
          {
            id: "target_piece_circle_blue_1",
            standardPieceId: "standard_circle",
            fragmentId: "fragment_circle_blue_1",
            position: { x: 24, y: 0 },
            rotation: 0
          }
        ]
      },
      evidence: [
        {
          ...config.evidence[0],
          id: "stale_previous_overlap",
          solution: {
            fragmentIds: ["fragment_circle_yellow_1", "fragment_hexagon_blue_1"]
          }
        }
      ]
    };

    const evidence = resolveM01TargetEvidenceFromConfig(staleEvidenceConfig);
    const layout = buildM01GreyboxLayout(staleEvidenceConfig);

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      id: "current_manual_target_purple_circle_circle_1",
      targetBlendColor: "purple",
      solution: {
        fragmentIds: ["fragment_circle_red_1", "fragment_circle_blue_1"]
      },
      generatedOverlap: {
        offset: { x: 24, y: 0 },
        sourceShapes: ["circle", "circle"]
      }
    });
    expect(evidence[0].id).not.toBe("stale_previous_overlap");
    expect(layout.evidence.map((item) => item.controllerId)).toEqual([
      "current_manual_target_purple_circle_circle_1"
    ]);
  });
});
