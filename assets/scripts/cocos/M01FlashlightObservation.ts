// Pure observation logic for M01's hand-held flashlight (spec §5.2).
//
// The flashlight is held by Lemmy. Tapping it cycles the light state; the beam has a
// coverage AREA centered on Lemmy, and every candidate fragment inside that area reveals
// its colour under the current light. This module owns the two pure decisions — what the
// next light state is, and which fragments the beam covers — so the cc glue (M01GreyboxBootstrap)
// stays a thin renderer. No `cc` imports here on purpose (vitest-testable).

export type LightState = "off" | "red" | "yellow" | "blue";

// Tapping the held flashlight walks this cycle. "off" is part of the cycle (4 states),
// matching spec §5.2 "红 → 黄 → 蓝 → 灭".
const NEXT_LIGHT_STATE: Record<LightState, LightState> = {
  off: "red",
  red: "yellow",
  yellow: "blue",
  blue: "off"
};

export function cycleLight(current: LightState): LightState {
  return NEXT_LIGHT_STATE[current];
}

export interface CoverageFragment {
  id: string;
  pos: { x: number; y: number };
  /** true when the fragment already sits on the assembly tray; the beam never lights the tray. */
  onTray?: boolean;
}

/**
 * Candidate fragments lit by the beam: those within `radius` of the beam center (Lemmy's
 * position) and not already on the assembly tray. Returns ids in input order. Because the
 * center is Lemmy's live position, moving Lemmy re-lights a different group each call.
 */
export function fragmentsInCoverage(
  center: { x: number; y: number },
  radius: number,
  fragments: CoverageFragment[]
): string[] {
  const radiusSquared = radius * radius;
  const lit: string[] = [];
  for (const fragment of fragments) {
    if (fragment.onTray) continue;
    const dx = fragment.pos.x - center.x;
    const dy = fragment.pos.y - center.y;
    if (dx * dx + dy * dy <= radiusSquared) {
      lit.push(fragment.id);
    }
  }
  return lit;
}

export interface CoveragePoolClampOptions {
  /** Pool (drawn light puddle) center, same space as the board bounds. */
  center: { x: number; y: number };
  /** Pool horizontal half-width (the coverage radius). */
  radiusX: number;
  /** Unclamped pool half-height (the flattened "light on the ground" look). */
  naturalHalfHeight: number;
  /** Assembly board bounds (center + size); only the bottom edge and x-span matter here. */
  board: { x: number; y: number; width: number; height: number };
  /** Extra gap kept between the pool top and the board bottom edge. */
  clearance: number;
}

/**
 * Vertical half-height for the drawn coverage pool so the light never washes over the
 * assembly board (spec §5.2: 光束只照候选区, 不照拼接盘). When the pool's x-span overlaps
 * the board's x-span, the pool top is clamped below the board's bottom edge (minus
 * clearance); a non-positive result means "don't draw at all". Pure so the spec rule is
 * unit-testable; the cc glue only feeds in live geometry.
 */
export function coveragePoolHalfHeight(options: CoveragePoolClampOptions): number {
  const { center, radiusX, naturalHalfHeight, board, clearance } = options;
  const boardLeft = board.x - board.width / 2;
  const boardRight = board.x + board.width / 2;
  const overlapsBoardSpan = center.x + radiusX > boardLeft && center.x - radiusX < boardRight;
  if (!overlapsBoardSpan) {
    return naturalHalfHeight;
  }

  const boardBottom = board.y - board.height / 2;
  const available = boardBottom - clearance - center.y;
  return Math.max(0, Math.min(naturalHalfHeight, available));
}
