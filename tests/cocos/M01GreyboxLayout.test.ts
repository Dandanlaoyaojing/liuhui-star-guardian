import { describe, expect, it } from "vitest";

import { buildM01GreyboxLayout } from "../../assets/scripts/cocos/M01GreyboxLayout.ts";
import type { M01MemoryGearConfig } from "../../assets/scripts/levels/stage1/M01MemoryGearController.ts";
import m01ConfigJson from "../../assets/resources/configs/stage1/m01-memory-gear.json" with { type: "json" };

const config = m01ConfigJson as unknown as M01MemoryGearConfig;

describe("buildM01GreyboxLayout", () => {
  it("builds flashlight, candidate fragment, evidence, and board nodes", () => {
    const layout = buildM01GreyboxLayout(config);

    expect(layout.canvas).toEqual({ width: 960, height: 640 });
    expect(layout.gear.id).toBe("entity_memory_gear");
    expect(layout.flashlights).toHaveLength(3);
    expect(layout.fragments).toHaveLength(config.fragments.length);
    expect(layout.evidence).toHaveLength(config.evidence.length);
    expect(layout.board.kind).toBe("board");
    expect(layout.slots).toBeUndefined();
  });

  it("keeps candidate fragments visually hidden-color by default", () => {
    const layout = buildM01GreyboxLayout(config);

    expect(layout.fragments.every((fragment) => fragment.colorToken === "hidden")).toBe(true);
  });

  it("does not expose complete outline data in evidence nodes", () => {
    const layout = buildM01GreyboxLayout(config);

    for (const evidence of layout.evidence) {
      expect(evidence.tags).toContain("overlap_evidence");
      expect(evidence.tags).not.toContain("complete_outline");
    }
  });
});
