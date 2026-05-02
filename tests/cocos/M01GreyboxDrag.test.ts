import { describe, expect, it } from "vitest";

import { resolveM01GreyboxDrop } from "../../assets/scripts/cocos/M01GreyboxDrag.ts";
import { buildM01GreyboxLayout } from "../../assets/scripts/cocos/M01GreyboxLayout.ts";
import type { M01MemoryGearConfig } from "../../assets/scripts/levels/stage1/M01MemoryGearController.ts";
import m01ConfigJson from "../../assets/resources/configs/stage1/m01-memory-gear.json" with { type: "json" };

const config = m01ConfigJson as unknown as M01MemoryGearConfig;

describe("resolveM01GreyboxDrop", () => {
  const layout = buildM01GreyboxLayout(config);

  it("selects a flashlight when dropped or clicked", () => {
    const flashlight = layout.flashlights.find((item) => item.controllerId === "flashlight_red");

    expect(flashlight).toBeDefined();
    expect(resolveM01GreyboxDrop(layout, flashlight!, flashlight!.position)).toEqual({
      type: "select_flashlight",
      flashlightId: "flashlight_red"
    });
  });

  it("weak-snaps a shape-compatible fragment near a generated overlap target without completing it", () => {
    const fragment = layout.fragments.find((item) => item.controllerId === "fragment_triangle_red_1");
    const evidence = layout.evidence.find(
      (item) => item.controllerId === "evidence_purple_upper_left"
    );

    expect(fragment).toBeDefined();
    expect(evidence).toBeDefined();
    expect(resolveM01GreyboxDrop(layout, fragment!, evidence!.position)).toEqual({
      type: "weak_snap_fragment",
      fragmentId: "fragment_triangle_red_1",
      evidenceId: "evidence_purple_upper_left"
    });
  });

  it("does not weak-snap a shape that cannot produce the generated overlap target", () => {
    const fragment = layout.fragments.find((item) => item.controllerId === "fragment_hexagon_red_1");
    const evidence = layout.evidence.find(
      (item) => item.controllerId === "evidence_purple_upper_left"
    );

    expect(fragment).toBeDefined();
    expect(evidence).toBeDefined();
    expect(resolveM01GreyboxDrop(layout, fragment!, evidence!.position)).toEqual({
      type: "place_fragment_freely",
      fragmentId: "fragment_hexagon_red_1",
      position: evidence!.position
    });
  });

  it("returns a fragment to free placement when no evidence shape is nearby", () => {
    const fragment = layout.fragments.find((item) => item.controllerId === "fragment_circle_red_1");
    const position = { x: 420, y: -260 };

    expect(fragment).toBeDefined();
    expect(resolveM01GreyboxDrop(layout, fragment!, position)).toEqual({
      type: "place_fragment_freely",
      fragmentId: "fragment_circle_red_1",
      position
    });
  });
});
