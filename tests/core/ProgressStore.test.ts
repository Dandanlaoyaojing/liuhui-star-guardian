import { describe, expect, it } from "vitest";

import {
  createMemoryStorage,
  createProgressStore
} from "../../assets/scripts/core/ProgressStore.ts";

describe("ProgressStore", () => {
  it("persists completed puzzles and unlocked cards in memory mode", () => {
    const storage = createMemoryStorage();
    const store = createProgressStore({ storage });

    store.markPuzzleCompleted("m01", 1000);
    store.unlockToolCard("m01", 1000);

    const reloadedStore = createProgressStore({ storage });

    expect(reloadedStore.isPuzzleCompleted("m01")).toBe(true);
    expect(reloadedStore.hasToolCard("m01")).toBe(true);
    expect(reloadedStore.getProgress().completedPuzzles.m01?.completedAt).toBe(1000);
  });

  it("uses an empty in-memory store when no storage adapter is provided", () => {
    const store = createProgressStore({ storage: null });

    expect(store.isPuzzleCompleted("m01")).toBe(false);

    store.markPuzzleCompleted("m01", 2000);

    expect(store.isPuzzleCompleted("m01")).toBe(true);
  });
});
