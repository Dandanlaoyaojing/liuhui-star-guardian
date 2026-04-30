import { describe, expect, it } from "vitest";

import { buildToolCardPreview } from "../../assets/scripts/ui/ToolCardView.ts";
import type { ToolCard } from "../../assets/scripts/core/ToolCard.ts";
import m01ConfigJson from "../../assets/resources/configs/stage1/m01-memory-gear.json" with { type: "json" };

const m01Config = m01ConfigJson as { toolCard: Omit<ToolCard, "unlockedAt"> };

const m01Card: ToolCard = {
  ...m01Config.toolCard,
  unlockedAt: 12345
};

describe("buildToolCardPreview", () => {
  it("builds a compact M01 unlock preview with the tool name and wisdom crystal", () => {
    const preview = buildToolCardPreview(m01Card);

    expect(preview.title).toBe("分类与归纳");
    expect(preview.subtitle).toBe("认知工具卡已解锁");
    expect(preview.lines).toEqual([
      "秩序，不在碎片本身，而在它们终于显现的关系里。",
      "从局部证据中找出能彼此成立的关系，再把相关碎片归成结构。",
      "何时使用：面对一堆线索却不知道哪些真正相关时"
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
    expect(preview.lines[2]).toBe("USE: 面对一堆线索却不知道哪些真正相关时");
  });
});
