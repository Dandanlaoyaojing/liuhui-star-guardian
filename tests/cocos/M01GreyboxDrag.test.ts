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

  it("weak-snaps a fragment near matching evidence shape without completing it", () => {
    const fragment = layout.fragments.find((item) => item.controllerId === "fragment_a");
    const evidence = layout.evidence.find((item) => item.controllerId === "evidence_purple_arc");

    expect(fragment).toBeDefined();
    expect(evidence).toBeDefined();
    expect(resolveM01GreyboxDrop(layout, fragment!, evidence!.position)).toEqual({
      type: "weak_snap_fragment",
      fragmentId: "fragment_a",
      evidenceId: "evidence_purple_arc"
    });
  });

  it("does not weak-snap a shape-mismatched fragment even when it is near evidence", () => {
    const fragment = layout.fragments.find((item) => item.controllerId === "fragment_k");
    const evidence = layout.evidence.find((item) => item.controllerId === "evidence_purple_arc");

    expect(fragment).toBeDefined();
    expect(evidence).toBeDefined();
    expect(resolveM01GreyboxDrop(layout, fragment!, evidence!.position)).toEqual({
      type: "place_fragment_freely",
      fragmentId: "fragment_k",
      position: evidence!.position
    });
  });

  it("returns a fragment to free placement when no evidence shape is nearby", () => {
    const fragment = layout.fragments.find((item) => item.controllerId === "fragment_a");
    const position = { x: 420, y: -260 };

    expect(fragment).toBeDefined();
    expect(resolveM01GreyboxDrop(layout, fragment!, position)).toEqual({
      type: "place_fragment_freely",
      fragmentId: "fragment_a",
      position
    });
  });
});
