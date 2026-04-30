import { describe, expect, it } from "vitest";

import { M01GreyboxSession } from "../../assets/scripts/cocos/M01GreyboxSession.ts";
import type { M01MemoryGearConfig } from "../../assets/scripts/levels/stage1/M01MemoryGearController.ts";
import m01ConfigJson from "../../assets/resources/configs/stage1/m01-memory-gear.json" with { type: "json" };
import { m01LegacySortConfig as config } from "./m01LegacySortConfig.ts";

const realConfig = m01ConfigJson as unknown as M01MemoryGearConfig;
const CORRECT_EVIDENCE_PAIRS: Array<[string, [string, string]]> = [
  ["evidence_purple_arc", ["fragment_a", "fragment_b"]],
  ["evidence_green_notch", ["fragment_c", "fragment_d"]],
  ["evidence_orange_crescent", ["fragment_e", "fragment_f"]],
  ["evidence_purple_branch", ["fragment_g", "fragment_h"]]
];

function submitCorrectCandidate(session: M01GreyboxSession): void {
  for (const [evidenceId, fragmentIds] of CORRECT_EVIDENCE_PAIRS) {
    session.submitEvidencePair(evidenceId, fragmentIds);
  }
}

function submitWrongColorCompleteCandidate(session: M01GreyboxSession): void {
  session.submitEvidencePair("evidence_purple_arc", ["fragment_a", "fragment_i"]);
  for (const [evidenceId, fragmentIds] of CORRECT_EVIDENCE_PAIRS.slice(1)) {
    session.submitEvidencePair(evidenceId, fragmentIds);
  }
}

function submitWrongFragmentSetCompleteCandidate(session: M01GreyboxSession): void {
  session.submitEvidencePair("evidence_purple_arc", ["fragment_a", "fragment_m"]);
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

    expect(session.revealFragment("fragment_b")).toMatchObject({
      accepted: true,
      fragmentId: "fragment_b",
      revealedColor: "purple"
    });
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
      targetIds: expect.arrayContaining(["fragment_a", "fragment_b"])
    });

    session.pickFragment("fragment_a");

    expect(session.requestHint()).toMatchObject({
      level: 3,
      text: "HINT EVIDENCE",
      targetIds: ["evidence_purple_arc"]
    });
  });

  it("keeps shape-only weak snaps separate from color validation", () => {
    const session = M01GreyboxSession.fromConfig(realConfig);

    expect(session.weakSnapFragmentToEvidence("fragment_a", "evidence_purple_arc")).toMatchObject({
      accepted: true,
      completedEvidenceCount: 0,
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

  it("supports click-pick and click-place so staged fragments can be corrected", () => {
    const session = M01GreyboxSession.fromConfig(realConfig);

    expect(session.pickFragment("fragment_a")).toMatchObject({
      accepted: true,
      heldFragmentId: "fragment_a"
    });

    expect(session.placeHeldFragment({ x: 320, y: -180 })).toMatchObject({
      accepted: true,
      fragmentId: "fragment_a",
      placement: "free"
    });

    session.submitEvidencePair("evidence_purple_arc", ["fragment_a", "fragment_i"]);

    expect(session.submitEvidencePair("evidence_purple_arc", ["fragment_a", "fragment_b"])).toMatchObject({
      accepted: true,
      bottomLight: "off"
    });
  });

  it("releases the held fragment after a weak snap placement", () => {
    const session = M01GreyboxSession.fromConfig(realConfig);

    session.selectFlashlight("flashlight_red");
    session.pickFragment("fragment_a");
    expect(session.weakSnapFragmentToEvidence("fragment_a", "evidence_purple_arc")).toMatchObject({
      accepted: true
    });

    expect(session.requestHint()).toMatchObject({
      level: 2,
      targetIds: expect.arrayContaining(["fragment_b"])
    });
  });
});
