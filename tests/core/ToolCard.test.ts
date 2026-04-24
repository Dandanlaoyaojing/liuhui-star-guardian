import { describe, expect, it } from "vitest";

import {
  createToolCard,
  validateToolCard,
  type ToolCardDraft
} from "../../assets/scripts/core/ToolCard.ts";

const m01Draft: ToolCardDraft = {
  puzzleId: "m01",
  stage: 1,
  front: {
    toolName: "分类与归纳",
    scene: "textures/tools/m01-card",
    wisdomCrystal: "秩序，是为相似之物找到归处。"
  },
  back: {
    coreAction: "在杂乱事物中找到共同属性，按属性归组。",
    whenToUse: [
      "整理一堆笔记不知从何下手时",
      "需要把大量信息压缩总结时",
      "面对多个选项想不清它们关系时"
    ],
    realLifeExamples: [
      "整理书架：按主题、作者或使用频率归位",
      "做年度复盘：按项目、月份或情绪线索分组"
    ],
    commonTraps: "分类维度选错会制造假秩序；关键是这次分类要服务什么目的。"
  }
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
});
