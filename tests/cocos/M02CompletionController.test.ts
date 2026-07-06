import { describe, expect, it } from "vitest";

import { grantM02Completion } from "../../assets/scripts/cocos/M02CompletionController.ts";
import { createMemoryStorage, createProgressStore } from "../../assets/scripts/core/ProgressStore.ts";
import { validateStarWebConfig, type StarWebConfig } from "../../assets/scripts/core/StarWebConfig.ts";
import starWeb from "../../assets/resources/configs/stage1/m02-starweb-warmth.json" with { type: "json" };

function loadConfig(): StarWebConfig {
  const result = validateStarWebConfig(starWeb);
  if (!result.ok) throw new Error("config invalid: " + result.errors.join(", "));
  return result.value;
}

describe("grantM02Completion", () => {
  it("marks M02 complete, unlocks its tool card, and is idempotent", () => {
    const store = createProgressStore({ storage: createMemoryStorage() });
    const cfg = loadConfig();

    const firstCard = grantM02Completion(store, cfg.toolCard, 1000);
    const secondCard = grantM02Completion(store, cfg.toolCard, 9999);
    const progress = store.getProgress();

    expect(store.isPuzzleCompleted("m02")).toBe(true);
    expect(store.hasToolCard("m02")).toBe(true);
    expect(firstCard.unlockedAt).toBe(1000);
    expect(secondCard.unlockedAt).toBe(1000);
    expect(progress.completedPuzzles.m02.completedAt).toBe(1000);
    expect(progress.unlockedToolCards.m02.unlockedAt).toBe(1000);
  });

  it("rejects tool cards from another puzzle before writing progress", () => {
    const store = createProgressStore({ storage: createMemoryStorage() });
    const cfg = loadConfig();
    const wrongCard = structuredClone(cfg.toolCard);
    wrongCard.puzzleId = "m99";

    expect(() => grantM02Completion(store, wrongCard, 1000)).toThrow("toolCardData.puzzleId must be m02");
    expect(store.getProgress()).toEqual({ completedPuzzles: {}, unlockedToolCards: {} });
  });
});
