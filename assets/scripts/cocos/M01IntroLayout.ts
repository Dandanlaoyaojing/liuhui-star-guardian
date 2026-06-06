export const M01_INTRO_BASKET_DISPLAY_SIZE = { width: 387, height: 242 } as const;

export interface M01IntroBasketInnerWall {
  id: "bottom" | "left" | "right";
  center: { x: number; y: number };
  size: { width: number; height: number };
  angleDeg: number;
}

export const M01_INTRO_BASKET_TARGET_PIECE_COUNT = 9;
export const M01_INTRO_BASKET_VISIBLE_PIECE_COUNT_RANGE = { min: 4, max: 5 } as const;
export const M01_INTRO_BASKET_EFFECTIVE_COLLIDER_SIZE = 60;

export const M01_INTRO_BASKET_INNER_CAVITY = {
  floorY: -74,
  wallTopY: 74,
  bottomHalfWidth: 126,
  topHalfWidth: 166,
  frontOcclusionY: 20,
  wallThickness: 16,
  wallFriction: 0.76,
  wallRestitution: 0.03,
  releaseGuideMs: 650
} as const;

const LEFT_WALL_DX =
  -M01_INTRO_BASKET_INNER_CAVITY.topHalfWidth +
  M01_INTRO_BASKET_INNER_CAVITY.bottomHalfWidth;
const RIGHT_WALL_DX =
  M01_INTRO_BASKET_INNER_CAVITY.topHalfWidth -
  M01_INTRO_BASKET_INNER_CAVITY.bottomHalfWidth;
const WALL_DY =
  M01_INTRO_BASKET_INNER_CAVITY.wallTopY - M01_INTRO_BASKET_INNER_CAVITY.floorY;
const SIDE_WALL_LENGTH = Math.hypot(RIGHT_WALL_DX, WALL_DY);

export const M01_INTRO_BASKET_INNER_CAVITY_WALLS: ReadonlyArray<M01IntroBasketInnerWall> = [
  {
    id: "bottom",
    center: {
      x: 0,
      y:
        M01_INTRO_BASKET_INNER_CAVITY.floorY -
        M01_INTRO_BASKET_INNER_CAVITY.wallThickness / 2
    },
    size: {
      width: M01_INTRO_BASKET_INNER_CAVITY.bottomHalfWidth * 2,
      height: M01_INTRO_BASKET_INNER_CAVITY.wallThickness
    },
    angleDeg: 0
  },
  {
    id: "left",
    center: {
      x:
        (-M01_INTRO_BASKET_INNER_CAVITY.bottomHalfWidth -
          M01_INTRO_BASKET_INNER_CAVITY.topHalfWidth) /
        2,
      y: (M01_INTRO_BASKET_INNER_CAVITY.floorY + M01_INTRO_BASKET_INNER_CAVITY.wallTopY) / 2
    },
    size: { width: SIDE_WALL_LENGTH, height: M01_INTRO_BASKET_INNER_CAVITY.wallThickness },
    angleDeg: (Math.atan2(WALL_DY, LEFT_WALL_DX) * 180) / Math.PI
  },
  {
    id: "right",
    center: {
      x:
        (M01_INTRO_BASKET_INNER_CAVITY.bottomHalfWidth +
          M01_INTRO_BASKET_INNER_CAVITY.topHalfWidth) /
        2,
      y: (M01_INTRO_BASKET_INNER_CAVITY.floorY + M01_INTRO_BASKET_INNER_CAVITY.wallTopY) / 2
    },
    size: { width: SIDE_WALL_LENGTH, height: M01_INTRO_BASKET_INNER_CAVITY.wallThickness },
    angleDeg: (Math.atan2(WALL_DY, RIGHT_WALL_DX) * 180) / Math.PI
  }
] as const;

// Layout for the 9 real game pieces inside the basket (local to the basket node).
// The bottom row is hidden behind the front wall; the middle and top rows expose
// only 5 upper silhouettes. Centers are separated by the padded physics collider
// diameter so the staged pile respects the same "objects have volume" rule as
// the ground pile.
export const M01_INTRO_BASKET_PILE_OFFSETS: ReadonlyArray<{ x: number; y: number }> = [
  // Bottom row: four fully hidden pieces resting on the inner floor.
  { x: -90, y: -44 },
  { x: -30, y: -44 },
  { x: 30, y: -44 },
  { x: 90, y: -44 },
  // Middle row: three pieces whose top edges peek over the front wall.
  { x: -60, y: 8 },
  { x: 0, y: 8 },
  { x: 60, y: 8 },
  // Top row: two visible caps near the back rim.
  { x: -30, y: 56 },
  { x: 30, y: 56 }
];

export const M01_INTRO_BASKET_PILE_SHAPES = [
  "circle",
  "circle",
  "circle",
  "triangle",
  "triangle",
  "triangle",
  "hexagon",
  "hexagon",
  "hexagon"
] as const;

export function resolveM01IntroBasketInnerHalfWidthAtY(y: number): number {
  const range = M01_INTRO_BASKET_INNER_CAVITY.wallTopY - M01_INTRO_BASKET_INNER_CAVITY.floorY;
  const t =
    range <= 0
      ? 1
      : Math.max(0, Math.min(1, (y - M01_INTRO_BASKET_INNER_CAVITY.floorY) / range));
  return (
    M01_INTRO_BASKET_INNER_CAVITY.bottomHalfWidth +
    (M01_INTRO_BASKET_INNER_CAVITY.topHalfWidth -
      M01_INTRO_BASKET_INNER_CAVITY.bottomHalfWidth) *
      t
  );
}

export function areM01IntroBasketPileOffsetsSeparated(
  pieceDiameter = M01_INTRO_BASKET_EFFECTIVE_COLLIDER_SIZE,
  tolerance = 0.75
): boolean {
  for (let left = 0; left < M01_INTRO_BASKET_PILE_OFFSETS.length; left += 1) {
    for (let right = left + 1; right < M01_INTRO_BASKET_PILE_OFFSETS.length; right += 1) {
      const dx = M01_INTRO_BASKET_PILE_OFFSETS[right].x - M01_INTRO_BASKET_PILE_OFFSETS[left].x;
      const dy = M01_INTRO_BASKET_PILE_OFFSETS[right].y - M01_INTRO_BASKET_PILE_OFFSETS[left].y;
      if (Math.hypot(dx, dy) + tolerance < resolveM01IntroBasketMinCenterDistance(left, right, pieceDiameter)) {
        return false;
      }
    }
  }

  return true;
}

export function resolveM01IntroBasketMinCenterDistance(
  leftIndex: number,
  rightIndex: number,
  circleDiameter = M01_INTRO_BASKET_EFFECTIVE_COLLIDER_SIZE
): number {
  const leftShape = M01_INTRO_BASKET_PILE_SHAPES[leftIndex % M01_INTRO_BASKET_PILE_SHAPES.length];
  const rightShape = M01_INTRO_BASKET_PILE_SHAPES[rightIndex % M01_INTRO_BASKET_PILE_SHAPES.length];
  return leftShape === "circle" && rightShape === "circle" ? circleDiameter : 56;
}

export function isM01IntroBasketPileInsideInnerCavity(
  pieceDiameter = M01_INTRO_BASKET_EFFECTIVE_COLLIDER_SIZE
): boolean {
  for (let index = 0; index < M01_INTRO_BASKET_PILE_OFFSETS.length; index += 1) {
    const offset = M01_INTRO_BASKET_PILE_OFFSETS[index];
    const radius = resolveM01IntroBasketCavityRadius(index, pieceDiameter);
    if (offset.y - radius < M01_INTRO_BASKET_INNER_CAVITY.floorY) {
      return false;
    }
    if (offset.y > M01_INTRO_BASKET_INNER_CAVITY.wallTopY) {
      return false;
    }
    if (Math.abs(offset.x) + radius > resolveM01IntroBasketInnerHalfWidthAtY(offset.y)) {
      return false;
    }
  }

  return true;
}

function resolveM01IntroBasketCavityRadius(index: number, circleDiameter: number): number {
  const shape = M01_INTRO_BASKET_PILE_SHAPES[index % M01_INTRO_BASKET_PILE_SHAPES.length];
  return shape === "circle" ? circleDiameter / 2 : 28;
}

export function countM01IntroBasketVisiblePileOffsets(pieceDisplaySize: number): number {
  const radius = pieceDisplaySize / 2;
  return M01_INTRO_BASKET_PILE_OFFSETS.filter(
    (offset) => offset.y + radius > M01_INTRO_BASKET_INNER_CAVITY.frontOcclusionY
  ).length;
}
