import { describe, expect, it } from "vitest";
import {
  canSnapToZone,
  resolveDropResult,
  type SnapEntity,
  type SnapZone
} from "../../assets/scripts/interaction/SnapZone.ts";

describe("SnapZone", () => {
  const redCircleFragment: SnapEntity = {
    id: "fragment-red-circle-1",
    tags: ["fragment", "color:red", "shape:circle"]
  };

  const redCircleSlot: SnapZone = {
    id: "slot-red-circle",
    criteria: {
      all: ["color:red", "shape:circle"],
      none: ["locked"]
    },
    bounds: { x: 100, y: 100, width: 40, height: 40 },
    snapPosition: { x: 100, y: 100 }
  };

  it("accepts entities whose tags satisfy the zone criteria", () => {
    expect(canSnapToZone(redCircleFragment, redCircleSlot)).toEqual({
      accepted: true
    });
  });

  it("rejects entities with a readable criteria mismatch", () => {
    const blueCircleFragment: SnapEntity = {
      id: "fragment-blue-circle-1",
      tags: ["fragment", "color:blue", "shape:circle"]
    };

    expect(canSnapToZone(blueCircleFragment, redCircleSlot)).toEqual({
      accepted: false,
      reason: "missing_required_tags",
      missingTags: ["color:red"]
    });
  });

  it("resolves accepted, rejected, and missed drop results", () => {
    const accepted = resolveDropResult(redCircleFragment, [redCircleSlot], {
      x: 112,
      y: 92
    });

    expect(accepted).toEqual({
      type: "accepted",
      entityId: "fragment-red-circle-1",
      zoneId: "slot-red-circle",
      snapPosition: { x: 100, y: 100 }
    });

    const rejected = resolveDropResult(
      { id: "fragment-red-triangle-1", tags: ["fragment", "color:red", "shape:triangle"] },
      [redCircleSlot],
      { x: 112, y: 92 }
    );

    expect(rejected).toEqual({
      type: "rejected",
      entityId: "fragment-red-triangle-1",
      zoneId: "slot-red-circle",
      reason: "missing_required_tags",
      missingTags: ["shape:circle"]
    });

    const missed = resolveDropResult(redCircleFragment, [redCircleSlot], {
      x: 10,
      y: 10
    });

    expect(missed).toEqual({
      type: "missed",
      entityId: "fragment-red-circle-1",
      reason: "no_zone"
    });
  });
});
