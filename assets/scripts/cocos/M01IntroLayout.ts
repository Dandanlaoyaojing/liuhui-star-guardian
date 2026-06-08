// One knob to gently enlarge the WHOLE basket set so the 9 standard-size pieces sit in it as a
// visible stacked heap. Pieces stay standard size (M01_STANDARD_PIECE_DISPLAY_SIZE 56×56); only
// the basket sprite + physics cavity + pile offsets + nail height scale by this. The user wants
// only ~5-10% bigger than the original 387×242 tray (1.0). Tune live.
export const M01_INTRO_BASKET_SCALE = 1.12;

export const M01_INTRO_BASKET_DISPLAY_SIZE = {
  width: 387 * M01_INTRO_BASKET_SCALE,
  height: 242 * M01_INTRO_BASKET_SCALE
} as const;

export interface M01IntroBasketInnerWall {
  id: "bottom" | "left" | "right";
  center: { x: number; y: number };
  size: { width: number; height: number };
  angleDeg: number;
}

export const M01_INTRO_BASKET_TARGET_PIECE_COUNT = 9;
export const M01_INTRO_BASKET_VISIBLE_PIECE_COUNT_RANGE = { min: 4, max: 5 } as const;
export const M01_INTRO_BASKET_EFFECTIVE_COLLIDER_SIZE = 60;

// All geometry here is in basket-local world units and scales with M01_INTRO_BASKET_SCALE so
// the physics cavity always matches the (scaled) visible bowl. Invisible containment walls run
// taller than the visible bowl (wallTopY) so the 9-piece heap stays contained while it settles.
// Shift the WHOLE cavity (floor + walls; the physics pile settles on the floor so it follows)
// DOWN relative to the basket. -y = down. Tune in px.
export const M01_INTRO_BASKET_CAVITY_Y_SHIFT = -15;

export const M01_INTRO_BASKET_INNER_CAVITY = {
  floorY: -74 * M01_INTRO_BASKET_SCALE + M01_INTRO_BASKET_CAVITY_Y_SHIFT,
  wallTopY: -25 * M01_INTRO_BASKET_SCALE + M01_INTRO_BASKET_CAVITY_Y_SHIFT,
  bottomHalfWidth: 126 * M01_INTRO_BASKET_SCALE,
  topHalfWidth: 149 * M01_INTRO_BASKET_SCALE,
  frontOcclusionY: 20 * M01_INTRO_BASKET_SCALE + M01_INTRO_BASKET_CAVITY_Y_SHIFT,
  wallThickness: 16 * M01_INTRO_BASKET_SCALE,
  wallFriction: 0.76,
  wallRestitution: 0.03
} as const;

/**
 * Second-tap spill. The pieces RIDE the basket as it rocks, then are released to Dynamic and
 * TOSSED out in the tip direction (down-left). We script the toss velocity instead of relying on
 * the bowl walls to sweep them: a node-tween moves a body by teleport, which carries no Box2D
 * velocity, so swinging "kinematic" walls impart no fling — the pieces would just drop straight
 * down. Velocities are px/s; gravity (-640) then arcs them onto the static ground boundary.
 */
export const M01_INTRO_BASKET_SPILL = {
  flingVx: -150, // base horizontal toss toward the tipped mouth (lower-left)
  flingVxJitter: 80, // per-piece horizontal spread, so they pour instead of moving as one block
  flingVy: 70, // small up-and-out arc; gravity then pulls them down into the pile
  flingVyJitter: 55 // per-piece vertical spread
} as const;

/**
 * Deterministic per-piece toss velocity (no RNG → frame-rate independent and unit-testable).
 * Every piece gets a leftward vx (out the tipped mouth) with a spread, and a small outward vy arc.
 */
export function resolveM01IntroSpillFlingVelocity(index: number): { vx: number; vy: number } {
  const xPhase = (index % 3) - 1; // -1, 0, +1 cycling → spread around flingVx
  const yPhase = (index % 2) * 2 - 1; // -1, +1 alternating
  return {
    vx: M01_INTRO_BASKET_SPILL.flingVx + xPhase * M01_INTRO_BASKET_SPILL.flingVxJitter,
    vy: M01_INTRO_BASKET_SPILL.flingVy + yPhase * M01_INTRO_BASKET_SPILL.flingVyJitter
  };
}

const LEFT_WALL_DX =
  -M01_INTRO_BASKET_INNER_CAVITY.topHalfWidth +
  M01_INTRO_BASKET_INNER_CAVITY.bottomHalfWidth;
const RIGHT_WALL_DX =
  M01_INTRO_BASKET_INNER_CAVITY.topHalfWidth -
  M01_INTRO_BASKET_INNER_CAVITY.bottomHalfWidth;
const WALL_DY =
  M01_INTRO_BASKET_INNER_CAVITY.wallTopY - M01_INTRO_BASKET_INNER_CAVITY.floorY;
const SIDE_WALL_LENGTH = Math.hypot(RIGHT_WALL_DX, WALL_DY);
// Pull BOTH inner-cavity side walls inward (toward center) by this much, symmetrically, so they
// line up with the bowl's inner walls and stay within the canvas. Left wall moves +x (right);
// right wall moves -x (left).
const WALL_X_INWARD_NUDGE = 40;

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
          2 +
        WALL_X_INWARD_NUDGE,
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
          2 -
        WALL_X_INWARD_NUDGE,
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
// DROP SEEDS (not final positions): the pieces start here, then physics settles them into a
// heap. Scaled with the basket so they spread proportionally across the (bigger) cavity.
export const M01_INTRO_BASKET_PILE_OFFSETS: ReadonlyArray<{ x: number; y: number }> = [
  // Bottom row: four pieces resting near the inner floor.
  { x: -90, y: -44 },
  { x: -30, y: -44 },
  { x: 30, y: -44 },
  { x: 90, y: -44 },
  // Middle row.
  { x: -60, y: 8 },
  { x: 0, y: 8 },
  { x: 60, y: 8 },
  // Top row.
  { x: -30, y: 56 },
  { x: 30, y: 56 }
].map((o) => ({ x: o.x * M01_INTRO_BASKET_SCALE, y: o.y * M01_INTRO_BASKET_SCALE }));

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
    // NOTE: drop seeds may sit ABOVE the (short) containment walls — pieces are dropped
    // from above and fall down into the cavity, so no wallTopY ceiling check here.
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
