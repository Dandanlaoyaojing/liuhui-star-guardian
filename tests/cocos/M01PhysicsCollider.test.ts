import { describe, expect, it } from "vitest";
import {
  areM01PhysicsCircleFragmentsVisuallySeparated,
  buildM01PhysicsCollider,
  lowestColliderYAtRotation,
  resolveM01PhysicsColliderVisualPadding,
  rotationReseatDeltaY
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

describe("rotation re-seat (转向防沉地平线)", () => {
  it("triangle: 转 90° 最低点变深 → 需把节点上移补偿", () => {
    const tri = buildM01PhysicsCollider("triangle", 36);
    if (tri.kind !== "polygon") throw new Error("expected polygon");

    // 立姿(0°)底边在 -halfHeight = -18; 转 90° 后最低点到 -halfSide = -36/√3 ≈ -20.78, 更深。
    expect(lowestColliderYAtRotation(tri.points, 0)).toBeCloseTo(-18, 5);
    expect(lowestColliderYAtRotation(tri.points, 90)).toBeCloseTo(-36 / Math.sqrt(3), 5);

    // 补偿量 = oldMin - newMin > 0(上移), 正好抵消变深, 使最低点世界 Y 不变。
    const delta = rotationReseatDeltaY(tri.points, 0, 90);
    expect(delta).toBeCloseTo(-18 - -36 / Math.sqrt(3), 5);
    expect(delta).toBeGreaterThan(0);
    expect(lowestColliderYAtRotation(tri.points, 90) + delta).toBeCloseTo(
      lowestColliderYAtRotation(tri.points, 0),
      5
    );
  });

  it("空碰撞点(圆形走此路) → 补偿 0", () => {
    expect(rotationReseatDeltaY([], 0, 90)).toBe(0);
    expect(lowestColliderYAtRotation([], 123)).toBe(0);
  });
});
