import { describe, expect, it } from "vitest";

import {
  createToolCard,
  validateToolCard,
  type ToolCardDraft
} from "../../assets/scripts/core/ToolCard.ts";
import m01ConfigJson from "../../assets/resources/configs/stage1/m01-memory-gear.json" with { type: "json" };

const m01Draft: ToolCardDraft = {
  puzzleId: "m01",
  stage: 1,
  front: {
    toolName: "分类与归纳",
    scene: "textures/tools/m01-card",
    wisdomCrystal: "秩序，不在碎片本身，而在它们终于显现的关系里。"
  },
  back: {
    coreAction: "从局部证据中找出能彼此成立的关系，再把相关碎片归成结构。",
    whenToUse: [
      "面对一堆线索却不知道哪些真正相关时",
      "需要从局部证据复原整体结构时",
      "整理材料时发现单个标签不足以分类时"
    ],
    realLifeExamples: [
      "做访谈分析时，把彼此能解释的片段归成同一主题",
      "整理创作素材时，先找能互相呼应的片段，而不是按表面颜色分堆"
    ],
    commonTraps: "只看单个碎片的表面特征，忽略它和其他碎片放在一起时才显现的关系。"
  }
};

const m01Config = m01ConfigJson as {
  wisdomCrystal: string;
  toolCard: ToolCardDraft;
};

describe("ToolCard helpers", () => {
  it("creates a valid M01-like ToolCard with completion metadata", () => {
    const card = createToolCard(m01Draft, 12345);

    expect(card.unlockedAt).toBe(12345);
    expect(card.front.toolName).toBe("分类与归纳");
    expect(validateToolCard(card).ok).toBe(true);
  });

  it("rejects cards without useful back-side content", () => {
    const card = createToolCard(
      {
        ...m01Draft,
        back: {
          ...m01Draft.back,
          whenToUse: []
        }
      },
      12345
    );

    const result = validateToolCard(card);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("back.whenToUse must include at least one entry");
    }
  });

  it("keeps the real M01 ToolCard aligned with overlap-evidence relation sorting", () => {
    expect(m01Config.wisdomCrystal).toBe("秩序，不在碎片本身，而在它们终于显现的关系里。");
    expect(m01Config.toolCard.front.wisdomCrystal).toBe(m01Config.wisdomCrystal);
    expect(m01Config.toolCard.back.coreAction).toBe(
      "从局部证据中找出能彼此成立的关系，再把相关碎片归成结构。"
    );
    expect(m01Config.toolCard.back.whenToUse).toEqual([
      "面对一堆线索却不知道哪些真正相关时",
      "需要从局部证据复原整体结构时",
      "整理材料时发现单个标签不足以分类时"
    ]);
    expect(m01Config.toolCard.back.realLifeExamples).toEqual([
      "做访谈分析时，把彼此能解释的片段归成同一主题",
      "整理创作素材时，先找能互相呼应的片段，而不是按表面颜色分堆"
    ]);
    expect(m01Config.toolCard.back.commonTraps).toBe(
      "只看单个碎片的表面特征，忽略它和其他碎片放在一起时才显现的关系。"
    );

    const card = createToolCard(m01Config.toolCard, 12345);

    expect(validateToolCard(card).ok).toBe(true);
  });
});
