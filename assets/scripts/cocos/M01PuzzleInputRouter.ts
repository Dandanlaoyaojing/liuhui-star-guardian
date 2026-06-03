// Pure two-phase tap routing for M01 (spec §5.2). The cc glue performs the hit-test and
// reports which objects a tap overlapped (`TapHit`) plus the current phase (`TapContext`);
// this module decides the single resulting action by phase-aware priority. Kept pure so the
// priority rules are vitest-testable. No `cc` imports.

export interface TapHit {
  /** tap overlaps a candidate fragment */
  fragment?: boolean;
  /** tap overlaps the flashlight Lemmy is holding */
  heldFlashlight?: boolean;
  /** tap overlaps the fallen (not-yet-picked-up) flashlight on the ground */
  fallenFlashlight?: boolean;
  // Empty ground is the implicit fallback when no object is hit.
}

export interface TapContext {
  /** Lemmy has picked up the flashlight (it is now hand-held). */
  flashlightAcquired: boolean;
  /** The player is currently carrying a candidate piece on the pointer. */
  holdingPiece: boolean;
}

export type TapAction =
  | "dropPiece"
  | "pickupFlashlight"
  | "cycleLight"
  | "walkLemmy"
  | "walkLemmyWithBeam"
  | "pickupPieceAndLightOff";

/**
 * Resolve a tap to one action. Priority is phase-aware:
 * - Holding a piece: any tap drops it (highest — overrides all).
 * - Before pickup: fallen flashlight > (fragment | ground) → walk. Fragments aren't pickable yet.
 * - After pickup: fragment > held flashlight > ground. Tapping a piece picks it up AND kills the light.
 */
export function routeTap(hit: TapHit, ctx: TapContext): TapAction {
  if (ctx.holdingPiece) {
    return "dropPiece";
  }

  if (!ctx.flashlightAcquired) {
    if (hit.fallenFlashlight) return "pickupFlashlight";
    return "walkLemmy"; // ground, or a not-yet-pickable fragment → just move Lemmy
  }

  if (hit.fragment) return "pickupPieceAndLightOff";
  if (hit.heldFlashlight) return "cycleLight";
  return "walkLemmyWithBeam";
}
