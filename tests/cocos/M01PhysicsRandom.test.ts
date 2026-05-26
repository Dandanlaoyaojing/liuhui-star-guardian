import { describe, expect, it } from "vitest";
import { createM01PhysicsRng } from "../../assets/scripts/cocos/M01PhysicsRandom.ts";

describe("createM01PhysicsRng", () => {
  it("produces values in [0, 1) for any seed", () => {
    const rng = createM01PhysicsRng(42);
    for (let i = 0; i < 100; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is deterministic for a given seed", () => {
    const a = createM01PhysicsRng(12345);
    const b = createM01PhysicsRng(12345);
    for (let i = 0; i < 10; i += 1) {
      expect(a()).toBe(b());
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = createM01PhysicsRng(1);
    const b = createM01PhysicsRng(2);
    expect(a()).not.toBe(b());
  });
});
