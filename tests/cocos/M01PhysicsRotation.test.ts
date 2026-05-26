import { describe, expect, it } from "vitest";
import { pickStableRotation } from "../../assets/scripts/cocos/M01PhysicsRotation.ts";

describe("pickStableRotation", () => {
  it("returns a value in [0, 360) for circle (any rotation stable)", () => {
    for (let i = 0; i < 20; i += 1) {
      const r = pickStableRotation("circle", () => i / 20);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(360);
    }
  });

  it("returns one of {0, 120, 240} for triangle", () => {
    const allowed = new Set([0, 120, 240]);
    for (let i = 0; i < 30; i += 1) {
      const r = pickStableRotation("triangle", () => i / 30);
      expect(allowed.has(r)).toBe(true);
    }
  });

  it("returns one of {0, 60, 120, 180, 240, 300} for hexagon", () => {
    const allowed = new Set([0, 60, 120, 180, 240, 300]);
    for (let i = 0; i < 30; i += 1) {
      const r = pickStableRotation("hexagon", () => i / 30);
      expect(allowed.has(r)).toBe(true);
    }
  });
});
