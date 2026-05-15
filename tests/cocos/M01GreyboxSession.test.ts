import { describe, expect, it } from "vitest";

import { M01GreyboxSession } from "../../assets/scripts/cocos/M01GreyboxSession.ts";
import type { M01MemoryGearConfig } from "../../assets/scripts/levels/stage1/M01MemoryGearController.ts";
import m01ConfigJson from "../../assets/resources/configs/stage1/m01-memory-gear.json" with { type: "json" };
import { m01LegacySortConfig as config } from "./m01LegacySortConfig.ts";

const realConfig = m01ConfigJson as unknown as M01MemoryGearConfig;
const CORRECT_EVIDENCE_PAIRS: Array<[string, [string, string]]> = [
  ["current_manual_target_green_circle_hexagon_1", ["fragment_circle_yellow_1", "fragment_hexagon_blue_1"]],
  ["current_manual_target_orange_circle_hexagon_1", ["fragment_circle_yellow_1", "fragment_hexagon_red_2"]],
  ["current_manual_target_orange_circle_triangle_1", ["fragment_circle_red_2", "fragment_triangle_yellow_2"]],
  ["current_manual_target_purple_circle_hexagon_1", ["fragment_circle_red_2", "fragment_hexagon_blue_1"]],
  ["current_manual_target_green_triangle_triangle_1", ["fragment_triangle_blue_1", "fragment_triangle_yellow_2"]],
  ["current_manual_target_purple_triangle_hexagon_1", ["fragment_triangle_blue_1", "fragment_hexagon_red_2"]]
];

function submitCorrectCandidate(session: M01GreyboxSession): void {
  for (const [evidenceId, fragmentIds] of CORRECT_EVIDENCE_PAIRS) {
    session.submitEvidencePair(evidenceId, fragmentIds);
  }
}

function submitWrongColorCompleteCandidate(session: M01GreyboxSession): void {
  session.submitEvidencePair("current_manual_target_green_circle_hexagon_1", [
    "fragment_circle_red_2",
    "fragment_hexagon_blue_1"
  ]);
  for (const [evidenceId, fragmentIds] of CORRECT_EVIDENCE_PAIRS.slice(1)) {
    session.submitEvidencePair(evidenceId, fragmentIds);
  }
}

function submitWrongFragmentSetCompleteCandidate(session: M01GreyboxSession): void {
  session.submitEvidencePair("current_manual_target_green_circle_hexagon_1", [
    "fragment_circle_blue_1",
    "fragment_hexagon_yellow_1"
  ]);
  for (const [evidenceId, fragmentIds] of CORRECT_EVIDENCE_PAIRS.slice(1)) {
    session.submitEvidencePair(evidenceId, fragmentIds);
  }
}

describe("M01GreyboxSession", () => {
  it("lets the greybox activate a filter, select an eligible fragment, and place it in a slot", () => {
    const session = M01GreyboxSession.fromConfig(config);

    expect(session.activateFilter("filter_red").status).toContain("已启用");
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

  it("allows runtime status copy to be replaced without changing gameplay logic", () => {
    const session = M01GreyboxSession.fromConfig(config, {
      text: {
        filterActivated: "FILTER {color}",
        fragmentSelected: "PICKED {color} {shape}"
      }
    });

    expect(session.activateFilter("filter_red").status).toBe("FILTER red");
    expect(session.selectFragment("fragment_red_circle_1").status).toBe("PICKED red circle");
  });

  it("rejects selecting fragments that are hidden by the active filter", () => {
    const session = M01GreyboxSession.fromConfig(config);

    session.activateFilter("filter_red");

    expect(session.selectFragment("fragment_blue_circle_1")).toMatchObject({
      accepted: false,
      reason: "inactive_filter"
    });
  });

  it("advances greybox hints from filters to fragments to the selected fragment target slot", () => {
    const session = M01GreyboxSession.fromConfig(config);

    expect(session.requestHint()).toMatchObject({
      level: 1,
      targetIds: ["filter_red", "filter_blue", "filter_yellow"]
    });
    expect(session.getFilterView("filter_red")).toMatchObject({
      hinted: true,
      presentation: "hinted"
    });

    session.activateFilter("filter_red");

    expect(session.requestHint()).toMatchObject({
      level: 2,
      targetIds: expect.arrayContaining(["fragment_red_circle_1", "fragment_red_triangle_1"])
    });
    expect(session.getFragmentView("fragment_red_circle_1")).toMatchObject({
      hinted: true,
      presentation: "hinted"
    });
    expect(session.getFragmentView("fragment_blue_circle_1")).toMatchObject({
      hinted: false,
      presentation: "dimmed"
    });

    session.selectFragment("fragment_red_circle_1");

    expect(session.requestHint()).toMatchObject({
      level: 3,
      targetIds: ["slot_red_circle"]
    });
    expect(session.getSlotView("slot_red_circle")).toMatchObject({
      hinted: true,
      presentation: "hinted"
    });
  });

  it("allows hint copy to be replaced even when the config includes Chinese hint text", () => {
    const session = M01GreyboxSession.fromConfig(config, {
      text: {
        hintNoFilter: "HINT FILTER",
        hintActiveFilter: "HINT FRAGMENTS",
        hintSelectedFragment: "HINT SLOT"
      }
    });

    expect(session.requestHint().text).toBe("HINT FILTER");

    session.activateFilter("filter_red");
    expect(session.requestHint().text).toBe("HINT FRAGMENTS");

    session.selectFragment("fragment_red_circle_1");
    expect(session.requestHint().text).toBe("HINT SLOT");
  });

  it("exposes targeted error feedback when a selected fragment is placed in the wrong slot", () => {
    const session = M01GreyboxSession.fromConfig(config);

    session.activateFilter("filter_red");
    session.selectFragment("fragment_red_circle_1");
    const result = session.placeSelectedFragment("slot_red_triangle");

    expect(result).toMatchObject({
      accepted: false,
      reason: "wrong_slot"
    });
    expect(session.getLastFeedback()).toMatchObject({
      kind: "error",
      targetIds: ["fragment_red_circle_1", "slot_red_triangle"]
    });
    expect(session.getSlotView("slot_red_triangle")).toMatchObject({
      presentation: "error"
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
    expect(session.getRepairView()).toMatchObject({
      repaired: true,
      presentation: "repaired"
    });
  });

  it("reports completion in Chinese for the runtime status label", () => {
    const session = M01GreyboxSession.fromConfig(config);
    let lastStatus = "";

    for (const color of config.colors ?? []) {
      session.activateFilter(`filter_${color}`);
      for (const fragment of config.fragments.filter((item) => item.color === color)) {
        session.selectFragment(fragment.id);
        lastStatus = session.placeSelectedFragment(`slot_${fragment.color}_${fragment.shape}`).status;
      }
    }

    expect(lastStatus).toBe("M01 已修复，认知工具卡已解锁。");
  });

  it("selects a flashlight and reveals a fragment color", () => {
    const session = M01GreyboxSession.fromConfig(realConfig);

    expect(session.selectFlashlight("flashlight_red")).toMatchObject({
      accepted: true,
      activeFlashlightColor: "red"
    });

    expect(session.revealFragment("fragment_circle_blue_1")).toMatchObject({
      accepted: true,
      fragmentId: "fragment_circle_blue_1",
      revealedColor: "purple"
    });
  });

  it("shows an observed blend color only before a fragment is moved to assembly", () => {
    const session = M01GreyboxSession.fromConfig(realConfig);

    session.selectFlashlight("flashlight_red");
    session.revealFragment("fragment_circle_blue_1");

    expect(session.getFragmentView("fragment_circle_blue_1")).toMatchObject({
      observedColor: "purple",
      presentation: "highlighted"
    });

    session.pickFragment("fragment_circle_blue_1");

    expect(session.getFragmentView("fragment_circle_blue_1")).toMatchObject({
      presentation: "selected"
    });
    expect(session.getFragmentView("fragment_circle_blue_1")).not.toHaveProperty("observedColor");

    session.weakSnapFragmentToEvidence(
      "fragment_circle_blue_1",
      "current_manual_target_green_circle_hexagon_1"
    );

    expect(session.getFragmentView("fragment_circle_blue_1")).toMatchObject({
      presentation: "normal"
    });
    expect(session.getFragmentView("fragment_circle_blue_1")).not.toHaveProperty("observedColor");
  });

  it("reveals every candidate fragment for the selected fixed flashlight color", () => {
    const session = M01GreyboxSession.fromConfig(realConfig);
    const fragmentIds = realConfig.fragments.map((fragment) => fragment.id);

    session.selectFlashlight("flashlight_red");
    const revealed = session.revealFragments(fragmentIds);

    expect(revealed).toHaveLength(9);
    expect(
      Object.fromEntries(revealed.map((result) => [result.fragmentId, result.revealedColor]))
    ).toMatchObject({
      fragment_circle_blue_1: "purple",
      fragment_circle_yellow_1: "orange",
      fragment_circle_red_2: "red",
      fragment_triangle_blue_1: "purple",
      fragment_triangle_yellow_1: "orange",
      fragment_triangle_yellow_2: "orange",
      fragment_hexagon_blue_1: "purple",
      fragment_hexagon_yellow_1: "orange",
      fragment_hexagon_red_2: "red"
    });
    for (const fragmentId of fragmentIds) {
      expect(session.getFragmentView(fragmentId).observedColor).toBeDefined();
    }
  });

  it("keeps fixed floodlight reveal colors visible while the flashlight remains selected", () => {
    let now = 1_000;
    const session = M01GreyboxSession.fromConfig(realConfig, { now: () => now });
    const fragmentIds = realConfig.fragments.map((fragment) => fragment.id);

    session.selectFlashlight("flashlight_yellow");
    (
      session as unknown as {
        revealFragments: (
          ids: string[],
          options?: { persistent?: boolean }
        ) => ReturnType<M01GreyboxSession["revealFragments"]>;
      }
    ).revealFragments(fragmentIds, { persistent: true });

    now += 10_000;

    expect(
      Object.fromEntries(
        fragmentIds.map((fragmentId) => [
          fragmentId,
          session.getFragmentView(fragmentId).observedColor
        ])
      )
    ).toMatchObject({
      fragment_circle_blue_1: "green",
      fragment_circle_yellow_1: "yellow",
      fragment_circle_red_2: "orange",
      fragment_triangle_blue_1: "green",
      fragment_triangle_yellow_1: "yellow",
      fragment_triangle_yellow_2: "yellow",
      fragment_hexagon_blue_1: "green",
      fragment_hexagon_yellow_1: "yellow",
      fragment_hexagon_red_2: "orange"
    });
  });

  it("clears fixed floodlight observed colors when fragment movement starts", () => {
    const session = M01GreyboxSession.fromConfig(realConfig);
    const fragmentIds = realConfig.fragments.map((fragment) => fragment.id);

    session.selectFlashlight("flashlight_red");
    session.revealFragments(fragmentIds, { persistent: true });

    const clearedFragmentIds = session.clearObservedFragmentColors();

    expect(clearedFragmentIds).toEqual(fragmentIds);
    for (const fragmentId of fragmentIds) {
      expect(session.getFragmentView(fragmentId)).not.toHaveProperty("observedColor");
    }
  });

  it("expires observed flashlight colors after a short reveal window", () => {
    let now = 1_000;
    const session = M01GreyboxSession.fromConfig(realConfig, { now: () => now });

    session.selectFlashlight("flashlight_red");
    session.revealFragment("fragment_circle_blue_1");

    expect(session.getFragmentView("fragment_circle_blue_1")).toMatchObject({
      observedColor: "purple",
      presentation: "highlighted"
    });

    now += 1_999;

    expect(session.getFragmentView("fragment_circle_blue_1")).toMatchObject({
      observedColor: "purple",
      presentation: "highlighted"
    });

    now += 1;

    expect(session.getFragmentView("fragment_circle_blue_1")).toMatchObject({
      presentation: "normal"
    });
    expect(session.getFragmentView("fragment_circle_blue_1")).not.toHaveProperty("observedColor");
  });

  it("returns rejections instead of throwing when new actions are sent to a legacy config", () => {
    const session = M01GreyboxSession.fromConfig(config);

    expect(session.selectFlashlight("flashlight_red")).toMatchObject({
      accepted: false
    });
    expect(session.weakSnapFragmentToEvidence("fragment_red_circle_1", "evidence_missing")).toMatchObject({
      accepted: false,
      evidenceId: "evidence_missing"
    });
  });

  it("advances overlap-evidence hints from flashlights to fragments and evidence", () => {
    const session = M01GreyboxSession.fromConfig(realConfig, {
      text: {
        hintNoFilter: "HINT FLASHLIGHT",
        hintActiveFilter: "HINT OBSERVE",
        hintSelectedFragment: "HINT EVIDENCE"
      }
    });

    expect(session.requestHint()).toMatchObject({
      level: 1,
      text: "HINT FLASHLIGHT",
      targetIds: ["flashlight_red", "flashlight_yellow", "flashlight_blue"]
    });

    session.selectFlashlight("flashlight_red");

    expect(session.requestHint()).toMatchObject({
      level: 2,
      text: "HINT OBSERVE",
      targetIds: expect.arrayContaining(["fragment_circle_blue_1", "fragment_circle_yellow_1"])
    });

    session.pickFragment("fragment_circle_blue_1");

    expect(session.requestHint()).toMatchObject({
      level: 3,
      text: "HINT EVIDENCE",
      targetIds: expect.arrayContaining(["current_manual_target_green_circle_hexagon_1"])
    });
  });

  it("weak-snaps a shape-compatible fragment near a generated overlap target without validating color", () => {
    const session = M01GreyboxSession.fromConfig(realConfig);

    expect(
      session.weakSnapFragmentToEvidence(
        "fragment_hexagon_red_2",
        "current_manual_target_green_circle_hexagon_1"
      )
    ).toMatchObject({
      accepted: true,
      completedEvidenceCount: 0,
      bottomLight: "off"
    });
  });

  it("does not weak-snap a shape that cannot produce the generated overlap target", () => {
    const session = M01GreyboxSession.fromConfig(realConfig);

    expect(
      session.weakSnapFragmentToEvidence(
        "fragment_triangle_yellow_1",
        "current_manual_target_green_circle_hexagon_1"
      )
    ).toMatchObject({
      accepted: false,
      reason: "wrong_shape",
      bottomLight: "off"
    });
  });

  it("flashes bottom light when the submitted candidate is wrong", () => {
    const session = M01GreyboxSession.fromConfig(realConfig);
    submitWrongColorCompleteCandidate(session);

    expect(session.validateCandidateStructure()).toMatchObject({
      accepted: false,
      reason: "wrong_blend_color",
      bottomLight: "flash_then_off",
      validationLightSeconds: 2,
      completed: false
    });
  });

  it("treats a moved staged fragment as unstaged before validation", () => {
    const session = M01GreyboxSession.fromConfig(realConfig);
    submitCorrectCandidate(session);

    expect(session.pickFragment("fragment_circle_yellow_1")).toMatchObject({
      accepted: true,
      heldFragmentId: "fragment_circle_yellow_1"
    });
    expect(session.placeHeldFragment({ x: 320, y: -180 })).toMatchObject({
      accepted: true,
      fragmentId: "fragment_circle_yellow_1",
      placement: "free"
    });

    expect(session.validateCandidateStructure()).toMatchObject({
      accepted: false,
      reason: "incomplete_candidate",
      bottomLight: "flash_then_off",
      validationLightSeconds: 2,
      completed: false
    });
  });

  it("reveals staged fragment base colors only during the failed bottom-light flash window", () => {
    let now = 1_000;
    const session = M01GreyboxSession.fromConfig(realConfig, { now: () => now });
    submitWrongColorCompleteCandidate(session);

    expect(session.validateCandidateStructure()).toMatchObject({
      accepted: false,
      bottomLight: "flash_then_off"
    });

    expect(session.getFragmentView("fragment_circle_red_2")).toMatchObject({
      validationColor: "red",
      presentation: "highlighted"
    });
    expect(session.getFragmentView("fragment_hexagon_blue_1")).toMatchObject({
      validationColor: "blue",
      presentation: "highlighted"
    });
    expect(session.getFragmentView("fragment_hexagon_yellow_1")).toMatchObject({
      presentation: "normal"
    });
    expect(session.getFragmentView("fragment_hexagon_yellow_1")).not.toHaveProperty("validationColor");

    now += 2_000;

    expect(session.getFragmentView("fragment_circle_blue_1")).toMatchObject({
      presentation: "normal"
    });
    expect(session.getFragmentView("fragment_circle_blue_1")).not.toHaveProperty("validationColor");
  });

  it("clears failed-validation flash state as soon as the wrong evidence pair is corrected", () => {
    const session = M01GreyboxSession.fromConfig(realConfig);
    submitWrongColorCompleteCandidate(session);

    expect(session.validateCandidateStructure()).toMatchObject({
      accepted: false,
      reason: "wrong_blend_color",
      bottomLight: "flash_then_off",
      validationLightSeconds: 2,
      completed: false
    });
    expect(session.getFragmentView("fragment_circle_red_2")).toMatchObject({
      validationColor: "red",
      presentation: "highlighted"
    });
    expect(session.getFragmentView("fragment_hexagon_blue_1")).toMatchObject({
      validationColor: "blue",
      presentation: "highlighted"
    });

    expect(
      session.submitEvidencePair("current_manual_target_green_circle_hexagon_1", [
        "fragment_circle_yellow_1",
        "fragment_hexagon_blue_1"
      ])
    ).toMatchObject({
      accepted: true,
      replacedPreviousPair: true,
      bottomLight: "off",
      completed: false
    });

    expect(session.getCompletionState()).toMatchObject({
      completed: false,
      bottomLight: "off"
    });
    expect(session.getFragmentView("fragment_circle_red_2")).toMatchObject({
      presentation: "normal"
    });
    expect(session.getFragmentView("fragment_circle_red_2")).not.toHaveProperty("validationColor");

    expect(session.validateCandidateStructure()).toMatchObject({
      accepted: true,
      bottomLight: "steady_on",
      completed: true,
      validationLightSeconds: null
    });
  });

  it("keeps bottom light steady only after the whole candidate structure is correct", () => {
    const session = M01GreyboxSession.fromConfig(realConfig, { now: () => 12345 });
    submitCorrectCandidate(session);

    expect(session.validateCandidateStructure()).toMatchObject({
      accepted: true,
      bottomLight: "steady_on",
      completed: true
    });
    expect(session.getLastToolCard()?.unlockedAt).toBe(12345);
  });

  it("reports a wrong fragment set when a decoy produces the right blend color", () => {
    const session = M01GreyboxSession.fromConfig(realConfig);
    submitWrongFragmentSetCompleteCandidate(session);

    expect(session.validateCandidateStructure()).toMatchObject({
      accepted: false,
      reason: "wrong_fragment_set",
      bottomLight: "flash_then_off",
      validationLightSeconds: 2,
      completed: false
    });
  });

  it("can reset a failed overlap-evidence candidate after the validation flash", () => {
    const session = M01GreyboxSession.fromConfig(realConfig);
    submitWrongColorCompleteCandidate(session);

    expect(session.validateCandidateStructure()).toMatchObject({
      accepted: false,
      bottomLight: "flash_then_off"
    });
    expect(session.areAllEvidenceStaged()).toBe(true);

    expect(session.resetCandidateStructure().sort()).toEqual([
      "fragment_circle_yellow_1",
      "fragment_circle_red_2",
      "fragment_hexagon_blue_1",
      "fragment_hexagon_red_2",
      "fragment_triangle_blue_1",
      "fragment_triangle_yellow_2"
    ].sort());
    expect(session.areAllEvidenceStaged()).toBe(false);
    expect(session.getCompletionState()).toMatchObject({
      completed: false,
      bottomLight: "off",
      reconstructedEvidenceCount: 0
    });
  });

  it("supports click-pick and click-place so staged fragments can be corrected", () => {
    const session = M01GreyboxSession.fromConfig(realConfig);

    expect(session.pickFragment("fragment_circle_blue_1")).toMatchObject({
      accepted: true,
      heldFragmentId: "fragment_circle_blue_1"
    });

    expect(session.placeHeldFragment({ x: 320, y: -180 })).toMatchObject({
      accepted: true,
      fragmentId: "fragment_circle_blue_1",
      placement: "free"
    });

    session.submitEvidencePair("current_manual_target_green_circle_hexagon_1", [
      "fragment_hexagon_yellow_1",
      "fragment_circle_blue_1"
    ]);

    expect(
      session.submitEvidencePair("current_manual_target_green_circle_hexagon_1", [
        "fragment_circle_yellow_1",
        "fragment_hexagon_blue_1"
      ])
    ).toMatchObject({
      accepted: true,
      bottomLight: "off"
    });
  });

  it("releases the held fragment after a weak snap placement", () => {
    const session = M01GreyboxSession.fromConfig(realConfig);

    session.selectFlashlight("flashlight_red");
    session.pickFragment("fragment_circle_blue_1");
    expect(
      session.weakSnapFragmentToEvidence(
        "fragment_circle_blue_1",
        "current_manual_target_green_circle_hexagon_1"
      )
    ).toMatchObject({
      accepted: true
    });

    expect(session.requestHint()).toMatchObject({
      level: 2,
      targetIds: expect.arrayContaining(["fragment_triangle_blue_1"])
    });
  });
});
