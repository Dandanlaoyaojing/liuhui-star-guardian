import type { ToolCard } from "../core/ToolCard.ts";

export interface ToolCardPreview {
  title: string;
  subtitle: string;
  lines: string[];
}

export interface ToolCardPreviewText {
  unlockedSubtitle: string;
  whenToUsePrefix: string;
}

export interface ToolCardPreviewOptions {
  text?: Partial<ToolCardPreviewText>;
}

const defaultToolCardPreviewText: ToolCardPreviewText = {
  unlockedSubtitle: "认知工具卡已解锁",
  whenToUsePrefix: "何时使用：{value}"
};

export function buildToolCardPreview(
  card: ToolCard,
  options: ToolCardPreviewOptions = {}
): ToolCardPreview {
  const text = {
    ...defaultToolCardPreviewText,
    ...options.text
  };

  return {
    title: card.front.toolName,
    subtitle: text.unlockedSubtitle,
    lines: [
      card.front.wisdomCrystal,
      card.back.coreAction,
      text.whenToUsePrefix.replace("{value}", card.back.whenToUse[0] ?? "")
    ]
  };
}
