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

  it("does not use evidence magnetism while the target pattern is still being composed", () => {
    const manualLayout = buildM01GreyboxLayout({
      ...config,
      targetPattern: {
        ...config.targetPattern!,
        locked: false
      }
    });
    const fragment = manualLayout.fragments.find((item) => item.controllerId === "fragment_triangle_red_1");
    const evidence = manualLayout.evidence.find(
      (item) => item.controllerId === "current_manual_target_green_circle_hexagon_1"
    );

    expect(fragment).toBeDefined();
    expect(evidence).toBeDefined();
    expect(resolveM01GreyboxDrop(manualLayout, fragment!, evidence!.position)).toEqual({
      type: "place_fragment_freely",
      fragmentId: "fragment_triangle_red_1",
      position: evidence!.position
    });
  });

  it("prefers the expected exact target piece slot over overlapping evidence magnetism after the target pattern is locked", () => {
    const lockedLayout = buildM01GreyboxLayout({
      ...config,
      targetPattern: {
        ...config.targetPattern!,
        locked: true
      }
    });
    const fragment = lockedLayout.fragments.find((item) => item.controllerId === "fragment_hexagon_blue_1");
    const evidence = lockedLayout.evidence.find(
      (item) => item.controllerId === "current_manual_target_green_circle_hexagon_1"
    );

    expect(fragment).toBeDefined();
    expect(evidence).toBeDefined();
    expect(resolveM01GreyboxDrop(lockedLayout, fragment!, evidence!.position)).toEqual({
      type: "snap_fragment_to_target_piece",
      fragmentId: "fragment_hexagon_blue_1",
      pieceSlotId: "target_piece_hexagon_blue_1",
      position: { x: -33, y: 3.5 },
      rotation: 0
    });
  });

  it("does not snap a same-shape wrong fragment into another fragment's locked target slot", () => {
    const fragment = layout.fragments.find((item) => item.controllerId === "fragment_hexagon_red_2");
    const evidence = layout.evidence.find(
      (item) => item.controllerId === "current_manual_target_green_circle_hexagon_1"
    );

    expect(fragment).toBeDefined();
    expect(evidence).toBeDefined();
    expect(resolveM01GreyboxDrop(layout, fragment!, evidence!.position)).toEqual({
      type: "weak_snap_fragment",
      fragmentId: "fragment_hexagon_red_2",
      evidenceId: "current_manual_target_green_circle_hexagon_1"
    });
  });

  it("returns the locked target rotation with a target piece snap", () => {
    const fragment = layout.fragments.find((item) => item.controllerId === "fragment_triangle_blue_1");

    expect(fragment).toBeDefined();
    expect(resolveM01GreyboxDrop(layout, fragment!, { x: 18, y: -40.5 })).toEqual({
      type: "snap_fragment_to_target_piece",
      fragmentId: "fragment_triangle_blue_1",
      pieceSlotId: "target_piece_triangle_blue_1",
      position: { x: 18, y: -40.5 },
      rotation: 90
    });
  });

  it("does not snap an expected fragment to a locked target slot when its rotation is wrong", () => {
    const fragment = layout.fragments.find((item) => item.controllerId === "fragment_triangle_blue_1");
    const targetPosition = { x: 18, y: -40.5 };

    expect(fragment).toBeDefined();
    expect(resolveM01GreyboxDrop(layout, fragment!, targetPosition, { rotation: 0 })).toEqual({
      type: "place_fragment_freely",
      fragmentId: "fragment_triangle_blue_1",
      position: targetPosition
    });
  });

  it("does not weak-snap an expected fragment to generated evidence when its rotation is wrong", () => {
    const fragment = layout.fragments.find((item) => item.controllerId === "fragment_triangle_blue_1");
    const evidence = layout.evidence.find(
      (item) => item.controllerId === "current_manual_target_green_triangle_triangle_1"
    );

    expect(fragment).toBeDefined();
    expect(evidence).toBeDefined();
    expect(resolveM01GreyboxDrop(layout, fragment!, evidence!.position, { rotation: 0 })).toEqual({
      type: "place_fragment_freely",
      fragmentId: "fragment_triangle_blue_1",
      position: evidence!.position
    });
  });

  it("keeps narrow target slots hittable after browser coordinate quantization", () => {
    const lockedLayout = buildM01GreyboxLayout({
      ...config,
      targetPattern: {
        ...config.targetPattern!,
        locked: true
      }
    });
    const fragment = lockedLayout.fragments.find((item) => item.controllerId === "fragment_circle_red_2");
    const evidence = lockedLayout.evidence.find(
      (item) => item.controllerId === "current_manual_target_orange_circle_triangle_1"
    );

    expect(fragment).toBeDefined();
    expect(evidence).toBeDefined();
    expect(
      resolveM01GreyboxDrop(lockedLayout, fragment!, {
        x: Math.round(evidence!.position.x),
        y: Math.round(evidence!.position.y)
      })
    ).toEqual({
      type: "snap_fragment_to_target_piece",
      fragmentId: "fragment_circle_red_2",
      pieceSlotId: "target_piece_circle_red_2",
      position: { x: -2, y: 14.5 },
      rotation: 0
    });
  });

  it("does not snap fragments to old target piece slots while composing a new target", () => {
    const manualLayout = buildM01GreyboxLayout({
      ...config,
      targetPattern: {
        ...config.targetPattern!,
        locked: false,
        pieces: []
      }
    });
    const fragment = manualLayout.fragments.find((item) => item.controllerId === "fragment_circle_yellow_1");
    const oldTargetPosition = { x: 68.92, y: 20.49 };

    expect(fragment).toBeDefined();
    expect(manualLayout.targetPieceSlots).toEqual([]);
    expect(resolveM01GreyboxDrop(manualLayout, fragment!, oldTargetPosition)).toEqual({
      type: "place_fragment_freely",
      fragmentId: "fragment_circle_yellow_1",
      position: oldTargetPosition
    });
  });

  it("keeps evidence reconstruction drops from being stolen by overlapping target piece slots after locking", () => {
    const lockedLayout = buildM01GreyboxLayout({
      ...config,
      targetPattern: {
        ...config.targetPattern!,
        locked: true,
        pieces: [
          {
            id: "target_piece_hexagon_lower_left",
            standardPieceId: "standard_hexagon",
            position: { x: -60.35, y: -73.1 }
          }
        ]
      }
    });
    const fragment = layout.fragments.find((item) => item.controllerId === "fragment_hexagon_red_2");
    const evidence = lockedLayout.evidence.find(
      (item) => item.controllerId === "current_manual_target_green_circle_hexagon_1"
    );

    expect(fragment).toBeDefined();
    expect(evidence).toBeDefined();
    expect(resolveM01GreyboxDrop(lockedLayout, fragment!, evidence!.position)).toEqual({
      type: "weak_snap_fragment",
      fragmentId: "fragment_hexagon_red_2",
      evidenceId: "current_manual_target_green_circle_hexagon_1"
    });
  });

  it("does not snap a mismatched shape to a target piece slot", () => {
    const fragment = layout.fragments.find((item) => item.controllerId === "fragment_triangle_red_1");
    const oldTargetPosition = { x: 68.92, y: 20.49 };

    expect(fragment).toBeDefined();
    expect(resolveM01GreyboxDrop(layout, fragment!, oldTargetPosition)).not.toMatchObject({
      type: "snap_fragment_to_target_piece",
      pieceSlotId: "target_piece_circle_right"
    });
  });

  it("does not weak-snap a shape that cannot produce the generated overlap target", () => {
    const fragment = layout.fragments.find((item) => item.controllerId === "fragment_triangle_red_1");
    const evidence = layout.evidence.find(
      (item) => item.controllerId === "current_manual_target_green_circle_hexagon_1"
    );

    expect(fragment).toBeDefined();
    expect(evidence).toBeDefined();
    expect(resolveM01GreyboxDrop(layout, fragment!, evidence!.position)).toEqual({
      type: "place_fragment_freely",
      fragmentId: "fragment_triangle_red_1",
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
