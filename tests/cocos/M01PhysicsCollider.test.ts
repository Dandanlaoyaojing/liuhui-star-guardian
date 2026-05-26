import { describe, expect, it } from "vitest";
import {
  areM01PhysicsCircleFragmentsVisuallySeparated,
  buildM01PhysicsCollider,
  resolveM01PhysicsColliderVisualPadding
} from "../../assets/scripts/cocos/M01PhysicsCollider.ts";

describe("buildM01PhysicsCollider", () => {
  it("returns 3 points for triangle, apex up, flat bottom", () => {
    const result = buildM01PhysicsCollider("triangle", 36);
    expect(result.kind).toBe("polygon");
    if (result.kind !== "polygon") throw new Error("expected polygon");
    expect(result.points).toHaveLength(3);
    expect(result.points[0].y).toBeGreaterThan(0);
    expect(result.points[1].y).toBe(result.points[2].y);
    expect(result.points[1].y).toBeLessThan(0);
  });

  it("centers triangle colliders in their visible bounding height", () => {
    const result = buildM01PhysicsCollider("triangle", 36);
    expect(result.kind).toBe("polygon");
    if (result.kind !== "polygon") throw new Error("expected polygon");

    const ys = result.points.map((p) => Number(p.y.toFixed(4)));
    expect(Math.max(...ys)).toBe(18);
    expect(Math.min(...ys)).toBe(-18);
  });

  it("returns 6 points for hexagon with flat-top orientation", () => {
    const result = buildM01PhysicsCollider("hexagon", 36);
    expect(result.kind).toBe("polygon");
    if (result.kind !== "polygon") throw new Error("unreachable");
    expect(result.points).toHaveLength(6);
    // Flat-top: two vertices share the maximal Y (forming the top edge),
    // and two share the minimal Y (forming the bottom edge).
    const ys = result.points.map((p) => Number(p.y.toFixed(4)));
    const maxY = Math.max(...ys);
    const minY = Math.min(...ys);
    expect(ys.filter((y) => y === maxY)).toHaveLength(2);
    expect(ys.filter((y) => y === minY)).toHaveLength(2);
  });

  it("returns radius for circle", () => {
    const result = buildM01PhysicsCollider("circle", 36);
    expect(result.kind).toBe("circle");
    if (result.kind !== "circle") throw new Error("expected circle");
    expect(result.radius).toBe(18);
  });

  it("keeps visible circle fragments separated before physics settling can freeze them", () => {
    expect(resolveM01PhysicsColliderVisualPadding("circle")).toBe(4);
    expect(
      areM01PhysicsCircleFragmentsVisuallySeparated([
        { shape: "circle", size: 56, x: 0, y: 0 },
        { shape: "circle", size: 56, x: 58, y: 0 }
      ])
    ).toBe(false);
    expect(
      areM01PhysicsCircleFragmentsVisuallySeparated([
        { shape: "circle", size: 56, x: 0, y: 0 },
        { shape: "circle", size: 56, x: 59.5, y: 0 }
      ])
    ).toBe(true);
  });
});
