import { describe, expect, it } from "vitest";

import { buildToolCardPreview } from "../../assets/scripts/ui/ToolCardView.ts";
import type { ToolCard } from "../../assets/scripts/core/ToolCard.ts";

const m01Card: ToolCard = {
  puzzleId: "m01",
  stage: 1,
  front: {
    toolName: "分类与归纳",
    scene: "stage1/m01/toolcards/classification-thumbnail",
    wisdomCrystal: "秩序，是为相似之物找到归处。"
  },
  back: {
    coreAction: "在杂乱事物中找到共同属性，按属性归组。",
    whenToUse: ["整理一堆笔记不知从何下手时"],
    realLifeExamples: ["整理书架：按主题、作者或使用频率归位"],
    commonTraps: "分类维度选错会制造假秩序。"
  },
  unlockedAt: 12345
};

describe("buildToolCardPreview", () => {
  it("builds a compact M01 unlock preview with the tool name and wisdom crystal", () => {
    const preview = buildToolCardPreview(m01Card);

    expect(preview.title).toBe("分类与归纳");
    expect(preview.subtitle).toBe("认知工具卡已解锁");
    expect(preview.lines).toEqual([
      "秩序，是为相似之物找到归处。",
      "在杂乱事物中找到共同属性，按属性归组。",
      "何时使用：整理一堆笔记不知从何下手时"
    ]);
  });

  it("allows visible ToolCard preview copy to be replaced for localization", () => {
    const preview = buildToolCardPreview(m01Card, {
      text: {
        unlockedSubtitle: "UNLOCKED",
        whenToUsePrefix: "USE: {value}"
      }
    });

    expect(preview.subtitle).toBe("UNLOCKED");
    expect(preview.lines[2]).toBe("USE: 整理一堆笔记不知从何下手时");
  });
});
