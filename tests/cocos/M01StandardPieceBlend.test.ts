import { describe, expect, it } from "vitest";

import {
  buildM01StandardPiecePolygon,
  resolveM01StandardPieceBlendOverlays
} from "../../assets/scripts/cocos/M01StandardPieceBlend.ts";

describe("M01 standard-piece blend overlays", () => {
  it("returns explicit pigment blend color for overlapping standard pieces", () => {
    const overlays = resolveM01StandardPieceBlendOverlays([
      {
        id: "red_circle",
        shapeToken: "circle",
        colorToken: "red",
        position: { x: 0, y: 0 },
        size: { width: 56, height: 56 }
      },
      {
        id: "blue_circle",
        shapeToken: "circle",
        colorToken: "blue",
        position: { x: 22, y: 0 },
        size: { width: 56, height: 56 }
      }
    ]);

    expect(overlays).toHaveLength(1);
    expect(overlays[0]).toMatchObject({
      colorToken: "purple",
      sourceIds: ["red_circle", "blue_circle"]
    });
    expect(overlays[0].points.length).toBeGreaterThanOrEqual(3);
  });

  it("ignores disjoint pieces and non-primary colors", () => {
    expect(
      resolveM01StandardPieceBlendOverlays([
        {
          id: "red_circle",
          shapeToken: "circle",
          colorToken: "red",
          position: { x: -120, y: 0 },
          size: { width: 56, height: 56 }
        },
        {
          id: "yellow_circle",
          shapeToken: "circle",
          colorToken: "yellow",
          position: { x: 120, y: 0 },
          size: { width: 56, height: 56 }
        },
        {
          id: "neutral_triangle",
          shapeToken: "triangle",
          colorToken: "neutral",
          position: { x: 0, y: 0 },
          size: { width: 56, height: 56 }
        }
      ])
    ).toEqual([]);
  });

  it("uses rotated exact standard-piece geometry before clipping", () => {
    const upright = buildM01StandardPiecePolygon({
      id: "triangle",
      shapeToken: "triangle",
      colorToken: "yellow",
      position: { x: 0, y: 0 },
      size: { width: 56, height: 56 },
      rotation: 0
    });
    const rotated = buildM01StandardPiecePolygon({
      id: "triangle",
      shapeToken: "triangle",
      colorToken: "yellow",
      position: { x: 0, y: 0 },
      size: { width: 56, height: 56 },
      rotation: 90
    });

    expect(upright[0].y).toBeGreaterThan(0);
    expect(Math.abs(rotated[0].x)).toBeGreaterThan(Math.abs(rotated[0].y));
  });
});
