import { describe, expect, it } from "vitest";

import m01ConfigJson from "../../assets/resources/configs/stage1/m01-memory-gear.json" with { type: "json" };
import { buildM01GreyboxLayout } from "../../assets/scripts/cocos/M01GreyboxLayout.ts";
import type { M01MemoryGearConfig } from "../../assets/scripts/levels/stage1/M01MemoryGearController.ts";

const config = m01ConfigJson as unknown as M01MemoryGearConfig;

describe("buildM01GreyboxLayout", () => {
  it("creates a complete visible greybox layout from the real M01 config", () => {
    const layout = buildM01GreyboxLayout(config);

    expect(layout.canvas).toEqual({ width: 960, height: 640 });
    expect(layout.gear.id).toBe("entity_memory_gear");
    expect(layout.filters).toHaveLength(3);
    expect(layout.fragments).toHaveLength(18);
    expect(layout.slots).toHaveLength(9);
    expect(layout.statusText).toContain("插入颜色过滤器");
  });

  it("keeps fragments, filters, and slots addressable by controller ids", () => {
    const layout = buildM01GreyboxLayout(config);

    expect(layout.filters.map((filter) => filter.controllerId)).toEqual([
      "filter_red",
      "filter_blue",
      "filter_yellow"
    ]);
    expect(layout.fragments.map((fragment) => fragment.controllerId)).toContain(
      "fragment_red_circle_1"
    );
    expect(layout.slots.map((slot) => slot.controllerId)).toContain("slot_red_circle");
  });

  it("uses gameplay-readable shape and color tokens instead of color-only identity", () => {
    const layout = buildM01GreyboxLayout(config);

    const redCircle = layout.fragments.find(
      (fragment) => fragment.controllerId === "fragment_red_circle_1"
    );
    const blueTriangleSlot = layout.slots.find(
      (slot) => slot.controllerId === "slot_blue_triangle"
    );

    expect(redCircle).toMatchObject({
      colorToken: "red",
      shapeToken: "circle",
      kind: "fragment"
    });
    expect(blueTriangleSlot).toMatchObject({
      colorToken: "blue",
      shapeToken: "triangle",
      kind: "slot"
    });
  });

  it("keeps fragments out of their matching slot click targets", () => {
    const layout = buildM01GreyboxLayout(config);
    const slotsByKey = new Map(
      layout.slots.map((slot) => [`${slot.colorToken}:${slot.shapeToken}`, slot])
    );

    for (const fragment of layout.fragments) {
      const slot = slotsByKey.get(`${fragment.colorToken}:${fragment.shapeToken}`);
      expect(slot).toBeDefined();

      const dx = fragment.position.x - (slot?.position.x ?? 0);
      const dy = fragment.position.y - (slot?.position.y ?? 0);
      const distance = Math.hypot(dx, dy);

      expect(distance).toBeGreaterThanOrEqual(56);
    }
  });
});
