import { describe, expect, it } from "vitest";

import m01ConfigJson from "../../assets/resources/configs/stage1/m01-memory-gear.json" with { type: "json" };
import { M01GreyboxSession } from "../../assets/scripts/cocos/M01GreyboxSession.ts";
import type { M01MemoryGearConfig } from "../../assets/scripts/levels/stage1/M01MemoryGearController.ts";

const config = m01ConfigJson as unknown as M01MemoryGearConfig;

describe("M01GreyboxSession", () => {
  it("lets the greybox activate a filter, select an eligible fragment, and place it in a slot", () => {
    const session = M01GreyboxSession.fromConfig(config);

    expect(session.activateFilter("filter_red").status).toContain("Active filter");
    expect(session.selectFragment("fragment_red_circle_1")).toMatchObject({
      accepted: true,
      selectedFragmentId: "fragment_red_circle_1"
    });
    expect(session.placeSelectedFragment("slot_red_circle")).toMatchObject({
      accepted: true,
      selectedFragmentId: undefined,
      sortedCount: 1
    });
  });

  it("rejects selecting fragments that are hidden by the active filter", () => {
    const session = M01GreyboxSession.fromConfig(config);

    session.activateFilter("filter_red");

    expect(session.selectFragment("fragment_blue_circle_1")).toMatchObject({
      accepted: false,
      reason: "inactive_filter"
    });
  });

  it("exposes visual state changes for filters, selected fragments, and placed fragments", () => {
    const session = M01GreyboxSession.fromConfig(config);

    session.activateFilter("filter_red");

    expect(session.getFilterView("filter_red")).toMatchObject({
      active: true,
      presentation: "active"
    });
    expect(session.getFragmentView("fragment_red_circle_1")).toMatchObject({
      interactive: true,
      presentation: "highlighted"
    });
    expect(session.getFragmentView("fragment_blue_circle_1")).toMatchObject({
      interactive: false,
      presentation: "dimmed"
    });

    session.selectFragment("fragment_red_circle_1");

    expect(session.getFragmentView("fragment_red_circle_1")).toMatchObject({
      selected: true,
      presentation: "selected"
    });

    session.placeSelectedFragment("slot_red_circle");

    expect(session.getFragmentView("fragment_red_circle_1")).toMatchObject({
      placed: true,
      interactive: false,
      presentation: "placed",
      slotId: "slot_red_circle"
    });
  });

  it("unlocks the ToolCard once the last fragment is placed", () => {
    const session = M01GreyboxSession.fromConfig(config, { now: () => 12345 });

    for (const color of config.colors ?? []) {
      session.activateFilter(`filter_${color}`);
      for (const fragment of config.fragments.filter((item) => item.color === color)) {
        session.selectFragment(fragment.id);
        session.placeSelectedFragment(`slot_${fragment.color}_${fragment.shape}`);
      }
    }

    expect(session.getCompletionState()).toMatchObject({
      completed: true,
      sortedCount: 18
    });
    expect(session.getLastToolCard()?.unlockedAt).toBe(12345);
  });
});
