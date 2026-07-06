import type { ToolCard } from "../core/ToolCard.ts";

export interface ToolCardPreview {
  title: string;
  subtitle: string;
  /** 智慧结晶(= lines[0]);具名字段以免消费方按下标耦合 lines 顺序 */
  crystal: string;
  /** 核心动作(= lines[1]) */
  coreAction: string;
  /** 何时使用(= lines[2]) */
  whenToUse: string;
  /** 完整行数组,保留供需要逐行渲染的场景与既有测试;顺序见上方具名字段注释 */
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

  const lines = [
    card.front.wisdomCrystal,
    card.back.coreAction,
    text.whenToUsePrefix.replace("{value}", card.back.whenToUse[0] ?? "")
  ];

  return {
    title: card.front.toolName,
    subtitle: text.unlockedSubtitle,
    crystal: lines[0],
    coreAction: lines[1],
    whenToUse: lines[2],
    lines
  };
}
