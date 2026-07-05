import { createToolCard, type ToolCard, type ToolCardDraft } from "../core/ToolCard.ts";
import type { ProgressStore } from "../core/ProgressStore.ts";

const M02_PUZZLE_ID = "m02";

export function grantM02Completion(
  store: ProgressStore,
  toolCardData: ToolCardDraft,
  now: number
): ToolCard {
  const progress = store.getProgress();
  const completedAt = progress.completedPuzzles[M02_PUZZLE_ID]?.completedAt;
  const unlockedAt = progress.unlockedToolCards[M02_PUZZLE_ID]?.unlockedAt;

  if (completedAt !== undefined && unlockedAt !== undefined) {
    return createToolCard(toolCardData, unlockedAt);
  }

  const timestamp = completedAt ?? unlockedAt ?? now;
  if (completedAt === undefined) store.markPuzzleCompleted(M02_PUZZLE_ID, timestamp);

  const card = createToolCard(toolCardData, timestamp);
  if (unlockedAt === undefined) store.unlockToolCard(card);
  return card;
}
