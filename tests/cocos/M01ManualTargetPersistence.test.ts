import { describe, expect, it } from "vitest";

import {
  M01_MANUAL_TARGET_STORAGE_KEY,
  readM01ManualTargetPlacements,
  writeM01ManualTargetPlacements
} from "../../assets/scripts/cocos/M01ManualTargetPersistence.ts";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("M01 manual target persistence", () => {
  it("round-trips manual target placements through storage", () => {
    const storage = new MemoryStorage();

    writeM01ManualTargetPlacements(storage, [
      {
        fragmentId: "fragment_circle_red_1",
        position: { x: -12.5, y: 34 },
        rotation: 90
      }
    ]);

    expect(storage.getItem(M01_MANUAL_TARGET_STORAGE_KEY)).toContain("fragment_circle_red_1");
    expect(readM01ManualTargetPlacements(storage)).toEqual([
      {
        fragmentId: "fragment_circle_red_1",
        position: { x: -12.5, y: 34 },
        rotation: 90
      }
    ]);
  });

  it("ignores missing or malformed saved placements", () => {
    const storage = new MemoryStorage();

    expect(readM01ManualTargetPlacements(storage)).toEqual([]);

    storage.setItem(M01_MANUAL_TARGET_STORAGE_KEY, JSON.stringify([{ fragmentId: 12 }]));
    expect(readM01ManualTargetPlacements(storage)).toEqual([]);

    storage.setItem(M01_MANUAL_TARGET_STORAGE_KEY, "not json");
    expect(readM01ManualTargetPlacements(storage)).toEqual([]);
  });
});
