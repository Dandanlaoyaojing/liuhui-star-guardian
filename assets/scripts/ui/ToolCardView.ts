import type { ToolCard } from "../core/ToolCard.ts";

export interface ToolCardPreview {
  title: string;
  subtitle: string;
  lines: string[];
}

export function buildToolCardPreview(card: ToolCard): ToolCardPreview {
  return {
    title: card.front.toolName,
    subtitle: "认知工具卡已解锁",
    lines: [
      card.front.wisdomCrystal,
      card.back.coreAction,
      `何时使用：${card.back.whenToUse[0] ?? ""}`
    ]
  };
}
