import { describe, expect, it } from "vitest";

import { routeTap } from "../../assets/scripts/cocos/M01PuzzleInputRouter.ts";

describe("M01 puzzle tap routing — holding a piece", () => {
  it("drops the held piece on any tap, overriding everything else", () => {
    expect(routeTap({ fragment: true }, { flashlightAcquired: true, holdingPiece: true })).toBe(
      "dropPiece"
    );
    expect(
      routeTap({ heldFlashlight: true }, { flashlightAcquired: true, holdingPiece: true })
    ).toBe("dropPiece");
    expect(routeTap({}, { flashlightAcquired: false, holdingPiece: true })).toBe("dropPiece");
  });
});

describe("M01 puzzle tap routing — before the flashlight is picked up", () => {
  const ctx = { flashlightAcquired: false, holdingPiece: false };

  it("picks up the fallen flashlight", () => {
    expect(routeTap({ fallenFlashlight: true }, ctx)).toBe("pickupFlashlight");
  });

  it("walks Lemmy on empty ground (no beam yet)", () => {
    expect(routeTap({}, ctx)).toBe("walkLemmy");
  });

  it("picks up a spilled fragment even before the flashlight (no beam → no light-off)", () => {
    expect(routeTap({ fragment: true }, ctx)).toBe("pickupPiece");
  });

  it("prefers the fallen flashlight when it overlaps a fragment", () => {
    expect(routeTap({ fallenFlashlight: true, fragment: true }, ctx)).toBe("pickupFlashlight");
  });
});

describe("M01 puzzle tap routing — after the flashlight is picked up", () => {
  const ctx = { flashlightAcquired: true, holdingPiece: false };

  it("cycles the light when the held flashlight is tapped", () => {
    expect(routeTap({ heldFlashlight: true }, ctx)).toBe("cycleLight");
  });

  it("walks Lemmy with the beam following on empty ground", () => {
    expect(routeTap({}, ctx)).toBe("walkLemmyWithBeam");
  });

  it("picks up a candidate and turns the light off", () => {
    expect(routeTap({ fragment: true }, ctx)).toBe("pickupPieceAndLightOff");
  });

  it("prefers picking up the fragment when it overlaps the held flashlight", () => {
    expect(routeTap({ fragment: true, heldFlashlight: true }, ctx)).toBe("pickupPieceAndLightOff");
  });
});
