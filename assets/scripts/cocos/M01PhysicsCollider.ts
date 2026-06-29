import type { M01PhysicsShape } from "./M01PhysicsRotation.ts";

export interface M01PhysicsPoint {
  x: number;
  y: number;
}

export type M01PhysicsColliderSpec =
  | { kind: "circle"; radius: number }
  | { kind: "polygon"; points: M01PhysicsPoint[] };

export interface M01PhysicsFragmentSeparationSample {
  shape: M01PhysicsShape;
  size: number;
  x: number;
  y: number;
}

export const M01_PHYSICS_COLLIDER_VISUAL_PADDING_BY_SHAPE: Record<M01PhysicsShape, number> = {
  circle: 4,
  triangle: 0,
  hexagon: 0
};
export const M01_PHYSICS_VISIBLE_OVERLAP_TOLERANCE = 0.75;

/** 一组(节点局部)碰撞点绕原点旋转 degrees(CCW) 后的最低 Y(相对节点原点)。空集 → 0。 */
export function lowestColliderYAtRotation(points: M01PhysicsPoint[], degrees: number): number {
  if (points.length === 0) {
    return 0;
  }
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  let minY = Number.POSITIVE_INFINITY;
  for (const p of points) {
    const y = p.x * sin + p.y * cos;
    if (y < minY) {
      minY = y;
    }
  }
  return minY;
}

/**
 * 把片从 fromDegrees 转到 toDegrees 后, 为保持"最低点世界 Y 不变"(转前贴着什么、转后还贴着)
 * 需要给 node.y 加的补偿量。绕外接框中心转会改变最低伸出量(如三角形 halfSide>halfHeight), 不补偿
 * 就会探到地平线下; 圆形各角同高 → 0。返回 oldMinY - newMinY。
 */
export function rotationReseatDeltaY(
  points: M01PhysicsPoint[],
  fromDegrees: number,
  toDegrees: number
): number {
  return lowestColliderYAtRotation(points, fromDegrees) - lowestColliderYAtRotation(points, toDegrees);
}

/**
 * Build the collider geometry for a fragment shape, centered at origin.
 * Size is the bounding diameter (the larger of width/height).
 */
export function buildM01PhysicsCollider(
  shape: M01PhysicsShape,
  size: number
): M01PhysicsColliderSpec {
  const r = size / 2;
  if (shape === "circle") {
    return { kind: "circle", radius: r };
  }
  if (shape === "triangle") {
    const halfHeight = size / 2;
    const halfSide = size / Math.sqrt(3);
    const points: M01PhysicsPoint[] = [
      { x: 0, y: halfHeight },
      { x: -halfSide, y: -halfHeight },
      { x: halfSide, y: -halfHeight }
    ];
    return { kind: "polygon", points };
  }
  const points: M01PhysicsPoint[] = [];
  for (let i = 0; i < 6; i += 1) {
    // hexagon, flat-top orientation (horizontal edges at top and bottom)
    const angle = (Math.PI / 3) * i;
    points.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
  }
  return { kind: "polygon", points };
}

export function resolveM01PhysicsColliderVisualPadding(shape: M01PhysicsShape): number {
  return M01_PHYSICS_COLLIDER_VISUAL_PADDING_BY_SHAPE[shape];
}

export function areM01PhysicsCircleFragmentsVisuallySeparated(
  fragments: M01PhysicsFragmentSeparationSample[],
  tolerance = M01_PHYSICS_VISIBLE_OVERLAP_TOLERANCE
): boolean {
  for (let leftIndex = 0; leftIndex < fragments.length; leftIndex += 1) {
    const left = fragments[leftIndex];
    if (left.shape !== "circle") {
      continue;
    }
    for (let rightIndex = leftIndex + 1; rightIndex < fragments.length; rightIndex += 1) {
      const right = fragments[rightIndex];
      if (right.shape !== "circle") {
        continue;
      }
      const dx = right.x - left.x;
      const dy = right.y - left.y;
      const distance = Math.hypot(dx, dy);
      const minDistance =
        visibleCircleRadius(left) + visibleCircleRadius(right) - tolerance;
      if (distance < minDistance) {
        return false;
      }
    }
  }

  return true;
}

export function visibleCircleRadius(fragment: M01PhysicsFragmentSeparationSample): number {
  return (fragment.size + resolveM01PhysicsColliderVisualPadding(fragment.shape)) / 2;
}
